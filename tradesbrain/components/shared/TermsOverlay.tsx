// D6 Flow01 S6 — Terms of Use and Privacy Policy acknowledgement.
// Must be scrolled, I Agree button gated until scroll-to-end.
// Acceptance timestamp + version are persisted in users.terms_accepted_at /
// users.terms_version when createUserProfile() runs.

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { TERMS_VERSION } from '../../services/auth';

const TERMS_BODY = `TRADESBRAIN — TERMS OF USE AND PRIVACY POLICY (${TERMS_VERSION})

By creating a TradesBrain account, you agree to:

1. PLATFORM USE
TradesBrain provides an AI co-pilot ("Rex") to assist with jobsite diagnostics, report generation, and quote generation. Rex provides guidance; final professional judgement rests with you.

2. KYC / IDENTITY
You agree to provide a valid trade license proof and national identity document. These are stored securely and used only for verification.

3. SUBSCRIPTION
Free trial of 10 Rex queries is included. Continued access requires an active subscription per the plan you select. Cancellation rules are described in your billing settings.

4. TEAM PLAN DOWNGRADE
If you downgrade from Team plan to Solo plan, all team member accounts and their data are permanently deleted. This action is irreversible.

5. VAT NUMBER LOCK
Your VAT number is permanently locked after account creation. Contact support if a correction is required.

6. PRIVACY
We store jobsite photos, voice transcripts, and conversation history only to provide Rex's service. Your data is never sold. Aggregate, anonymised usage telemetry may be used to improve the product.

7. LIMITATION OF LIABILITY
TradesBrain is not liable for damages arising from reliance on Rex's output. Always verify against local trade codes.

8. CHANGES
We may update these terms. You will be asked to re-accept on material changes.

Version: ${TERMS_VERSION}
`;

interface Props {
  visible: boolean;
  onAgree: () => void;
  onClose: () => void;
}

export default function TermsOverlay({ visible, onAgree, onClose }: Props) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 20) {
      setScrolledToEnd(true);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-white pt-12 px-5 pb-6">
        <Text className="text-2xl font-bold mb-3">Terms of Use & Privacy Policy</Text>

        <ScrollView
          className="flex-1 border border-gray-200 rounded-lg p-3"
          onScroll={onScroll}
          scrollEventThrottle={64}
        >
          <Text className="text-sm text-gray-800 leading-5">{TERMS_BODY}</Text>
        </ScrollView>

        {!scrolledToEnd && (
          <Text className="text-xs text-gray-500 text-center mt-2">
            Scroll to the bottom to enable the agree button.
          </Text>
        )}

        <View className="flex-row mt-4 gap-3">
          <Pressable
            onPress={onClose}
            className="flex-1 py-3 border border-gray-300 rounded-lg"
          >
            <Text className="text-center text-gray-700 font-semibold">Cancel</Text>
          </Pressable>
          <Pressable
            disabled={!scrolledToEnd}
            onPress={onAgree}
            className={`flex-1 py-3 rounded-lg ${scrolledToEnd ? 'bg-brand' : 'bg-gray-300'}`}
          >
            <Text className="text-center text-white font-semibold">I Agree</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
