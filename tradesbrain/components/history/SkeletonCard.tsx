// D6 Flow08 — Shimmer skeleton card. Renders while Supabase fetch is in-flight.

import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';

export default function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ opacity }}
      className="bg-white border border-gray-200 rounded-xl p-4 mb-3"
    >
      <View className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
      <View className="h-3 bg-gray-200 rounded w-1/3 mb-2" />
      <View className="h-3 bg-gray-200 rounded w-1/2" />
    </Animated.View>
  );
}
