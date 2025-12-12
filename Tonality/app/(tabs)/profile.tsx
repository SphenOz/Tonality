import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSpotifyAuth } from '../../hooks/useSpotifyAuth';
import { useTonalityAuth } from '../../context/AuthContext';
import { ThemeMode, useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../context/ThemeContext';
import { Image } from 'expo-image';
import { fetchUserProfile } from '../../api/spotify';

export default function ProfileScreen() {
  const { token, promptAsync, disconnect, isLoaded } = useSpotifyAuth();
  const { user, logout } = useTonalityAuth();
  const { theme, setThemeMode } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [spotifyProfile, setSpotifyProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (!token) {
      setSpotifyProfile(null);
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    fetchUserProfile(token)
      .then(setSpotifyProfile)
      .catch(err => console.error('Failed to load Spotify profile', err))
      .finally(() => setLoadingProfile(false));
  }, [token]);

  const handleThemeSelect = (mode: ThemeMode) => {
    setThemeMode(mode).catch(err => console.error('Failed to set theme mode', err));
  };

  const handleSpotifyAction = () => {
    if (token) {
      disconnect();
    } else {
      promptAsync();
    }
  };

  const isConnected = Boolean(token);

  const openSpotifyProfile = () => {
    const url = spotifyProfile?.external_urls?.spotify;
    if (url) {
      Linking.openURL(url);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Image
              source={{ uri: spotifyProfile?.images?.[0]?.url }}
              style={{ width: 80, height: 80, borderRadius: 40 }}
            />
          </View>
          <Text style={styles.userEmail}>{user?.username}</Text>
          <Text style={styles.userHint}>Manage your Tonality experience here.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Spotify connection</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[
                styles.statusPill,
                { backgroundColor: isConnected ? theme.colors.accent : theme.colors.textMuted },
              ]}>
                <Ionicons
                  name={isConnected ? 'link' : 'unlink'}
                  size={14}
                  color={isConnected ? '#fff' : theme.colors.background}
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: isConnected ? '#fff' : theme.colors.background },
                  ]}
                >
                  {isConnected ? 'Connected' : 'Not connected'}
                </Text>
              </View>
              {loadingProfile && <ActivityIndicator size="small" color={theme.colors.accent} />}
            </View>
            {isConnected && (
              <View style={styles.connectionDetails}>
                <Text style={styles.connectionLabel}>Signed in as</Text>
                <Text style={styles.connectionValue}>
                  {spotifyProfile?.display_name || 'Spotify User'}
                </Text>
                <Text style={styles.connectionEmail}>{spotifyProfile?.username}</Text>
              </View>
            )}
            {isConnected && spotifyProfile?.externalurls?.spotify && (
              <Pressable style={styles.secondaryButton} onPress={openSpotifyProfile}>
                <Ionicons name="open-outline" size={16} color={theme.colors.accent} />
                <Text style={styles.secondaryButtonText}>View in Spotify</Text>
              </Pressable>
            )}
            {!isLoaded && (
              <Text style={styles.helperText}>Checking your connection…</Text>
            )}
            {isLoaded && !isConnected && (
              <Text style={styles.helperText}>
                Link your Spotify account to unlock personalized picks and data-driven insights.
              </Text>
            )}
            <Pressable
              style={[
                styles.primaryButton,
                { backgroundColor: isConnected ? theme.colors.surfaceMuted : theme.colors.accent },
              ]}
              onPress={handleSpotifyAction}
            >
              <Ionicons name={isConnected ? 'log-out' : 'link'} size={18} color={isConnected ? theme.colors.text : '#fff'} />
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: isConnected ? theme.colors.text : '#fff' },
                ]}
              >
                {isConnected ? 'Disconnect Spotify' : 'Connect Spotify'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Appearance</Text>
          <View style={styles.card}>
            <Text style={styles.helperText}>Choose how Tonality adapts to your environment.</Text>
            <View style={styles.toggleRow}>
              {(['system', 'light', 'dark'] as ThemeMode[]).map(mode => (
                <Pressable
                  key={mode}
                  onPress={() => handleThemeSelect(mode)}
                  style={[
                    styles.themeToggle,
                    theme.mode === mode && styles.themeToggleActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.themeToggleText,
                      theme.mode === mode && styles.themeToggleTextActive,
                    ]}
                  >
                    {mode === 'system' ? 'System' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Session</Text>
          <View style={styles.cardDanger}>
            <Text style={styles.helperText}>
              Logging out removes your Tonality session from this device but keeps Spotify linked until you disconnect above.
            </Text>
            <Pressable style={styles.logoutButton} onPress={logout}>
              <Ionicons name="exit" size={18} color="#fff" />
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 64,
    gap: 28,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
  },
  userEmail: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  userHint: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    gap: 16,
  },
  cardDanger: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    gap: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontWeight: '600',
    fontSize: 12,
  },
  connectionDetails: {
    gap: 4,
  },
  connectionLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  connectionValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  connectionEmail: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  helperText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 999,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  themeToggle: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
  },
  themeToggleActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentMuted,
  },
  themeToggleText: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  themeToggleTextActive: {
    color: theme.colors.accent,
  },
  logoutButton: {
    backgroundColor: theme.colors.danger,
    borderRadius: 999,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surface,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.accent,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
