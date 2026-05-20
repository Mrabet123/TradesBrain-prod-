// D6 Flow04 + Flow12 — Active Rex session screen.
// Owns: messages list, streaming bubble, contextual buttons (stage-aware),
// apprentice Yes/No prompt, input row (text + voice + photo), Close Job (with
// job-naming modal), Report/Quote buttons (post-close), soft-cap banner with
// linked-session action, offline send queue, and the trial-exhaustion notice.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
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
import { useOfflineQueue, type QueuedMessage } from '../../hooks/useOfflineQueue';
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
  const recapOnLoad = route.params.recap === true;

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
  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [closeName, setCloseName] = useState('');
  const [linking, setLinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Trial gate. A trial user who has run out gets an in-thread notice (D6 S8) —
  // the session is preserved. expired/cancelled users go straight to Paywall.
  const trialExhausted = subscriptionStatus === 'trial' && trialQueriesRemaining <= 0;
  const subscriptionLapsed =
    subscriptionStatus !== 'active' && subscriptionStatus !== 'trial';

  useEffect(() => {
    if (subscriptionLapsed && !rex.closed) {
      nav.navigate('Paywall');
    }
  }, [subscriptionLapsed, rex.closed, nav]);

  // ── Offline send queue (D6 Flow12 S4-S7) ──────────────────────────────────
  const flushQueued = useCallback(
    (msg: QueuedMessage) =>
      rex.sendMessage({
        text: msg.text,
        photoUri: msg.photoUri,
        photoBase64: msg.photoBase64,
        photoMime: msg.photoMime,
        transcriptOriginal: msg.transcriptOriginal,
        transcriptEdited: msg.transcriptEdited,
      }),
    [rex.sendMessage],
  );
  const offlineQueue = useOfflineQueue(rex.session?.id ?? null, flushQueued);

  // Auto-scroll on new message / chunk
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [rex.messages.length, rex.streamingText, offlineQueue.queued]);

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
  }

  async function handleSend() {
    if ((!text.trim() && !pendingPhoto) || rex.streaming || trialExhausted) return;
    const payload = {
      text: text.trim() || (pendingPhoto ? '[Photo attached]' : ''),
      photoUri: pendingPhoto?.uri ?? null,
      photoBase64: pendingPhoto?.base64 ?? null,
      photoMime: pendingPhoto?.mime ?? null,
      transcriptOriginal: transcript,
      transcriptEdited: transcript && transcript !== text ? text : null,
    };
    setText('');
    setPendingPhoto(null);
    setTranscript(null);

    // Offline → queue locally; useOfflineQueue auto-flushes on reconnect.
    if (!isConnected) {
      try {
        await offlineQueue.enqueue(payload);
      } catch {
        Alert.alert('Offline', 'Could not queue the message — try again when back online.');
      }
      return;
    }
    await rex.sendMessage(payload);
  }

  function openCloseModal() {
    setCloseName(rex.session?.jobName ?? '');
    setCloseModalVisible(true);
  }

  async function confirmClose() {
    setCloseModalVisible(false);
    await rex.closeJob(closeName);
  }

  // Intercept the Stage-5 "Close job" button so it goes through the naming modal.
  function handleContextual(action: string) {
    if (action === 'close_job') {
      openCloseModal();
      return;
    }
    rex.onContextualAction(action);
  }

  async function onStartLinkedSession() {
    setLinking(true);
    const newId = await rex.startLinkedSession();
    setLinking(false);
    if (newId) nav.replace('Job', { sessionId: newId });
  }

  const apprenticePending =
    rex.apprenticeAsked && !rex.apprenticeAnswered && !rex.streaming && !rex.closed;
  const inputDisabled = rex.streaming || trialExhausted;

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
            <Pressable onPress={openCloseModal}>
              <Text className="text-red-600 text-base font-semibold">Close Job</Text>
            </Pressable>
          ) : (
            <Text className="text-green-700 text-base font-semibold">Closed</Text>
          )}
        </View>

        {/* Offline indicator */}
        {!isConnected && (
          <View className="bg-gray-100 border-b border-gray-200 px-4 py-1.5">
            <Text className="text-gray-600 text-xs">
              Offline — messages will queue and send when you reconnect.
            </Text>
          </View>
        )}
        {offlineQueue.queued > 0 && (
          <View className="bg-blue-50 border-b border-blue-200 px-4 py-1.5">
            <Text className="text-blue-700 text-xs">
              {offlineQueue.queued} message{offlineQueue.queued > 1 ? 's' : ''} queued
              {offlineQueue.flushing ? ' — sending…' : ''}
            </Text>
          </View>
        )}

        {/* Soft cap banners */}
        {rex.softCapReached && (
          <View className="bg-red-50 border-b border-red-200 px-4 py-2">
            <Text className="text-red-700 text-sm mb-2">
              Session reached 30 messages. Start a linked session to continue with
              compressed context.
            </Text>
            <Pressable
              onPress={onStartLinkedSession}
              disabled={linking}
              className={`py-2 rounded-lg ${linking ? 'bg-gray-300' : 'bg-red-600'}`}
            >
              <Text className="text-center text-white font-semibold text-sm">
                {linking ? 'Starting…' : 'Start linked session'}
              </Text>
            </Pressable>
          </View>
        )}
        {rex.softCapWarning && !rex.softCapReached && (
          <View className="bg-amber-50 border-b border-amber-200 px-4 py-2">
            <Text className="text-amber-700 text-sm">
              Approaching session limit — Rex will summarise soon.
            </Text>
          </View>
        )}

        {/* Error — with a Retry that re-runs the failed turn (D8 TC-058-060) */}
        {rex.error && (
          <View className="bg-red-50 border-b border-red-200 px-4 py-2">
            <Text className="text-red-700 text-sm">{rex.error}</Text>
            {rex.canRetry && (
              <Pressable
                onPress={rex.retry}
                className="mt-1.5 self-start bg-red-600 px-4 py-1.5 rounded-lg"
              >
                <Text className="text-white font-semibold text-sm">Retry</Text>
              </Pressable>
            )}
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
          {rex.streaming && <StreamingText text={rex.streamingText} isStreaming={true} />}
        </ScrollView>

        {/* Apprentice mode prompt (D7 APPRENTICE DETECTION) */}
        {apprenticePending && (
          <View className="border-t border-gray-200 px-4 py-3 bg-indigo-50">
            <Text className="text-sm text-indigo-900 font-medium mb-2">
              Want Rex to walk through each step in more detail as you go?
            </Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => rex.onApprenticeAnswer(true)}
                className="flex-1 bg-brand py-2.5 rounded-lg"
              >
                <Text className="text-center text-white font-semibold text-sm">
                  Yes, walk me through
                </Text>
              </Pressable>
              <Pressable
                onPress={() => rex.onApprenticeAnswer(false)}
                className="flex-1 border border-gray-300 py-2.5 rounded-lg"
              >
                <Text className="text-center text-gray-700 font-semibold text-sm">
                  No, standard detail
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Contextual buttons */}
        {!rex.closed && !rex.streaming && !apprenticePending && rex.messages.length > 0 && (
          <ContextualButtons
            stage={rex.stage}
            disabled={rex.streaming}
            onPress={handleContextual}
          />
        )}

        {/* Trial exhaustion notice (D6 Flow12 S8) — session preserved */}
        {trialExhausted && !rex.closed && (
          <View className="bg-amber-50 border-t border-amber-200 px-4 py-3">
            <Text className="text-amber-800 font-semibold text-sm mb-1">
              Free trial complete
            </Text>
            <Text className="text-amber-700 text-xs mb-2">
              You've used all 10 free Rex queries. This session is saved — subscribe to
              keep going.
            </Text>
            <Pressable
              onPress={() => nav.navigate('Paywall')}
              className="bg-brand py-2.5 rounded-lg"
            >
              <Text className="text-center text-white font-semibold text-sm">View plans</Text>
            </Pressable>
          </View>
        )}

        {/* Post-close: Report + Quote buttons (D6 Flow04 — never during active session) */}
        {rex.canShowReportQuote && rex.session && (
          <View className="flex-row gap-2 px-3 pb-2">
            <Pressable
              onPress={() => nav.navigate('ReportBuilder', { sessionId: rex.session!.id })}
              className="flex-1 bg-brand py-3 rounded-xl"
            >
              <Text className="text-center text-white font-semibold">Generate report</Text>
            </Pressable>
            <Pressable
              onPress={() => nav.navigate('QuoteBuilder', { sessionId: rex.session!.id })}
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
            <Text className="text-sm text-gray-600 flex-1">
              Photo ready — will send with your message
            </Text>
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
                  trialExhausted
                    ? 'Free trial complete — subscribe to continue'
                    : rex.streaming
                    ? 'Rex is responding…'
                    : isConnected
                    ? 'Type a message to Rex'
                    : 'Offline — message will queue'
                }
                editable={!inputDisabled}
                multiline
                className="flex-1 border border-gray-300 rounded-2xl px-3 py-2 text-base max-h-32"
              />
              <Pressable
                onPress={handleSend}
                disabled={inputDisabled || (!text.trim() && !pendingPhoto)}
                className={`px-4 py-3 rounded-full ${
                  inputDisabled || (!text.trim() && !pendingPhoto) ? 'bg-gray-300' : 'bg-brand'
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
                <Text className="text-[11px] text-amber-600">Text input still works.</Text>
              </View>
            )}
            <View className="flex-row gap-2 mt-2">
              <VoiceRecordButton
                isRecording={voice.isRecording}
                disabled={inputDisabled || voiceDenied}
                onPressIn={handleVoiceStart}
                onPressOut={handleVoiceStop}
              />
              <PhotoCapture
                disabled={inputDisabled || photo.permissionDenied}
                onCapture={handlePhoto}
              />
            </View>
          </View>
        )}
      </View>

      {/* Close-job modal — Stage 5 job naming (D6 Flow04) */}
      <Modal
        visible={closeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCloseModalVisible(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-8">
          <View className="bg-white rounded-2xl p-5 w-full">
            <Text className="text-lg font-bold text-gray-900 mb-1">Close this job</Text>
            <Text className="text-sm text-gray-500 mb-3">
              Name the job so you can find it in History. Report and Quote become
              available after closing.
            </Text>
            <TextInput
              value={closeName}
              onChangeText={setCloseName}
              placeholder="e.g. 122 Main St — water heater"
              className="border border-gray-300 rounded-lg px-3 py-3 text-base mb-4"
            />
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setCloseModalVisible(false)}
                className="flex-1 border border-gray-300 py-3 rounded-xl"
              >
                <Text className="text-center text-gray-700 font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmClose}
                disabled={!closeName.trim()}
                className={`flex-1 py-3 rounded-xl ${
                  closeName.trim() ? 'bg-red-600' : 'bg-gray-300'
                }`}
              >
                <Text className="text-center text-white font-semibold">Close job</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
