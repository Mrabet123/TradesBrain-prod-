// D6 Flow04 + Flow12 — Active Rex session screen.
// Owns: messages list, streaming bubble, contextual buttons (stage-aware),
// input row (text + voice + photo), Close Job button (always visible from
// Stage 1), Report/Quote buttons (post-close only), soft-cap banners.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';

import MessageBubble from '../../components/rex/MessageBubble';
import StreamingText from '../../components/rex/StreamingText';
import VoiceRecordButton from '../../components/rex/VoiceRecordButton';
import PhotoCapture from '../../components/rex/PhotoCapture';
import ContextualButtons from '../../components/rex/ContextualButtons';

import { useAuthContext } from '../../context/AuthContext';
import { useTradeProfileContext } from '../../context/TradeProfileContext';
import { useSubscriptionContext } from '../../context/SubscriptionContext';
import { useRexSession } from '../../hooks/useRexSession';
import { useVoiceRecording } from '../../hooks/useVoiceRecording';
import { usePhotoCapture, type CapturedPhoto } from '../../hooks/usePhotoCapture';
import { transcribeAudio } from '../../services/openai';
import { useNetworkContext } from '../../context/NetworkContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RouteT = RouteProp<RootStackParamList, 'Job'>;

export default function ActiveSessionScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { user } = useAuthContext();
  const { tradeType } = useTradeProfileContext();
  const { subscriptionStatus, trialQueriesRemaining } = useSubscriptionContext();

  const sessionId = route.params.sessionId === 'new' ? null : route.params.sessionId;
  const recapOnLoad = (route.params as any)?.recap === true;

  const rex = useRexSession({
    sessionId,
    tradeType: tradeType || 'plumber',
    userId: user?.id ?? '',
    recapOnLoad,
  });

  const voice = useVoiceRecording();
  const photo = usePhotoCapture();
  const { isConnected } = useNetworkContext();

  const [text, setText] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState<CapturedPhoto | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceDenied, setVoiceDenied] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // SubscriptionGate pre-condition: paywall before camera/voice opens.
  const hasAccess =
    subscriptionStatus === 'active' ||
    (subscriptionStatus === 'trial' && trialQueriesRemaining > 0);

  useEffect(() => {
    if (!hasAccess && !rex.closed) {
      // D6 Flow12 S9 — paywall over active session, session preserved on dismiss
      nav.navigate('Paywall');
    }
  }, [hasAccess, rex.closed, nav]);

  // Auto-scroll on new message / chunk
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [rex.messages.length, rex.streamingText]);

  async function handleVoiceStart() {
    try {
      await voice.startRecording();
      setVoiceDenied(false);
    } catch {
      setVoiceDenied(true);
    }
  }

  async function handleVoiceStop() {
    const uri = await voice.stopRecording();
    if (!uri) return;
    setTranscribing(true);
    const result = await transcribeAudio(uri);
    setTranscribing(false);
    if (!result.ok || !result.text) {
      Alert.alert('Voice failed', 'Could not transcribe — please try again or use text.');
      return;
    }
    setTranscript(result.text);
    setText(result.text);
  }

  async function handlePhoto() {
    const result = await photo.capture(rex.stage);
    if (result.photo) setPendingPhoto(result.photo);
    // Permission-denied state is surfaced via photo.permissionDenied below.
  }

  async function handleSend() {
    if (!text.trim() && !pendingPhoto) return;
    const photoSnapshot = pendingPhoto;
    const transcriptSnapshot = transcript;
    setText('');
    setPendingPhoto(null);
    setTranscript(null);
    await rex.sendMessage({
      text: text.trim() || (photoSnapshot ? '[Photo attached]' : ''),
      photoUri: photoSnapshot?.uri ?? null,
      photoBase64: photoSnapshot?.base64 ?? null,
      photoMime: photoSnapshot?.mime ?? null,
      transcriptOriginal: transcriptSnapshot,
      transcriptEdited: transcriptSnapshot && transcriptSnapshot !== text ? text : null,
    });
  }

  function onClose() {
    Alert.alert('Close this job?', 'Report and Quote become available after closing.', [
      { text: 'Cancel' },
      { text: 'Close job', onPress: rex.closeJob },
    ]);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <View className="flex-1 bg-white pt-12">
        {/* Header */}
        <View className="px-4 pb-2 flex-row items-center justify-between border-b border-gray-200">
          <Pressable onPress={() => nav.goBack()}>
            <Text className="text-brand text-base">← Back</Text>
          </Pressable>
          <Text className="text-base font-semibold">Rex · Stage {rex.stage}</Text>
          {!rex.closed ? (
            <Pressable onPress={onClose}>
              <Text className="text-red-600 text-base font-semibold">Close Job</Text>
            </Pressable>
          ) : (
            <Text className="text-green-700 text-base font-semibold">Closed</Text>
          )}
        </View>

        {/* Soft cap banners */}
        {rex.softCapReached && (
          <View className="bg-red-50 border-b border-red-200 px-4 py-2">
            <Text className="text-red-700 text-sm">
              Session reached 30 messages — start a linked session to continue with compressed context.
            </Text>
          </View>
        )}
        {rex.softCapWarning && !rex.softCapReached && (
          <View className="bg-amber-50 border-b border-amber-200 px-4 py-2">
            <Text className="text-amber-700 text-sm">
              Approaching session limit — Rex will summarise soon.
            </Text>
          </View>
        )}

        {/* Error */}
        {rex.error && (
          <View className="bg-red-50 border-b border-red-200 px-4 py-2">
            <Text className="text-red-700 text-sm">{rex.error}</Text>
          </View>
        )}

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="py-2"
          keyboardShouldPersistTaps="handled"
        >
          {rex.messages.map((m) => (
            <MessageBubble
              key={m.id}
              role={m.role}
              content={m.contentText ?? ''}
              photoUrl={m.photoUrl}
              transcript={m.transcriptEdited ?? m.transcriptOriginal}
            />
          ))}
          {rex.streaming && (
            <StreamingText text={rex.streamingText} isStreaming={true} />
          )}
        </ScrollView>

        {/* Contextual buttons */}
        {!rex.closed && !rex.streaming && rex.messages.length > 0 && (
          <ContextualButtons
            stage={rex.stage}
            disabled={rex.streaming}
            onPress={rex.onContextualAction}
          />
        )}

        {/* Post-close: Report + Quote buttons (D6 Flow04 — never during active session) */}
        {rex.canShowReportQuote && rex.session && (
          <View className="flex-row gap-2 px-3 pb-2">
            <Pressable
              onPress={() =>
                nav.navigate('ReportBuilder', { sessionId: rex.session!.id })
              }
              className="flex-1 bg-brand py-3 rounded-xl"
            >
              <Text className="text-center text-white font-semibold">Generate report</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                nav.navigate('QuoteBuilder', { sessionId: rex.session!.id })
              }
              className="flex-1 bg-green-600 py-3 rounded-xl"
            >
              <Text className="text-center text-white font-semibold">Generate quote</Text>
            </Pressable>
          </View>
        )}

        {/* Pending photo preview */}
        {pendingPhoto && !rex.closed && (
          <View className="flex-row items-center px-3 py-2 border-t border-gray-200">
            <Image
              source={{ uri: pendingPhoto.uri }}
              className="w-14 h-14 rounded-md mr-3"
              resizeMode="cover"
            />
            <Text className="text-sm text-gray-600 flex-1">Photo ready — will send with your message</Text>
            <Pressable onPress={() => setPendingPhoto(null)}>
              <Text className="text-red-600 font-semibold">Remove</Text>
            </Pressable>
          </View>
        )}

        {/* Input row */}
        {!rex.closed && (
          <View className="border-t border-gray-200 px-3 py-2 bg-white">
            {transcribing && (
              <View className="flex-row items-center mb-2">
                <ActivityIndicator size="small" />
                <Text className="text-xs text-gray-500 ml-2">Transcribing…</Text>
              </View>
            )}
            <View className="flex-row items-end gap-2">
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={
                  rex.streaming ? 'Rex is responding…' : 'Type a message to Rex'
                }
                editable={!rex.streaming}
                multiline
                className="flex-1 border border-gray-300 rounded-2xl px-3 py-2 text-base max-h-32"
              />
              <Pressable
                onPress={handleSend}
                disabled={rex.streaming || (!text.trim() && !pendingPhoto)}
                className={`px-4 py-3 rounded-full ${
                  rex.streaming || (!text.trim() && !pendingPhoto)
                    ? 'bg-gray-300'
                    : 'bg-brand'
                }`}
              >
                <Text className="text-white font-semibold">Send</Text>
              </Pressable>
            </View>
            {(photo.permissionDenied || voiceDenied) && (
              <View className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 mb-2">
                <Text className="text-xs text-amber-700">
                  {photo.permissionDenied && voiceDenied
                    ? 'Camera and microphone access denied'
                    : photo.permissionDenied
                    ? 'Camera access denied'
                    : 'Microphone access denied'}
                  {' — '}
                  <Text
                    onPress={() => Linking.openSettings()}
                    className="font-semibold underline"
                  >
                    Open Settings
                  </Text>
                </Text>
                <Text className="text-[11px] text-amber-600">
                  Text input still works.
                </Text>
              </View>
            )}
            <View className="flex-row gap-2 mt-2">
              <VoiceRecordButton
                isRecording={voice.isRecording}
                disabled={rex.streaming || voiceDenied}
                onPressIn={handleVoiceStart}
                onPressOut={handleVoiceStop}
              />
              <PhotoCapture
                disabled={rex.streaming || photo.permissionDenied}
                onCapture={handlePhoto}
              />
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
