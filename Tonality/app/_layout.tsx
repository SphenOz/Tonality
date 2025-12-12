import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useTonalityAuth } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { SpotifyAuthProvider } from '../hooks/useSpotifyAuth';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';


function RootLayoutNav() {
  const { isAuthenticated, loading } = useTonalityAuth();
  const { theme } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    console.log(`RootLayout: Auth State Change. isAuthenticated=${isAuthenticated}, loading=${loading}, segments=${JSON.stringify(segments)}`);
    if (loading) return;

    const inTabsGroup = segments[0] === '(tabs)';

    // Allow certain non-tab routes to be visited while authenticated
    const allowedWhenAuthenticated = new Set(['community', 'user', 'song-of-day', 'polls']);
    const currentRoot = segments[0] ?? '';

    if (isAuthenticated && !inTabsGroup && !allowedWhenAuthenticated.has(currentRoot)) {
      // Logged in but trying to view a non-allowed root route -> go to tabs
      console.log('RootLayout: Redirecting to tabs');
      router.replace('/(tabs)');
    } else if (!isAuthenticated && inTabsGroup) {
      // Not logged in but in tabs -> go to login
      console.log('RootLayout: Redirecting to login');
      router.replace('/');
    }
  }, [isAuthenticated, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="user/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SpotifyAuthProvider>
          <RootLayoutNav />
        </SpotifyAuthProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

