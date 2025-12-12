import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../context/ThemeContext';

type LoadingScreenProps = {
  message?: string;
};

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Warming up your vibe…',
}) => {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.15,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [scale]);

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}
    >
      <Animated.View
        style={{
          transform: [{ scale }],
          width: 80,
          height: 80,
          borderRadius: 40,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.accent,
          marginBottom: 20,
        }}
      >
        <Ionicons name="musical-notes" size={36} color="#fff" />
      </Animated.View>

      <ActivityIndicator size="small" color={theme.colors.accent} />

      <Text
        style={{
          marginTop: 12,
          fontSize: 14,
          color: theme.colors.textMuted,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
    </SafeAreaView>
  );
};

export default LoadingScreen;
