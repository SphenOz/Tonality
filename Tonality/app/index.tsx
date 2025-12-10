import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTonalityAuth } from '../hooks/useTonalityAuth';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../context/ThemeContext';

export default function Index() {
  const router = useRouter();
  const { theme } = useTheme();
  const { login: tonalityLogin, isAuthenticated, loading } = useTonalityAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    console.log("LoginScreen: Mounted. isAuthenticated:", isAuthenticated);
    if (!loading && isAuthenticated) {
      console.log("LoginScreen: User is authenticated, redirecting to tabs...");
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, loading, router]);

  const handleAuth = async () => {
    if (!email || !password) {
      return alert('Please enter your email and password');
    }
    try {
      setSubmitting(true);
      console.log("LoginScreen: handleAuth", { email, isSignUp });
      await tonalityLogin(email.trim(), password, isSignUp);
      router.replace('/(tabs)');
  } catch {
      alert('Authentication failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <View style={styles.heroSection}>
          <View style={styles.logoBadge}>
            <Ionicons name="musical-notes" size={20} color={theme.colors.text} />
          </View>
          <Text style={styles.brandTitle}>Tonality</Text>
          <Text style={styles.brandSubtitle}>Social music sharing for people who obsess over playlists.</Text>
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Ionicons name="sparkles" size={16} color={theme.colors.textMuted} />
            <View style={styles.divider} />
          </View>
          <Text style={styles.heroHighlight}>Log in or create an account in seconds.</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{isSignUp ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={styles.formSubtitle}>
            {isSignUp ? 'Start curating collaborative vibes.' : 'Pick up where your queue left off.'}
          </Text>

          <View style={styles.inputsRow}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={theme.colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={theme.colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <Pressable style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]} onPress={handleAuth} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name={isSignUp ? 'sparkles' : 'log-in'} size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>{isSignUp ? 'Create account' : 'Log in'}</Text>
              </>
            )}
          </Pressable>

          <Pressable style={styles.switchModeButton} onPress={() => setIsSignUp(!isSignUp)}>
            <Text style={styles.switchModeText}>
              {isSignUp ? 'Already have an account? Sign in' : "Need an account? Sign up"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.supportRow}>
          <View style={styles.supportColumn}>
            <Text style={styles.supportLabel}>Stay synced</Text>
            <Text style={styles.supportValue}>Link Spotify right from your dashboard.</Text>
          </View>
          <View style={styles.supportColumn}>
            <Text style={styles.supportLabel}>Secure mock auth</Text>
            <Text style={styles.supportValue}>Credentials live only on this device.</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    keyboardView: {
      flex: 1,
      padding: 24,
      justifyContent: 'center',
    },
    heroSection: {
      alignItems: 'center',
      marginBottom: 32,
      gap: 12,
    },
    logoBadge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    brandTitle: {
      fontSize: 36,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: 0.5,
    },
    brandSubtitle: {
      fontSize: 16,
      color: theme.colors.textMuted,
      textAlign: 'center',
      maxWidth: 320,
      lineHeight: 22,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
    },
    divider: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    heroHighlight: {
      marginTop: 4,
      fontSize: 14,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
    formCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 28,
      padding: 24,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.45,
      shadowRadius: 24,
      elevation: 10,
      marginBottom: 32,
    },
    formTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
    },
    formSubtitle: {
      fontSize: 14,
      color: theme.colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: 16,
    },
    inputsRow: {
      gap: 12,
    },
    input: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: theme.colors.text,
      backgroundColor: theme.colors.surfaceMuted,
    },
    primaryButton: {
      marginTop: 16,
      borderRadius: 999,
      backgroundColor: theme.colors.accent,
      paddingVertical: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 16,
    },
    switchModeButton: {
      marginTop: 18,
      alignSelf: 'center',
    },
    switchModeText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    supportRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 16,
    },
    supportColumn: {
      flex: 1,
      padding: 16,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    supportLabel: {
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: theme.colors.textMuted,
      marginBottom: 6,
    },
    supportValue: {
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
  });