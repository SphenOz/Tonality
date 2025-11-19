import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useTonalityAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';

function RootLayoutNav() {
  const { isAuthenticated, loading } = useTonalityAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inTabsGroup = segments[0] === '(tabs)';

    if (isAuthenticated && !inTabsGroup) {
      // Logged in but not in tabs -> go to tabs
      router.replace('/(tabs)');
    } else if (!isAuthenticated && inTabsGroup) {
      // Not logged in but in tabs -> go to login
      router.replace('/');
    }
  }, [isAuthenticated, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#121212' }}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

