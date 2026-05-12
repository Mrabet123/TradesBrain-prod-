// D3 F4 / D6 Flow07 — Trade Code Lookup screen.
// - Voice + text input
// - Temporary trade type switcher (resets when leaving the tab)
// - Top-3 RAG chunks + Claude formatted response + AHJ note appended
// - Last 10 lookups cached in AsyncStorage (offline access)
// - "Add to job notes" appears when there's an active Rex session
// - Code lookups do NOT decrement trial queries

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';

import { useAuthContext } from '../../context/AuthContext';
import { useTradeProfileContext } from '../../context/TradeProfileContext';
import { supabase } from '../../services/supabase';
import { lookupCode, type CodeLookupResult } from '../../services/codeLookup';
import { useVoiceRecording } from '../../hooks/useVoiceRecording';
import { useCodeLookupCache } from '../../hooks/useCodeLookupCache';
import { transcribeAudio } from '../../services/openai';
import VoiceRecordButton from '../../components/rex/VoiceRecordButton';
import CitationCard from '../../components/codes/CitationCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// D5 trade_type CHECK accepts: plumber / electrician / hvac / roofer / other.
const TRADES = [
  { value: 'plumber', label: 'Plumber' },
  { value: 'electrician', label: 'Electrician' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'roofer', label: 'Roofer' },
  { value: 'other', label: 'General' },
] as const;
type Trade = (typeof TRADES)[number]['value'];

export default function CodesScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuthContext();
  const { tradeType: profileTrade } = useTradeProfileContext();

  // Temporary trade switch — resets each time the user leaves the tab
  const [activeTrade, setActiveTrade] = useState<Trade>(
    (profileTrade as Trade) || 'plumber',
  );
  useEffect(() => {
    const unsubBlur = nav.addListener('blur', () => {
      // RULE 6 — revert temporary switch when leaving the tab
      setActiveTrade((profileTrade as Trade) || 'plumber');
    });
    return unsubBlur;
  }, [nav, profileTrade]);

  // Search state
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [latest, setLatest] = useState<CodeLookupResult | null>(null);

  // Cache (last 10 — offline)
  const { recent, record } = useCodeLookupCache(user?.id ?? null);

  // Active Rex session check — drives "Add to job notes" button
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    const fetchActive = async () => {
      const { data } = await supabase
        .from('job_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveSessionId(data?.id ?? null);
    };
    fetchActive();
    const unsub = nav.addListener('focus', fetchActive);
    return unsub;
  }, [user, nav]);

  const voice = useVoiceRecording();

  async function onVoiceStop() {
    const uri = await voice.stopRecording();
    if (!uri) return;
    setTranscribing(true);
    const res = await transcribeAudio(uri);
    setTranscribing(false);
    if (!res.ok || !res.text) {
      Alert.alert(
        'Voice failed',
        'Whisper proxy unavailable — type your question or deploy the Edge Function.',
      );
      return;
    }
    setText(res.text);
    runSearch(res.text);
  }

  async function runSearch(q: string) {
    const query = q.trim();
    if (!query) return;
    setBusy(true);
    try {
      const result = await lookupCode(query, activeTrade);
      setLatest(result);
      if (result.ok) await record(result);
    } catch (e: any) {
      Alert.alert('Lookup failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  async function addToJobNotes() {
    if (!activeSessionId || !latest) return;
    const noteText = `[Code lookup · ${latest.tradeType}]\nQ: ${latest.query}\n${latest.answerText}`;
    const { error } = await supabase.from('messages').insert({
      session_id: activeSessionId,
      role: 'user',
      content_text: noteText,
      session_stage: 1,
    });
    if (error) {
      Alert.alert('Could not add note', error.message);
      return;
    }
    Alert.alert('Saved', 'Code lookup added to the active Rex session as a note.');
  }

  const showEmpty = !latest && recent.length === 0;
  const tradeLabel = useMemo(
    () => TRADES.find((t) => t.value === activeTrade)?.label ?? activeTrade,
    [activeTrade],
  );

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="pb-10">
      <View className="pt-12 px-5">
        <Text className="text-2xl font-bold text-gray-900">Codes</Text>
        <Text className="text-sm text-gray-600 mb-3">
          Trade code lookup · {tradeLabel}
          {profileTrade && activeTrade !== profileTrade ? ' (temporary)' : ''}
        </Text>

        {/* Temporary trade switcher */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <View className="flex-row gap-2">
            {TRADES.map((t) => {
              const on = t.value === activeTrade;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => setActiveTrade(t.value)}
                  className={`px-3 py-2 rounded-full border ${
                    on ? 'border-brand bg-brand/10' : 'border-gray-300 bg-white'
                  }`}
                >
                  <Text className={`text-sm ${on ? 'text-brand font-medium' : 'text-gray-700'}`}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Search bar */}
        <View className="flex-row items-center gap-2 mb-2">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder='Ask a code question — e.g. "minimum slope for a 3-inch drain"'
            className="flex-1 border border-gray-300 rounded-lg px-3 py-3 text-base"
            onSubmitEditing={() => runSearch(text)}
          />
          <Pressable
            onPress={() => runSearch(text)}
            disabled={busy || !text.trim()}
            className={`px-4 py-3 rounded-lg ${busy || !text.trim() ? 'bg-gray-300' : 'bg-brand'}`}
          >
            <Text className="text-white font-semibold">Ask</Text>
          </Pressable>
        </View>

        <View className="flex-row items-center mb-4">
          <VoiceRecordButton
            isRecording={voice.isRecording}
            onPressIn={voice.startRecording}
            onPressOut={onVoiceStop}
          />
          {transcribing && (
            <View className="flex-row items-center ml-3">
              <ActivityIndicator size="small" />
              <Text className="text-xs text-gray-500 ml-2">Transcribing…</Text>
            </View>
          )}
        </View>

        {busy && (
          <View className="my-6 items-center">
            <ActivityIndicator />
            <Text className="text-xs text-gray-500 mt-2">Searching codes…</Text>
          </View>
        )}

        {/* Latest answer */}
        {latest && !busy && (
          <View className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <Text className="text-xs text-gray-500 mb-1">Q: {latest.query}</Text>
            <Text className="text-[15px] leading-6 text-gray-900">{latest.answerText}</Text>
            {latest.citations.length > 0 && (
              <View className="mt-3">
                <Text className="text-xs font-semibold text-gray-600 mb-2">Citations</Text>
                {latest.citations.map((c) => (
                  <CitationCard key={c.id} citation={c} />
                ))}
              </View>
            )}
            {activeSessionId && (
              <Pressable
                onPress={addToJobNotes}
                className="mt-2 py-3 rounded-lg border border-brand"
              >
                <Text className="text-center text-brand font-semibold">
                  Add to job notes
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Recent */}
        {recent.length > 0 && (
          <View className="mt-2">
            <Text className="text-sm font-semibold text-gray-700 mb-2">
              Recent lookups (offline)
            </Text>
            {recent.map((r) => (
              <Pressable
                key={r.ranAt}
                onPress={() => setLatest(r)}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-2"
              >
                <Text className="text-xs text-gray-500 mb-0.5">
                  {new Date(r.ranAt).toLocaleString()} · {r.tradeType}
                </Text>
                <Text className="text-sm font-medium text-gray-900">{r.query}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Empty state */}
        {showEmpty && !busy && (
          <View className="mt-8 items-center">
            <Text className="text-4xl mb-2">🧭</Text>
            <Text className="text-sm text-gray-500 text-center px-6">
              Ask Rex a code question to begin. Lookups are free — they never
              consume your trial queries.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
