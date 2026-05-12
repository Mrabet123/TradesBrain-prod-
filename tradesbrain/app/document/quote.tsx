// D3 F3, D6 Flow06 — Quote builder screen.
// Path A: route params { sessionId } — reuses report data if a report exists.
// Path B: no sessionId — standalone quote, creates session_source='quote_standalone'.

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
  createQuoteDraft,
  saveQuoteDraft,
  discardQuoteDraft,
  confirmQuote,
  loadPrefs,
  savePrefs,
  quoteSubtotal,
  type QuoteDraft,
  type QuoteLineItem,
  type ProfileBlock,
} from '../../services/documents';
import { sharePdf } from '../../services/share';
import { useAuthContext } from '../../context/AuthContext';
import { useTradeProfileContext } from '../../context/TradeProfileContext';
import QuotePreview from '../../components/documents/QuotePreview';
import SectionPicker from '../../components/documents/SectionPicker';
import { DEFAULT_QUOTE_SECTIONS } from '../../constants/paymentMethods';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RouteT = RouteProp<RootStackParamList, 'QuoteBuilder'>;

export default function QuoteBuilderScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { user } = useAuthContext();
  const { tradeType, hourlyRate } = useTradeProfileContext();

  const incomingSessionId = route.params?.sessionId ?? null;
  const [sessionId, setSessionId] = useState<string | null>(incomingSessionId);
  const [jobName, setJobName] = useState('');

  const [pickerVisible, setPickerVisible] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileBlock | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [profileRes, prefs] = await Promise.all([
        supabase
          .from('users')
          .select('full_name, trade_type, hourly_rate, vat_number, license_number, company_name')
          .eq('id', user.id)
          .single(),
        loadPrefs(user.id, 'quote'),
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

      if (!prefs?.sections?.length) setPickerVisible(true);
      setPrefsLoaded(true);
      setLoading(false);
    })();
  }, [user]);

  // Discard prompt on back nav
  useEffect(() => {
    const unsub = nav.addListener('beforeRemove', (e) => {
      if (!draft || pdfUri || confirming) return;
      e.preventDefault();
      Alert.alert(
        'Discard quote?',
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
              await discardQuoteDraft(draft.id);
              nav.dispatch(e.data.action);
            },
          },
        ],
      );
    });
    return unsub;
  }, [nav, draft, pdfUri, confirming]);

  async function onGenerate() {
    if (!user || !profile) return;
    setConfirming(true);
    try {
      let sid = sessionId;

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
            session_source: 'quote_standalone',
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

      // Path A — reuse a prior report's confirmed_amount and time-on-site
      let seedLineItems: QuoteLineItem[] = [];
      let labourHoursSeed = 0;
      if (incomingSessionId) {
        const { data: report } = await supabase
          .from('job_reports')
          .select('confirmed_amount, sections_config')
          .eq('session_id', incomingSessionId)
          .eq('status', 'finalised')
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (report?.confirmed_amount) {
          seedLineItems = [
            { id: 'li-seed', name: 'Work completed (from report)', qty: 1, unitCost: Number(report.confirmed_amount) },
          ];
        }
        const { data: ses } = await supabase
          .from('job_sessions')
          .select('time_on_jobsite_seconds')
          .eq('id', incomingSessionId)
          .maybeSingle();
        if (ses?.time_on_jobsite_seconds) {
          labourHoursSeed = Math.round((ses.time_on_jobsite_seconds / 3600) * 10) / 10;
        }
      }

      const prefs = await loadPrefs(user.id, 'quote');
      const d = await createQuoteDraft(
        sid!,
        user.id,
        profile.hourlyRate || hourlyRate || 0,
        prefs,
        seedLineItems,
      );
      d.labourHours = labourHoursSeed;
      setDraft(d);
    } catch (e: any) {
      Alert.alert('Could not start quote', e?.message ?? 'Unknown error');
    } finally {
      setConfirming(false);
    }
  }

  function onDraftChange(next: QuoteDraft) {
    setDraft(next);
    saveQuoteDraft(next);
  }

  async function doConfirm() {
    if (!draft || !profile) return;
    Alert.alert(
      'Confirm and lock?',
      'This action permanently locks the quote. It cannot be edited after confirming.',
      [
        { text: 'Cancel' },
        {
          text: 'Confirm and generate PDF',
          onPress: async () => {
            setConfirming(true);
            try {
              const total = draft.confirmedTotal ?? quoteSubtotal(draft);
              const next: QuoteDraft = { ...draft, confirmedTotal: total };
              const { pdfUri } = await confirmQuote(next, profile);
              setDraft(next);
              setPdfUri(pdfUri);
              Alert.alert('Quote confirmed', 'PDF generated and locked.');
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
    await savePrefs(user.id, 'quote', { sections });
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
          Quote {incomingSessionId ? 'Path A' : 'Path B'}
        </Text>
        <View className="w-12" />
      </View>

      <SectionPicker
        visible={pickerVisible && prefsLoaded}
        title="Quote sections"
        defaultSections={DEFAULT_QUOTE_SECTIONS}
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
                placeholder="e.g. Bathroom remodel — 47 Oak Lane"
                className="border border-gray-300 rounded-lg px-3 py-3 text-base"
              />
            </View>
          )}

          <Text className="text-sm text-gray-600 mb-4">
            {incomingSessionId
              ? 'Rex pre-loads materials and labour hours from this session (and the latest confirmed report if one exists).'
              : 'A fresh quote. Add line items and labour below after generating.'}
          </Text>

          <Pressable
            onPress={onGenerate}
            disabled={confirming || (!incomingSessionId && !jobName.trim())}
            className={`py-4 rounded-xl ${
              confirming || (!incomingSessionId && !jobName.trim())
                ? 'bg-gray-300'
                : 'bg-brand'
            }`}
          >
            <Text className="text-center text-white font-semibold text-base">
              {confirming ? 'Working…' : 'Generate quote'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <QuotePreview draft={draft} onChange={onDraftChange} />

          {pdfUri ? (
            <View className="mt-2 gap-2">
              <View className="bg-green-50 border border-green-200 rounded-lg p-3">
                <Text className="text-green-800 font-semibold">Quote locked ✓</Text>
                <Text className="text-green-700 text-xs">
                  Saved to Job History. Cannot be edited.
                </Text>
              </View>
              <Pressable
                onPress={() => sharePdf(pdfUri, 'Quote')}
                className="bg-brand py-4 rounded-xl"
              >
                <Text className="text-center text-white font-semibold">Share PDF</Text>
              </Pressable>
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
