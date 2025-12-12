import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import type { Theme } from '../../../context/ThemeContext';
import { API_BASE_URL } from '../../../utils/runtimeConfig';
import { useTonalityAuth } from '../../../context/AuthContext';

/* ────────────────────────────────────────────── */
/*                API HELPERS                     */
/* ────────────────────────────────────────────── */

async function apiFetch(path: string, token?: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${path}`;
  console.log(`🌐 FETCH → ${url}`);

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* ignore non-JSON */
    }

    if (!res.ok) {
      console.error('API ERROR:', res.status, json || text);
      throw json || new Error(`Request failed with status ${res.status}`);
    }

    return json;
  } catch (err) {
    console.error(`Network/API Failure @ ${path}:`, err);
    throw err;
  }
}

const getCommunity = (id: number) => apiFetch(`/api/communities/${id}`);
const getCommunityMembers = (id: number, token: string) =>
  apiFetch(`/api/communities/${id}/members`, token);
const getCommunityTopSongs = (id: number) =>
  apiFetch(`/api/communities/${id}/top-songs`);

/* ────────────────────────────────────────────── */
/*                 TYPES                           */
/* ────────────────────────────────────────────── */

type Community = {
  id: number;
  name: string;
  description?: string | null;
  member_count: number;
  icon_name?: string | null;
};

type CommunityMember = {
  id: number;
  username: string;
  spotify_display_name?: string | null;
  spotify_profile_image_url?: string | null;
  is_online: boolean;
  is_friend: boolean;
  is_self: boolean;
  joined_at: string;
};

type TopSong = {
  track_name: string;
  artist_name: string;
  album_name?: string | null;
  album_image_url?: string | null;
  spotify_uri?: string | null;
  count: number;
};

/* ────────────────────────────────────────────── */
/*             COMMUNITY DETAIL SCREEN             */
/* ────────────────────────────────────────────── */

export default function CommunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);

  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { token } = useTonalityAuth();

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [topSongs, setTopSongs] = useState<TopSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!numericId || Number.isNaN(numericId)) {
      setError('Invalid community id');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    console.log('🔄 Loading community detail for id:', numericId);
    setError(null);

    try {
      const [communityData, topSongsData] = await Promise.all([
        getCommunity(numericId),
        getCommunityTopSongs(numericId),
      ]);

      setCommunity(communityData as Community);

      if (topSongsData?.songs) {
        setTopSongs(topSongsData.songs as TopSong[]);
      } else {
        setTopSongs([]);
      }

      if (token) {
        try {
          const membersData = await getCommunityMembers(numericId, token);
          if (membersData?.members) {
            setMembers(membersData.members as CommunityMember[]);
          } else {
            setMembers([]);
          }
        } catch (err) {
          console.error('⚠️ Failed to load community members', err);
          setMembers([]);
        }
      } else {
        console.log('⚠️ No auth token — skipping members');
      }
    } catch (err: any) {
      setError(err?.detail || 'Failed to load community');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [numericId, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.containerCentered}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={styles.loadingText}>Loading community...</Text>
      </SafeAreaView>
    );
  }

  if (!community) {
    return (
      <SafeAreaView style={styles.containerCentered}>
        <Text style={styles.loadingText}>
          {error || 'Community not found'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Ionicons
              name={community.icon_name as any || 'people'}
              size={32}
              color={theme.colors.accent}
            />
            <View style={styles.headerText}>
              <Text style={styles.title}>{community.name}</Text>
              <Text style={styles.subtitle}>
                {community.member_count} members
              </Text>
            </View>
          </View>

          {community.description ? (
            <Text style={styles.description}>{community.description}</Text>
          ) : null}
        </View>

        {/* Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>

          {members.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No visible members yet.
              </Text>
            </View>
          ) : (
            members.map((m) => (
              <View key={m.id} style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  <Ionicons
                    name={m.is_self ? 'person-circle' : 'person'}
                    size={24}
                    color={theme.colors.accent}
                  />
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {m.spotify_display_name || m.username}
                    {m.is_self ? ' (You)' : ''}
                  </Text>
                  <View style={styles.memberMetaRow}>
                    <Text style={styles.memberMeta}>
                      Joined {new Date(m.joined_at).toLocaleDateString()}
                    </Text>
                    {m.is_online && (
                      <View style={styles.onlineDotWrapper}>
                        <View style={styles.onlineDot} />
                        <Text style={styles.memberMeta}>Online</Text>
                      </View>
                    )}
                    {m.is_friend && !m.is_self && (
                      <View style={styles.friendBadge}>
                        <Ionicons
                          name="heart"
                          size={10}
                          color={theme.colors.accent}
                        />
                        <Text style={styles.friendBadgeText}>Friend</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Top Songs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Songs</Text>

          {topSongs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No listening activity yet.
              </Text>
            </View>
          ) : (
            topSongs.map((song, index) => (
              <View key={`${song.track_name}-${song.artist_name}-${index}`} style={styles.songCard}>
                <View style={styles.songRankCircle}>
                  <Text style={styles.songRankText}>{index + 1}</Text>
                </View>
                <View style={styles.songTextContainer}>
                  <Text style={styles.songTitle}>{song.track_name}</Text>
                  <Text style={styles.songArtist}>{song.artist_name}</Text>
                  <Text style={styles.songMeta}>
                    {song.count} plays in this community
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ────────────────────────────────────────────── */
/*                    STYLES                      */
/* ────────────────────────────────────────────── */

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    containerCentered: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      color: theme.colors.textMuted,
      fontSize: 14,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 24,
      paddingBottom: 64,
      gap: 24,
    },

    header: {
      gap: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textMuted,
    },
    description: {
      fontSize: 14,
      color: theme.colors.textMuted,
    },

    section: {
      gap: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },

    emptyCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textMuted,
    },

    memberCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberInfo: {
      flex: 1,
      gap: 4,
    },
    memberName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    memberMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    memberMeta: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    onlineDotWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    onlineDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.accent,
    },
    friendBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.accent,
    },
    friendBadgeText: {
      fontSize: 11,
      color: theme.colors.accent,
      fontWeight: '600',
    },

    songCard: {
      flexDirection: 'row',
      gap: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    songRankCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    songRankText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.accent,
    },
    songTextContainer: {
      flex: 1,
      gap: 2,
    },
    songTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    songArtist: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    songMeta: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
  });
