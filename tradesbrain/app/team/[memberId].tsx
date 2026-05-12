// D6 Flow11 — Member Detail (4 read-only tabs).
// Rex (sessions list) · Reports · Quotes · Photos — all aggregated across the
// member's job_sessions. RLS (migration 00004) grants the owner SELECT but
// not UPDATE, so even direct API attempts to edit would 403 (RULE 3).

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  Linking,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';
import { supabase } from '../../services/supabase';
import { sharePdf } from '../../services/share';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RouteT = RouteProp<RootStackParamList, 'TeamMemberDetail'>;

type Tab = 'rex' | 'reports' | 'quotes' | 'photos';
const TABS: { value: Tab; label: string }[] = [
  { value: 'rex', label: 'Rex' },
  { value: 'reports', label: 'Reports' },
  { value: 'quotes', label: 'Quotes' },
  { value: 'photos', label: 'Photos' },
];

interface MemberProfile {
  fullName: string;
  email: string;
  tradeType: string;
  national_id_kyc_status: string;
  license_kyc_status: string;
}

interface SessionRow {
  id: string;
  jobName: string | null;
  jobsite: string | null;
  createdAt: string;
  status: string;
  messageCount: number;
}

interface DocRow {
  id: string;
  versionNumber: number;
  status: string;
  pdfUrl: string | null;
  createdAt: string;
  sessionId: string;
  amount: number | null;
}

interface PhotoRow {
  id: string;
  uri: string;
  sessionId: string;
  createdAt: string;
  stage: number | null;
}

export default function TeamMemberDetail() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const memberId = route.params.memberId;

  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [reports, setReports] = useState<DocRow[]>([]);
  const [quotes, setQuotes] = useState<DocRow[]>([]);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [active, setActive] = useState<Tab>('rex');
  const [photoModal, setPhotoModal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [u, s, r, q, p] = await Promise.all([
      supabase
        .from('users')
        .select(
          'full_name, email, trade_type, national_id_kyc_status, license_kyc_status',
        )
        .eq('id', memberId)
        .single(),
      supabase
        .from('job_sessions')
        .select('id, job_name, jobsite, created_at, status, message_count')
        .eq('user_id', memberId)
        .order('created_at', { ascending: false }),
      supabase
        .from('job_reports')
        .select('id, version_number, status, pdf_url, created_at, session_id, confirmed_amount')
        .eq('user_id', memberId)
        .eq('status', 'finalised')
        .order('created_at', { ascending: false }),
      supabase
        .from('quotes')
        .select('id, version_number, status, pdf_url, created_at, session_id, confirmed_total')
        .eq('user_id', memberId)
        .eq('status', 'finalised')
        .order('created_at', { ascending: false }),
      supabase
        .from('messages')
        .select('id, photo_url, created_at, session_id, session_stage, job_sessions!inner(user_id)')
        .eq('job_sessions.user_id', memberId)
        .not('photo_url', 'is', null)
        .order('created_at', { ascending: false }),
    ]);

    if (u.data) {
      setProfile({
        fullName: u.data.full_name,
        email: u.data.email,
        tradeType: u.data.trade_type,
        national_id_kyc_status: u.data.national_id_kyc_status,
        license_kyc_status: u.data.license_kyc_status,
      });
    }
    setSessions(
      (s.data ?? []).map((row: any) => ({
        id: row.id,
        jobName: row.job_name,
        jobsite: row.jobsite,
        createdAt: row.created_at,
        status: row.status,
        messageCount: row.message_count,
      })),
    );
    setReports(
      (r.data ?? []).map((row: any) => ({
        id: row.id,
        versionNumber: row.version_number,
        status: row.status,
        pdfUrl: row.pdf_url,
        createdAt: row.created_at,
        sessionId: row.session_id,
        amount: row.confirmed_amount,
      })),
    );
    setQuotes(
      (q.data ?? []).map((row: any) => ({
        id: row.id,
        versionNumber: row.version_number,
        status: row.status,
        pdfUrl: row.pdf_url,
        createdAt: row.created_at,
        sessionId: row.session_id,
        amount: row.confirmed_total,
      })),
    );
    setPhotos(
      (p.data ?? []).map((row: any) => ({
        id: row.id,
        uri: row.photo_url,
        sessionId: row.session_id,
        createdAt: row.created_at,
        stage: row.session_stage,
      })),
    );
    setLoading(false);
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  async function openPdf(path: string | null) {
    if (!path) return;
    const { data } = await supabase.storage
      .from('job-documents')
      .createSignedUrl(path, 60 * 60);
    if (!data?.signedUrl) {
      Alert.alert('Could not load PDF', 'The file may have been removed.');
      return;
    }
    Linking.openURL(data.signedUrl);
  }

  async function shareDoc(path: string | null) {
    if (!path) return;
    const { data } = await supabase.storage
      .from('job-documents')
      .createSignedUrl(path, 60 * 60);
    if (!data?.signedUrl) return;
    sharePdf(data.signedUrl, 'Team member document');
  }

  if (loading || !profile) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white pt-12">
      <View className="px-4 pb-2 border-b border-gray-200">
        <View className="flex-row items-center justify-between mb-2">
          <Pressable onPress={() => nav.goBack()}>
            <Text className="text-brand text-base">← Back</Text>
          </Pressable>
          <Text className="text-base font-semibold flex-1 text-center">
            {profile.fullName}
          </Text>
          <View className="w-12" />
        </View>
        <Text className="text-xs text-gray-500 mb-2 text-center">
          {profile.tradeType} · {profile.email}
        </Text>
        <View className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-2">
          <Text className="text-[11px] text-amber-700 text-center">
            👁 Owner view — all content is read-only
          </Text>
        </View>

        <View className="flex-row border-b border-gray-100 -mx-4 px-4">
          {TABS.map((t) => (
            <Pressable
              key={t.value}
              onPress={() => setActive(t.value)}
              className={`flex-1 py-2 ${
                active === t.value ? 'border-b-2 border-brand' : ''
              }`}
            >
              <Text
                className={`text-center text-sm ${
                  active === t.value ? 'text-brand font-semibold' : 'text-gray-500'
                }`}
              >
                {t.label}
                {t.value === 'rex' && sessions.length > 0 ? ` (${sessions.length})` : ''}
                {t.value === 'reports' && reports.length > 0 ? ` (${reports.length})` : ''}
                {t.value === 'quotes' && quotes.length > 0 ? ` (${quotes.length})` : ''}
                {t.value === 'photos' && photos.length > 0 ? ` (${photos.length})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {active === 'rex' && (
        <ScrollView className="flex-1" contentContainerClassName="px-4 py-4">
          {sessions.length === 0 ? (
            <Text className="text-center text-gray-400 mt-6">
              No sessions yet.
            </Text>
          ) : (
            sessions.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => nav.navigate('JobDetail', { jobId: s.id })}
                className="bg-white border border-gray-200 rounded-xl p-3 mb-2"
              >
                <Text className="text-sm font-semibold text-gray-900">
                  {s.jobName || 'Untitled job'}
                </Text>
                <Text className="text-xs text-gray-500">
                  {new Date(s.createdAt).toLocaleString()} · {s.status} · {s.messageCount} msgs
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {active === 'reports' && (
        <ScrollView className="flex-1" contentContainerClassName="px-4 py-4">
          {reports.length === 0 ? (
            <Text className="text-center text-gray-400 mt-6">
              No confirmed reports yet.
            </Text>
          ) : (
            reports.map((r) => (
              <DocRowView
                key={r.id}
                kind="report"
                row={r}
                onOpen={() => openPdf(r.pdfUrl)}
                onShare={() => shareDoc(r.pdfUrl)}
              />
            ))
          )}
        </ScrollView>
      )}

      {active === 'quotes' && (
        <ScrollView className="flex-1" contentContainerClassName="px-4 py-4">
          {quotes.length === 0 ? (
            <Text className="text-center text-gray-400 mt-6">
              No confirmed quotes yet.
            </Text>
          ) : (
            quotes.map((q) => (
              <DocRowView
                key={q.id}
                kind="quote"
                row={q}
                onOpen={() => openPdf(q.pdfUrl)}
                onShare={() => shareDoc(q.pdfUrl)}
              />
            ))
          )}
        </ScrollView>
      )}

      {active === 'photos' && (
        <ScrollView className="flex-1" contentContainerClassName="p-4">
          {photos.length === 0 ? (
            <Text className="text-center text-gray-400 mt-6">No photos yet.</Text>
          ) : (
            <View className="flex-row flex-wrap -mx-1">
              {photos.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setPhotoModal(p.uri)}
                  className="w-1/3 aspect-square p-1"
                >
                  <Image
                    source={{ uri: p.uri }}
                    className="w-full h-full rounded-md"
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={!!photoModal}
        animationType="fade"
        onRequestClose={() => setPhotoModal(null)}
        transparent
      >
        <Pressable
          onPress={() => setPhotoModal(null)}
          className="flex-1 bg-black items-center justify-center"
        >
          {photoModal && (
            <Image
              source={{ uri: photoModal }}
              style={{ width: '100%', height: '85%' }}
              resizeMode="contain"
            />
          )}
          <Text className="text-white mt-4">Tap to close</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

function DocRowView({
  row,
  kind,
  onOpen,
  onShare,
}: {
  row: DocRow;
  kind: 'report' | 'quote';
  onOpen: () => void;
  onShare: () => void;
}) {
  return (
    <View className="bg-white border border-gray-200 rounded-xl p-3 mb-2">
      <Text className="text-sm font-semibold text-gray-900">
        {kind === 'report' ? 'Report' : 'Quote'} {row.versionNumber}
        {row.amount != null ? ` · $${Number(row.amount).toFixed(2)}` : ''}
      </Text>
      <Text className="text-xs text-gray-500 mb-2">
        {new Date(row.createdAt).toLocaleString()}
      </Text>
      <View className="flex-row gap-2">
        <Pressable
          onPress={onOpen}
          disabled={!row.pdfUrl}
          className={`flex-1 py-2 rounded-lg ${row.pdfUrl ? 'bg-brand' : 'bg-gray-300'}`}
        >
          <Text className="text-center text-white font-semibold text-sm">
            View / Download
          </Text>
        </Pressable>
        <Pressable
          onPress={onShare}
          disabled={!row.pdfUrl}
          className={`flex-1 py-2 rounded-lg border ${
            row.pdfUrl ? 'border-brand' : 'border-gray-300'
          }`}
        >
          <Text
            className={`text-center font-semibold text-sm ${
              row.pdfUrl ? 'text-brand' : 'text-gray-400'
            }`}
          >
            Share
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
