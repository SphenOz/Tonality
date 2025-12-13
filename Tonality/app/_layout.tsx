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
    const isPublicRoute = segments[0] === 'index' || segments[0] === 'login';
    const isProtectedRoute = !isPublicRoute;

    if (isAuthenticated && isPublicRoute) {
      // Logged in but on public route -> go to tabs
      console.log("RootLayout: Redirecting to tabs");
      router.replace('/(tabs)');
    } else if (!isAuthenticated && isProtectedRoute) {
      // Not logged in but on protected route -> go to login
      console.log("RootLayout: Redirecting to login");
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
    <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="community/[id]" options={{ headerShown: true, animation: 'slide_from_right' }} />
      <Stack.Screen name="user/[id]" options={{ headerShown: true, animation: 'slide_from_right' }} />
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

