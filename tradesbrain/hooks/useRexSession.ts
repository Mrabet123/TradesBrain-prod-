// useRexSession — Full Rex session lifecycle (D4 §4.1, D6 Flow04).
// Owns: session creation, message persistence, streaming, summariser, RAG,
// stage tracking, soft-cap warnings, trial decrement, close-job.
// All Claude API calls go through services/anthropic.streamRexResponse,
// which proxies via supabase functions/claude-proxy.

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { supabase } from '../services/supabase';
import { streamRexResponse, type ClaudeMessage } from '../services/anthropic';
import { compressHistory, shouldCompress } from '../services/summariser';
import { retrieveCodeContext } from '../services/rag';
import { getSystemPrompt } from '../constants/systemPrompts';
import { SESSION_SOFT_CAP, SESSION_WARNING_AT } from '../constants/limits';
import type { Message, JobSession } from '../types/session';

export type Stage = 1 | 2 | 3 | 4 | 5;

interface State {
  session: JobSession | null;
  messages: Message[];
  stage: Stage;
  streaming: boolean;
  streamingText: string;
  softCapWarning: boolean;
  softCapReached: boolean;
  apprenticeAsked: boolean;
  apprenticeMode: boolean;
  pushbackCount: number;
  closed: boolean;
  error: string | null;
}

type Action =
  | { type: 'INIT'; session: JobSession; messages: Message[] }
  | { type: 'STAGE'; stage: Stage }
  | { type: 'APPEND'; message: Message }
  | { type: 'STREAM_START' }
  | { type: 'STREAM_CHUNK'; chunk: string }
  | { type: 'STREAM_END' }
  | { type: 'SOFT_CAP'; warning: boolean; reached: boolean }
  | { type: 'PUSHBACK_INC' }
  | { type: 'APPRENTICE_ASK' }
  | { type: 'APPRENTICE_SET'; on: boolean }
  | { type: 'CLOSE' }
  | { type: 'ERROR'; error: string | null };

const initial: State = {
  session: null,
  messages: [],
  stage: 1,
  streaming: false,
  streamingText: '',
  softCapWarning: false,
  softCapReached: false,
  apprenticeAsked: false,
  apprenticeMode: false,
  pushbackCount: 0,
  closed: false,
  error: null,
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'INIT':
      return { ...s, session: a.session, messages: a.messages, closed: a.session.status !== 'active' };
    case 'STAGE':
      return { ...s, stage: a.stage };
    case 'APPEND':
      return { ...s, messages: [...s.messages, a.message] };
    case 'STREAM_START':
      return { ...s, streaming: true, streamingText: '' };
    case 'STREAM_CHUNK':
      return { ...s, streamingText: s.streamingText + a.chunk };
    case 'STREAM_END':
      return { ...s, streaming: false, streamingText: '' };
    case 'SOFT_CAP':
      return { ...s, softCapWarning: a.warning, softCapReached: a.reached };
    case 'PUSHBACK_INC':
      return { ...s, pushbackCount: s.pushbackCount + 1 };
    case 'APPRENTICE_ASK':
      return { ...s, apprenticeAsked: true };
    case 'APPRENTICE_SET':
      return { ...s, apprenticeMode: a.on };
    case 'CLOSE':
      return { ...s, closed: true };
    case 'ERROR':
      return { ...s, error: a.error };
    default:
      return s;
  }
}

interface UseRexOpts {
  sessionId?: string | null;
  tradeType: string;
  userId: string;
  recapOnLoad?: boolean;
}

export function useRexSession({ sessionId, tradeType, userId, recapOnLoad }: UseRexOpts) {
  const [state, dispatch] = useReducer(reducer, initial);
  const streamingRef = useRef('');
  const recapTriggeredRef = useRef(false);

  // ── Session bootstrapping ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (sessionId) {
          const { data: ses } = await supabase
            .from('job_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();
          const { data: msgs } = await supabase
            .from('messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });
          if (cancelled) return;
          if (ses && msgs) {
            dispatch({
              type: 'INIT',
              session: rowToSession(ses),
              messages: msgs.map(rowToMessage),
            });
          }
          return;
        }


        // Create new session
        const { data: ses, error } = await supabase
          .from('job_sessions')
          .insert({
            user_id: userId,
            trade_type: tradeType,
            session_source: 'rex',
          })
          .select()
          .single();
        if (error || !ses) throw error;
        if (cancelled) return;

        const newSession = rowToSession(ses);
        dispatch({ type: 'INIT', session: newSession, messages: [] });

        // S0 — send 6 context questions in one natural message
        await openSession(newSession);
      } catch (e: any) {
        dispatch({ type: 'ERROR', error: e?.message ?? 'Could not start session' });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId]);

  // ── Recap on reopen (D6 Flow12 / M5 RULE 3) ───────────────────────────────
  // When a session is opened with recapOnLoad=true, send a single recap-
  // trigger user message after messages have loaded. Defends against
  // double-trigger via recapTriggeredRef.
  useEffect(() => {
    if (!recapOnLoad) return;
    if (recapTriggeredRef.current) return;
    if (!state.session || state.messages.length === 0 || state.streaming) return;
    recapTriggeredRef.current = true;
    sendMessage({
      text:
        'Reopening this job. Recap what we worked on last time in 3-5 sentences, then ask what we need now.',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recapOnLoad, state.session, state.messages.length]);

  // ── Soft-cap tracker ──────────────────────────────────────────────────────
  useEffect(() => {
    const userMsgs = state.messages.filter((m) => m.role === 'user').length;
    dispatch({
      type: 'SOFT_CAP',
      warning: userMsgs >= SESSION_WARNING_AT,
      reached: userMsgs >= SESSION_SOFT_CAP,
    });
  }, [state.messages]);

  // ── Open session: ask 6 context questions in one Rex message ─────────────
  async function openSession(s: JobSession) {
    dispatch({ type: 'STREAM_START' });
    streamingRef.current = '';

    const opening: ClaudeMessage[] = [
      {
        role: 'user',
        content:
          'A new Rex diagnostic session is starting. Open the session per the SESSION OPENING — MANDATORY CONTEXT CAPTURE block in your system prompt. Ask all six context questions in one natural professional message.',
      },
    ];

    const result = await streamRexResponse(
      {
        systemPrompt: getSystemPrompt(s.tradeType),
        messages: opening,
        sessionStage: 1,
        messageType: 'diagnosis',
        maxTokens: 600,
      },
      (chunk) => {
        streamingRef.current += chunk;
        dispatch({ type: 'STREAM_CHUNK', chunk });
      },
    );

    dispatch({ type: 'STREAM_END' });
    if (!result.ok) {
      dispatch({ type: 'ERROR', error: result.error ?? 'Rex did not respond.' });
      return;
    }
    await persistAssistant(s.id, result.fullText, 1, result.modelUsed);
  }

  // ── Send user message (text + optional photo + optional transcript) ──────
  const sendMessage = useCallback(
    async (opts: {
      text: string;
      photoUri?: string | null;
      photoBase64?: string | null;
      photoMime?: string | null;
      transcriptOriginal?: string | null;
      transcriptEdited?: string | null;
    }) => {
      const s = state.session;
      if (!s || state.streaming || state.closed) return;
      if (state.softCapReached) {
        dispatch({
          type: 'ERROR',
          error: 'Session reached the 30-message soft cap — start a linked session.',
        });
        return;
      }

      // 1) Persist user message
      const photoUrl = opts.photoUri ?? null;
      const userMsg = await persistUser(
        s.id,
        opts.text,
        photoUrl,
        opts.transcriptOriginal ?? null,
        opts.transcriptEdited ?? null,
        state.stage,
      );
      if (!userMsg) return;
      dispatch({ type: 'APPEND', message: userMsg });

      // 2) Trial decrement (graceful — function may be undeployed)
      supabase.functions
        .invoke('decrement-trial-query', { body: { user_id: userId } })
        .catch(() => {});

      // 3) Compress history if > 10 messages
      let claudeMessages: ClaudeMessage[];
      if (shouldCompress(state.messages.length + 1)) {
        const { summary, recentMessages } = await compressHistory([
          ...state.messages,
          userMsg,
        ]);
        claudeMessages = [
          { role: 'user', content: `[Compressed prior context]\n${summary}` },
          ...recentMessages.map(toClaudeMessage),
        ];
      } else {
        claudeMessages = [...state.messages, userMsg].map(toClaudeMessage);
      }

      // Inject photo as multimodal content on the latest user message
      if (opts.photoBase64 && opts.photoMime) {
        const last = claudeMessages[claudeMessages.length - 1];
        claudeMessages[claudeMessages.length - 1] = {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: opts.photoMime, data: opts.photoBase64 } },
            { type: 'text', text: typeof last.content === 'string' ? last.content : opts.text },
          ],
        };
      }

      // 4) RAG retrieval (5 chunks @ stage ≤ 2; 2 chunks @ stage 3-5)
      const { ragContext } = await retrieveCodeContext(
        opts.text,
        s.tradeType,
        state.stage,
        'diagnosis',
      );

      // 5) Stream the response
      dispatch({ type: 'STREAM_START' });
      streamingRef.current = '';
      const result = await streamRexResponse(
        {
          systemPrompt: getSystemPrompt(s.tradeType),
          messages: claudeMessages,
          sessionStage: state.stage,
          messageType: state.stage === 3 || state.stage === 5 ? 'confirmation' : 'diagnosis',
          ragContext,
          maxTokens: 2000,
        },
        (chunk) => {
          streamingRef.current += chunk;
          dispatch({ type: 'STREAM_CHUNK', chunk });
        },
      );

      dispatch({ type: 'STREAM_END' });
      if (!result.ok) {
        dispatch({
          type: 'ERROR',
          error:
            result.error?.includes('aborted')
              ? 'Rex timed out (30s) — please try again.'
              : (result.error ?? 'Rex hit an error.'),
        });
        return;
      }

      // 6) Persist assistant + auto-advance stage on heuristics
      await persistAssistant(s.id, result.fullText, state.stage, result.modelUsed);
      maybeAdvanceStage(result.fullText);
    },
    [state.session, state.messages, state.stage, state.streaming, state.closed, state.softCapReached, userId],
  );

  // ── Stage progression heuristic — Rex authors content like "Stage 2…" or
  // "Step 1:" so we nudge forward when those signals appear. Worker override
  // happens via ContextualButtons → advanceStage().
  function maybeAdvanceStage(text: string) {
    const t = text.toLowerCase();
    let next: Stage | null = null;
    if (state.stage === 1 && /(diagnosis|root cause|the issue is|component:)/.test(t)) next = 2;
    else if (state.stage === 2 && /(step 1|first step|begin by)/.test(t)) next = 3;
    else if (state.stage === 3 && /(final|completion|inspection)/.test(t)) next = 4;
    else if (state.stage === 4 && /(close (this )?job|job complete)/.test(t)) next = 5;
    if (next) dispatch({ type: 'STAGE', stage: next });
  }

  const advanceStage = useCallback((next: Stage) => {
    dispatch({ type: 'STAGE', stage: next });
  }, []);

  // ── Worker pushback (D6 Flow04 Pushback A/B): two-step. Rex holds once,
  // then adopts. Increments pushbackCount; on second pushback, send a directive.
  const onContextualAction = useCallback(
    (action: string) => {
      switch (action) {
        case 'disagree':
        case 'pushback':
          dispatch({ type: 'PUSHBACK_INC' });
          sendMessage({
            text:
              state.pushbackCount === 0
                ? "I don't agree with your read. Hold on your diagnosis and ask me one specific confirming input (closer photo, measurement, or test) — then adapt if my view stands."
                : "I'm sticking with my read. Adopt my position and proceed.",
          });
          break;
        case 'looks_right':
        case 'agree_diagnosis':
          advanceStage(((state.stage + 1) as Stage) <= 5 ? ((state.stage + 1) as Stage) : 5);
          break;
        case 'step_done':
          sendMessage({ text: 'Step done — give me the next step.' });
          break;
        case 'more_detail':
        case 'followup':
          sendMessage({ text: 'Give me more detail before I move on.' });
          break;
        case 'final_pass':
          sendMessage({ text: 'Final check passed.' });
          break;
        case 'found_issue':
          sendMessage({ text: 'Found a new issue during final check — please assess.' });
          break;
        case 'close_job':
          closeJob();
          break;
      }
    },
    [state.pushbackCount, state.stage, sendMessage],
  );

  const closeJob = useCallback(async () => {
    if (!state.session) return;
    const { error } = await supabase
      .from('job_sessions')
      .update({ status: 'completed', closed_at: new Date().toISOString() })
      .eq('id', state.session.id);
    if (error) {
      dispatch({ type: 'ERROR', error: error.message });
      return;
    }
    dispatch({ type: 'CLOSE' });
  }, [state.session]);

  // ── Persistence helpers ───────────────────────────────────────────────────
  async function persistUser(
    sessionId: string,
    text: string,
    photoUrl: string | null,
    transcriptOriginal: string | null,
    transcriptEdited: string | null,
    stage: number,
  ): Promise<Message | null> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        session_id: sessionId,
        role: 'user',
        content_text: text,
        photo_url: photoUrl,
        transcript_original: transcriptOriginal,
        transcript_edited: transcriptEdited,
        session_stage: stage,
      })
      .select()
      .single();
    if (error || !data) {
      dispatch({ type: 'ERROR', error: error?.message ?? 'Save failed' });
      return null;
    }
    await supabase
      .from('job_sessions')
      .update({ message_count: state.messages.length + 1 })
      .eq('id', sessionId);
    return rowToMessage(data);
  }

  async function persistAssistant(
    sessionId: string,
    text: string,
    stage: number,
    model: string,
  ): Promise<void> {
    const { data } = await supabase
      .from('messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content_text: text,
        session_stage: stage,
        model_used: model,
      })
      .select()
      .single();
    if (data) dispatch({ type: 'APPEND', message: rowToMessage(data) });
  }

  return {
    ...state,
    sendMessage,
    advanceStage,
    onContextualAction,
    closeJob,
    canShowReportQuote: state.closed,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function rowToMessage(row: any): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    createdAt: row.created_at,
    role: row.role,
    contentText: row.content_text,
    photoUrl: row.photo_url,
    transcriptOriginal: row.transcript_original,
    transcriptEdited: row.transcript_edited,
    modelUsed: row.model_used,
    sessionStage: row.session_stage,
    isSummary: row.is_summary,
    tokensUsed: row.tokens_used,
  };
}

function rowToSession(row: any): JobSession {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    status: row.status,
    jobName: row.job_name,
    jobsite: row.jobsite,
    tradeType: row.trade_type,
    sessionSource: row.session_source,
    messageCount: row.message_count,
    timeOnJobsiteSeconds: row.time_on_jobsite_seconds,
    parentSessionId: row.parent_session_id,
  };
}

function toClaudeMessage(m: Message): ClaudeMessage {
  return {
    role: m.role,
    content: m.contentText ?? '',
  };
}
