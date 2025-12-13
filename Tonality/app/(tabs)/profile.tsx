import { useEffect, useMemo, useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Switch, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSpotifyAuth } from '../../hooks/useSpotifyAuth';
import { useTonalityAuth } from '../../context/AuthContext';
import { ThemeMode, useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../context/ThemeContext';
import { Image } from 'expo-image';
import { fetchUserProfile } from '../../api/spotify';
import { useRouter } from 'expo-router';
import { API_BASE_URL } from '../../utils/runtimeConfig';

export default function ProfileScreen() {
  const { token, promptAsync, disconnect, isLoaded, refreshToken } = useSpotifyAuth();
  const { user, token: authToken, logout } = useTonalityAuth();
  const { theme, setThemeMode } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [spotifyProfile, setSpotifyProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Privacy & Status settings
  const [isOnline, setIsOnline] = useState(true);
  const [showListeningActivity, setShowListeningActivity] = useState(true);
  const [allowFriendRequests, setAllowFriendRequests] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Fetch user settings from backend
  useEffect(() => {
    const fetchSettings = async () => {
      if (!authToken) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/user/settings`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setIsOnline(data.is_online ?? true);
          setShowListeningActivity(data.show_listening_activity ?? true);
          setAllowFriendRequests(data.allow_friend_requests ?? true);
        }
      } catch (err) {
        console.error('Failed to fetch user settings:', err);
      } finally {
        setLoadingSettings(false);
      }
    };
    fetchSettings();
  }, [authToken]);

  // Update settings in backend
  const updateSetting = async (key: string, value: boolean) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        throw new Error('Failed to update setting');
      }
    } catch (err) {
      console.error(`Failed to update ${key}:`, err);
      Alert.alert('Error', 'Failed to update setting. Please try again.');
    }
  };

  const handleOnlineChange = (value: boolean) => {
    setIsOnline(value);
    updateSetting('is_online', value);
  };

  const handleListeningActivityChange = (value: boolean) => {
    setShowListeningActivity(value);
    updateSetting('show_listening_activity', value);
  };

  const handleFriendRequestsChange = (value: boolean) => {
    setAllowFriendRequests(value);
    updateSetting('allow_friend_requests', value);
  };

  useEffect(() => {
    if (!token) {
      setSpotifyProfile(null);
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    fetchUserProfile(token)
      .then(setSpotifyProfile)
      .catch(async (err) => {
        console.error('Failed to load Spotify profile', err);
        if (err.message && err.message.includes('401')) {
          await refreshToken();
        }
      })
      .finally(() => setLoadingProfile(false));
  }, [token]);

  const handleThemeSelect = (mode: ThemeMode) => {
    setThemeMode(mode).catch(err => console.error('Failed to set theme mode', err));
  };

  const handleSpotifyAction = () => {
    console.log('[Profile] handleSpotifyAction called. token:', !!token);
    if (token) {
      console.log('[Profile] Calling disconnect()');
      disconnect();
    } else {
      console.log('[Profile] Calling promptAsync()');
      promptAsync();
    }
  };

  const isConnected = Boolean(token);
  console.log('[Profile] Render. isConnected:', isConnected, 'token:', token ? 'Yes' : 'No');

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
            {!isLoaded && (
              <Text style={styles.helperText}>Checking your connection…</Text>
            )}
            {isLoaded && !isConnected && (
              <Text style={styles.helperText}>
                Link your Spotify account to unlock personalized picks and data-driven insights.
              </Text>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: isConnected ? theme.colors.surfaceMuted : theme.colors.accent },
                pressed && styles.primaryButtonPressed,
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
                  style={({ pressed }) => [
                    styles.themeToggle,
                    theme.mode === mode && styles.themeToggleActive,
                    pressed && styles.themeTogglePressed,
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

        {/* Online Status & Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Status & Privacy</Text>
          <View style={styles.card}>
            {loadingSettings ? (
              <ActivityIndicator size="small" color={theme.colors.accent} style={{ padding: 20 }} />
            ) : (
              <>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <View style={styles.settingLabelRow}>
                      <Ionicons name="radio-button-on" size={18} color={isOnline ? theme.colors.accent : theme.colors.textMuted} />
                      <Text style={styles.settingLabel}>Online Status</Text>
                    </View>
                    <Text style={styles.settingHint}>Show friends when you're active</Text>
                  </View>
                  <Switch
                    value={isOnline}
                    onValueChange={handleOnlineChange}
                    trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accentMuted }}
                    thumbColor={isOnline ? theme.colors.accent : theme.colors.textMuted}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <View style={styles.settingLabelRow}>
                      <Ionicons name="musical-notes" size={18} color={theme.colors.text} />
                      <Text style={styles.settingLabel}>Show Listening Activity</Text>
                    </View>
                    <Text style={styles.settingHint}>Let friends see what you're playing</Text>
                  </View>
                  <Switch
                    value={showListeningActivity}
                    onValueChange={handleListeningActivityChange}
                    trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accentMuted }}
                    thumbColor={showListeningActivity ? theme.colors.accent : theme.colors.textMuted}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <View style={styles.settingLabelRow}>
                      <Ionicons name="person-add" size={18} color={theme.colors.text} />
                      <Text style={styles.settingLabel}>Allow Friend Requests</Text>
                    </View>
                    <Text style={styles.settingHint}>Others can send you friend requests</Text>
                  </View>
                  <Switch
                    value={allowFriendRequests}
                    onValueChange={handleFriendRequestsChange}
                    trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accentMuted }}
                    thumbColor={allowFriendRequests ? theme.colors.accent : theme.colors.textMuted}
                  />
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Session</Text>
          <View style={styles.cardDanger}>
            <Text style={styles.helperText}>
              Logging out removes your Tonality session from this device but keeps Spotify linked until you disconnect above.
            </Text>
            <Pressable 
              style={({ pressed }) => [
                styles.logoutButton,
                pressed && styles.logoutButtonPressed,
              ]} 
              onPress={async () => {
                await logout();
                router.replace('/');
              }}
            >
              <Ionicons name="exit" size={18} color="#fff" />
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
          </View>
        </View>

        {/* Delete Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Danger Zone</Text>
          <View style={styles.cardDanger}>
            <Text style={styles.helperText}>
              Deleting your account is permanent and cannot be undone. All your data, friends, and listening history will be removed.
            </Text>
            <Pressable 
              style={({ pressed }) => [
                styles.deleteButton, 
                deletingAccount && { opacity: 0.6 },
                pressed && !deletingAccount && styles.deleteButtonPressed,
              ]} 
              disabled={deletingAccount}
              onPress={() => {
                Alert.alert(
                  'Delete Account',
                  'Are you sure you want to permanently delete your Tonality account? This action cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Delete', 
                      style: 'destructive',
                      onPress: async () => {
                        if (!authToken) return;
                        setDeletingAccount(true);
                        try {
                          const res = await fetch(`${API_BASE_URL}/api/user/account`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${authToken}` },
                          });
                          if (!res.ok) throw new Error('Failed to delete account');
                          await logout();
                          router.replace('/');
                        } catch (err) {
                          console.error('Failed to delete account:', err);
                          Alert.alert('Error', 'Failed to delete account. Please try again.');
                        } finally {
                          setDeletingAccount(false);
                        }
                      }
                    },
                  ]
                );
              }}
            >
              {deletingAccount ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="trash" size={18} color="#fff" />
              )}
              <Text style={styles.logoutText}>{deletingAccount ? 'Deleting...' : 'Delete Account'}</Text>
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
  primaryButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
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
  themeTogglePressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
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
  logoutButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  deleteButton: {
    backgroundColor: '#B91C1C',
    borderRadius: 999,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    gap: 4,
  },
  settingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  settingHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginLeft: 26,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
});
