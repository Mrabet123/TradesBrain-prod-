// D3 F2, D6 Flow05 — Report builder screen.
// Path A: route params { sessionId } — Rex session context pre-loaded.
// Path B: no sessionId — Rex asks for full description by voice, builder creates
//   a new job_sessions row with session_source='report_standalone'.
// Confirm permanently locks via prevent_finalised_update trigger.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';

import { supabase } from '../../services/supabase';
import {
  createReportDraft,
  saveReportDraft,
  discardReportDraft,
  confirmReport,
  loadPrefs,
  savePrefs,
  type ReportDraft,
  type ReportSection,
  type ProfileBlock,
} from '../../services/documents';
import { sharePdf } from '../../services/share';
import { transcribeAudio } from '../../services/openai';
import { useAuthContext } from '../../context/AuthContext';
import { useTradeProfileContext } from '../../context/TradeProfileContext';
import { useVoiceRecording } from '../../hooks/useVoiceRecording';
import ReportPreview from '../../components/documents/ReportPreview';
import SectionPicker from '../../components/documents/SectionPicker';
import VoiceRecordButton from '../../components/rex/VoiceRecordButton';
import { DEFAULT_REPORT_SECTIONS } from '../../constants/paymentMethods';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RouteT = RouteProp<RootStackParamList, 'ReportBuilder'>;

export default function ReportBuilderScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { user } = useAuthContext();
  const { tradeType, hourlyRate } = useTradeProfileContext();
  const voice = useVoiceRecording();

  // Path indicator
  const incomingSessionId = route.params?.sessionId ?? null;
  const [sessionId, setSessionId] = useState<string | null>(incomingSessionId);
  const [jobName, setJobName] = useState('');

  // Section picker (first-time gate)
  const [pickerVisible, setPickerVisible] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [prefsSections, setPrefsSections] = useState<readonly string[]>(DEFAULT_REPORT_SECTIONS);

  // Voice summary
  const [summary, setSummary] = useState('');
  const [transcribing, setTranscribing] = useState(false);

  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileBlock | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Load profile + prefs on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [profileRes, prefs] = await Promise.all([
        supabase
          .from('users')
          .select('full_name, trade_type, hourly_rate, vat_number, license_number, company_name')
          .eq('id', user.id)
          .single(),
        loadPrefs(user.id, 'report'),
      ]);
      if (profileRes.data) {
        setProfile({
          fullName: profileRes.data.full_name,
          tradeType: profileRes.data.trade_type,
          hourlyRate: Number(profileRes.data.hourly_rate),
          vatNumber: profileRes.data.vat_number ?? '',
          licenseNumber: profileRes.data.license_number ?? '',
          companyName: profileRes.data.company_name ?? null,
        });
      }
      if (prefs?.sections?.length) {
        setPrefsSections(prefs.sections);
      } else {
        setPickerVisible(true);
      }
      setPrefsLoaded(true);
      setLoading(false);
    })();
  }, [user]);

  // ── Discard prompt on back navigation (D3 F2 DISCARD RULE) ────────────────
  useEffect(() => {
    const unsub = nav.addListener('beforeRemove', (e) => {
      if (!draft || pdfUri || confirming) return;
      e.preventDefault();
      Alert.alert(
        'Discard report?',
        'This document has not been confirmed. It will be discarded if you leave.',
        [
          { text: 'Stay' },
          {
            text: 'Confirm and generate PDF',
            onPress: () => doConfirm().then(() => nav.dispatch(e.data.action)),
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: async () => {
              await discardReportDraft(draft.id);
              nav.dispatch(e.data.action);
            },
          },
        ],
      );
    });
    return unsub;
  }, [nav, draft, pdfUri, confirming]);

  // ── Voice → transcribe → summary ──────────────────────────────────────────
  async function onVoiceStop() {
    const uri = await voice.stopRecording();
    if (!uri) return;
    setTranscribing(true);
    const res = await transcribeAudio(uri);
    setTranscribing(false);
    if (!res.ok || !res.text) {
      Alert.alert(
        'Voice failed',
        'Whisper proxy unavailable. Type the summary instead or deploy the Edge Function.',
      );
      return;
    }
    setSummary((prev) => (prev ? `${prev}\n\n${res.text}` : res.text));
  }

  async function onGenerate() {
    if (!user) return;
    if (!summary.trim()) {
      Alert.alert('Add a summary first', 'Record or type a brief summary of the work done.');
      return;
    }
    setConfirming(true);
    try {
      let sid = sessionId;

      // Path B: create standalone session row
      if (!sid) {
        if (!jobName.trim()) {
          setConfirming(false);
          Alert.alert('Name the job', 'Type a name before generating.');
          return;
        }
        const { data, error } = await supabase
          .from('job_sessions')
          .insert({
            user_id: user.id,
            trade_type: tradeType || 'plumber',
            session_source: 'report_standalone',
            status: 'completed',
            closed_at: new Date().toISOString(),
            job_name: jobName.trim(),
          })
          .select()
          .single();
        if (error || !data) throw error;
        sid = data.id;
        setSessionId(sid);
      }

      const prefs = await loadPrefs(user.id, 'report');
      const d = await createReportDraft(sid!, user.id, summary.trim(), prefs);
      setDraft(d);
    } catch (e: any) {
      Alert.alert('Could not start report', e?.message ?? 'Unknown error');
    } finally {
      setConfirming(false);
    }
  }

  function onSectionContentChange(id: string, content: string) {
    if (!draft) return;
    const next = {
      ...draft,
      sections: draft.sections.map((s) => (s.id === id ? { ...s, content } : s)),
    };
    setDraft(next);
    saveReportDraft(next);
  }

  function onAddCustomSection() {
    if (!draft) return;
    const id = `c-${Date.now()}`;
    const next: ReportDraft = {
      ...draft,
      sections: [
        ...draft.sections,
        { id, name: 'Custom section', content: '', custom: true },
      ],
    };
    setDraft(next);
    saveReportDraft(next);
  }

  function onRemoveSection(id: string) {
    if (!draft) return;
    const next: ReportDraft = {
      ...draft,
      sections: draft.sections.filter((s) => s.id !== id),
    };
    setDraft(next);
    saveReportDraft(next);
  }

  async function doConfirm() {
    if (!draft || !profile) return;
    Alert.alert(
      'Confirm and lock?',
      'This action permanently locks all sections. The report cannot be edited after confirming.',
      [
        { text: 'Cancel' },
        {
          text: 'Confirm and generate PDF',
          onPress: async () => {
            setConfirming(true);
            try {
              const { pdfUri } = await confirmReport(draft, profile);
              setPdfUri(pdfUri);
              Alert.alert('Report confirmed', 'PDF generated and locked.');
            } catch (e: any) {
              Alert.alert('Confirm failed', e?.message ?? 'Unknown error');
            } finally {
              setConfirming(false);
            }
          },
        },
      ],
    );
  }

  async function onSavePrefs(sections: string[]) {
    if (!user) return;
    setPrefsSections(sections);
    await savePrefs(user.id, 'report', { sections });
    setPickerVisible(false);
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pt-12 pb-10">
      <View className="flex-row items-center justify-between mb-2">
        <Pressable onPress={() => nav.goBack()}>
          <Text className="text-brand text-base">← Back</Text>
        </Pressable>
        <Text className="text-base font-semibold">
          Report {incomingSessionId ? 'Path A' : 'Path B'}
        </Text>
        <View className="w-12" />
      </View>

      <SectionPicker
        visible={pickerVisible && prefsLoaded}
        title="Report sections"
        defaultSections={DEFAULT_REPORT_SECTIONS}
        onConfirm={onSavePrefs}
        onCancel={() => setPickerVisible(false)}
      />

      {!draft ? (
        <View>
          {!incomingSessionId && (
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">Job name</Text>
              <TextInput
                value={jobName}
                onChangeText={setJobName}
                placeholder="e.g. 122 Main St — leaking water heater"
                className="border border-gray-300 rounded-lg px-3 py-3 text-base"
              />
            </View>
          )}

          <Text className="text-sm font-semibold text-brand mb-1">Voice summary</Text>
          <Text className="text-xs text-gray-500 mb-2">
            {incomingSessionId
              ? 'Record a brief summary of the work done — Rex already has the session details.'
              : 'Describe the job in full — Rex will draft the report from this.'}
          </Text>

          <TextInput
            value={summary}
            onChangeText={setSummary}
            multiline
            placeholder="Type or use the mic below…"
            className="border border-gray-300 rounded-lg px-3 py-3 text-base min-h-[120px] mb-3"
          />

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

          <Pressable
            onPress={onGenerate}
            disabled={!summary.trim() || confirming}
            className={`py-4 rounded-xl ${
              !summary.trim() || confirming ? 'bg-gray-300' : 'bg-brand'
            }`}
          >
            <Text className="text-center text-white font-semibold text-base">
              {confirming ? 'Working…' : 'Generate report'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <ReportPreview
            sections={draft.sections}
            confirmedAmount={draft.confirmedAmount}
            includesVat={draft.includesVat}
            includesLicense={draft.includesLicense}
            onSectionContentChange={onSectionContentChange}
            onAddCustomSection={onAddCustomSection}
            onRemoveSection={onRemoveSection}
            onConfirmedAmountChange={(n) => {
              const next = { ...draft, confirmedAmount: n };
              setDraft(next);
              saveReportDraft(next);
            }}
            onIncludesVatChange={(v) => {
              const next = { ...draft, includesVat: v };
              setDraft(next);
              saveReportDraft(next);
            }}
            onIncludesLicenseChange={(v) => {
              const next = { ...draft, includesLicense: v };
              setDraft(next);
              saveReportDraft(next);
            }}
          />

          {pdfUri ? (
            <View className="mt-2 gap-2">
              <View className="bg-green-50 border border-green-200 rounded-lg p-3">
                <Text className="text-green-800 font-semibold">Report locked ✓</Text>
                <Text className="text-green-700 text-xs">
                  Saved to Job History. Cannot be edited.
                </Text>
              </View>
              <Pressable
                onPress={() => sharePdf(pdfUri, 'Job Report')}
                className="bg-brand py-4 rounded-xl"
              >
                <Text className="text-center text-white font-semibold">Share PDF</Text>
              </Pressable>
              {sessionId && (
                <Pressable
                  onPress={() =>
                    nav.replace('QuoteBuilder', { sessionId })
                  }
                  className="py-4 rounded-xl border border-brand"
                >
                  <Text className="text-center text-brand font-semibold">
                    Generate quote from this job
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Pressable
              onPress={doConfirm}
              disabled={confirming}
              className={`mt-2 py-4 rounded-xl ${confirming ? 'bg-gray-300' : 'bg-brand'}`}
            >
              <Text className="text-center text-white font-semibold text-base">
                {confirming ? 'Locking…' : 'Confirm & generate PDF'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}
