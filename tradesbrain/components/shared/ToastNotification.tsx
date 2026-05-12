import React, { useEffect } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';

interface ToastProps {
  message: string;
  visible: boolean;
  type?: 'success' | 'error' | 'warning' | 'info';
  onDismiss: () => void;
  duration?: number;
}

export default function ToastNotification({ message, visible, type = 'info', onDismiss, duration = 3000 }: ToastProps) {
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(duration),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onDismiss());
    }
  }, [visible]);

  if (!visible) return null;

  const bgColor = type === 'error' ? '#DC2626' : type === 'success' ? '#16A34A' : type === 'warning' ? '#D97706' : '#2E75B6';

  return (
    <Animated.View style={[styles.container, { opacity, backgroundColor: bgColor }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 60, left: 20, right: 20, padding: 16, borderRadius: 8, zIndex: 9999 },
  text: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
