// useRexSession — Full Rex session lifecycle (D4 §4.1, D6 Flow04).
// Owns: session creation, message persistence, streaming, summariser, RAG,
// stage tracking, soft-cap warnings + linked sessions, apprentice mode, trial
// decrement, close-job, retry. All Claude calls go through services/anthropic;
// the system prompt is assembled server-side in claude-proxy (RULE 10).

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { supabase } from '../services/supabase';
import { streamRexResponse, type ClaudeMessage } from '../services/anthropic';
import { compressHistory, shouldCompress } from '../services/summariser';
import { retrieveCodeContext } from '../services/rag';
import { SESSION_SOFT_CAP, SESSION_WARNING_AT } from '../constants/limits';
import type { Message, JobSession } from '../types/session';

export type Stage = 1 | 2 | 3 | 4 | 5;

// Rex asks this once when it detects an apprentice (D7 APPRENTICE DETECTION).
const APPRENTICE_QUESTION = /walk through each step/i;
// Re-summarise the conversation at most every N messages (D4 §3.2).
const RESUMMARISE_EVERY = 8;

interface State {
  session: JobSession | null;
  messages: Message[];
  stage: Stage;
  streaming: boolean;
  streamingText: string;
  softCapWarning: boolean;
  softCapReached: boolean;
  apprenticeAsked: boolean;
  apprenticeAnswered: boolean;
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
  | { type: 'CLOSE'; jobName?: string }
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
  apprenticeAnswered: false,
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
      return { ...s, apprenticeMode: a.on, apprenticeAnswered: true };
    case 'CLOSE':
      return {
        ...s,
        closed: true,
        session: a.jobName && s.session ? { ...s.session, jobName: a.jobName } : s.session,
      };
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
  // Cached conversation summary — refreshed at most every RESUMMARISE_EVERY messages.
  const summaryCacheRef = useRef<{ summary: string; atCount: number } | null>(null);
  // The latest photo's base64/mime — kept in a ref because it is not persisted
  // to the DB, so a retry can still re-attach the image.
  const lastPhotoRef = useRef<{ base64: string; mime: string } | null>(null);

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
            const session = rowToSession(ses);
            dispatch({ type: 'INIT', session, messages: msgs.map(rowToMessage) });
            // A linked session is seeded with a carry-over message; only a
            // brand-new empty active session needs the S0 opener.
            if (msgs.length === 0 && session.status === 'active') {
              await openSession(session);
            }
          }
          return;
        }

        const { data: ses, error } = await supabase
          .from('job_sessions')
          .insert({ user_id: userId, trade_type: tradeType, session_source: 'rex' })
          .select()
          .single();
        if (error || !ses) throw error;
        if (cancelled) return;

        const newSession = rowToSession(ses);
        dispatch({ type: 'INIT', session: newSession, messages: [] });
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
        tradeType: s.tradeType,
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

  // ── Claude turn for the latest user message in `history` (which ends with
  // that user message). Shared by sendMessage and retry. ────────────────────
  async function runAssistantTurn(s: JobSession, history: Message[]) {
    const queryText = history[history.length - 1]?.contentText ?? '';

    // Compress history past 10 messages; re-summarise at most every 8 (D4 §3.2),
    // reusing the cached summary in between.
    let claudeMessages: ClaudeMessage[];
    if (shouldCompress(history.length)) {
      let summary: string;
      const cache = summaryCacheRef.current;
      if (cache && history.length - cache.atCount < RESUMMARISE_EVERY) {
        summary = cache.summary;
      } else {
        const compressed = await compressHistory(history);
        summary = compressed.summary;
        summaryCacheRef.current = { summary, atCount: history.length };
      }
      claudeMessages = [
        { role: 'user', content: `[Compressed prior context]\n${summary}` },
        ...history.slice(-3).map(toClaudeMessage),
      ];
    } else {
      claudeMessages = history.map(toClaudeMessage);
    }

    // Re-attach the photo as multimodal content (base64 lives in a ref).
    const photo = lastPhotoRef.current;
    if (photo) {
      const last = claudeMessages[claudeMessages.length - 1];
      claudeMessages[claudeMessages.length - 1] = {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: photo.mime, data: photo.base64 } },
          { type: 'text', text: typeof last.content === 'string' ? last.content : queryText },
        ],
      };
    }

    const { ragContext } = await retrieveCodeContext(
      queryText,
      s.tradeType,
      state.stage,
      'diagnosis',
    );

    dispatch({ type: 'STREAM_START' });
    streamingRef.current = '';
    const result = await streamRexResponse(
      {
        tradeType: s.tradeType,
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
        error: result.error?.includes('aborted')
          ? 'Rex timed out (30s) — tap Retry to try again.'
          : (result.error ?? 'Rex hit an error — tap Retry to try again.'),
      });
      return;
    }
    dispatch({ type: 'ERROR', error: null });
    // Trial decrement — only AFTER a successful Claude response (RULE 7).
    supabase.functions.invoke('decrement-trial-query', { body: {} }).catch(() => {});
    await persistAssistant(s.id, result.fullText, state.stage, result.modelUsed);
    applyStageSignal(result.stage, result.fullText);
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
          error: 'Session reached the 30-message soft cap — start a linked session to continue.',
        });
        return;
      }

      const userMsg = await persistUser(
        s.id,
        opts.text,
        opts.photoUri ?? null,
        opts.transcriptOriginal ?? null,
        opts.transcriptEdited ?? null,
        state.stage,
      );
      if (!userMsg) return;
      dispatch({ type: 'APPEND', message: userMsg });
      lastPhotoRef.current =
        opts.photoBase64 && opts.photoMime
          ? { base64: opts.photoBase64, mime: opts.photoMime }
          : null;

      await runAssistantTurn(s, [...state.messages, userMsg]);
    },
    [state.session, state.messages, state.stage, state.streaming, state.closed, state.softCapReached, state.apprenticeAsked, userId],
  );

  // ── Retry the Claude turn after a failed send (D8 TC-058-060). The user
  // message is already persisted — re-run the turn without duplicating it. ───
  const retry = useCallback(async () => {
    const s = state.session;
    if (!s || state.streaming || state.closed) return;
    const last = state.messages[state.messages.length - 1];
    if (!last || last.role !== 'user') return;
    dispatch({ type: 'ERROR', error: null });
    await runAssistantTurn(s, state.messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.session, state.messages, state.stage, state.streaming, state.closed]);

  // ── Stage progression — prefer Rex's explicit [[STAGE:n]] marker; fall back
  // to a content heuristic if the marker is absent. Only ever moves forward.
  function applyStageSignal(explicit: Stage | undefined, text: string) {
    if (explicit && explicit > state.stage) {
      dispatch({ type: 'STAGE', stage: explicit });
      return;
    }
    if (explicit) return;
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

  // ── Apprentice mode — the worker answers Rex's "walk through each step?"
  const onApprenticeAnswer = useCallback(
    (yes: boolean) => {
      dispatch({ type: 'APPRENTICE_SET', on: yes });
      sendMessage({
        text: yes
          ? 'Yes — walk me through each step in detail as we go.'
          : 'No — standard clinical detail is fine.',
      });
    },
    [sendMessage],
  );

  // ── Worker pushback (D6 Flow04 Pushback A/B): two-step. ───────────────────
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
        // 'close_job' is handled by the screen (it collects a job name first).
      }
    },
    [state.pushbackCount, state.stage, sendMessage, advanceStage],
  );

  // ── Close job (D6 Flow04 Stage 5) — persists the worker-supplied job name. ─
  const closeJob = useCallback(
    async (jobName?: string) => {
      if (!state.session) return;
      const update: Record<string, unknown> = {
        status: 'completed',
        closed_at: new Date().toISOString(),
      };
      if (jobName && jobName.trim()) update.job_name = jobName.trim();
      const { error } = await supabase
        .from('job_sessions')
        .update(update)
        .eq('id', state.session.id);
      if (error) {
        dispatch({ type: 'ERROR', error: error.message });
        return;
      }
      dispatch({ type: 'CLOSE', jobName: jobName?.trim() });
    },
    [state.session],
  );

  // ── Soft-cap linked session (D4 §3.5) ─────────────────────────────────────
  const startLinkedSession = useCallback(async (): Promise<string | null> => {
    const s = state.session;
    if (!s) return null;
    try {
      const { summary } = await compressHistory(state.messages);
      const { data: ses, error } = await supabase
        .from('job_sessions')
        .insert({
          user_id: userId,
          trade_type: s.tradeType,
          session_source: 'rex',
          parent_session_id: s.id,
          job_name: s.jobName,
        })
        .select()
        .single();
      if (error || !ses) throw error;
      await supabase.from('messages').insert({
        session_id: ses.id,
        role: 'assistant',
        content_text:
          `Continuing from the previous session — it reached the ${SESSION_SOFT_CAP}-message limit.\n\n` +
          `Here's where we left off:\n${summary}\n\nWhat do you need next?`,
        session_stage: state.stage,
        model_used: 'carry-over',
      });
      return ses.id as string;
    } catch (e: any) {
      dispatch({ type: 'ERROR', error: e?.message ?? 'Could not start a linked session.' });
      return null;
    }
  }, [state.session, state.messages, state.stage, userId]);

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
    if (!state.apprenticeAsked && APPRENTICE_QUESTION.test(text)) {
      dispatch({ type: 'APPRENTICE_ASK' });
    }
  }

  const lastMsg = state.messages[state.messages.length - 1];
  return {
    ...state,
    sendMessage,
    retry,
    canRetry:
      !state.streaming &&
      !state.closed &&
      !!state.error &&
      !!lastMsg &&
      lastMsg.role === 'user',
    advanceStage,
    onContextualAction,
    onApprenticeAnswer,
    closeJob,
    startLinkedSession,
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
