import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import LoadingScreen from '../../../components/LoadingScreen';
import { useTheme } from '../../../context/ThemeContext';
import type { Theme } from '../../../context/ThemeContext';
import { useTonalityAuth } from '../../../context/AuthContext';
import { 
    getCommunityDetails, 
    getCommunityTopSongs, 
    getCommunityMembers, 
    createCommunityPlaylist,
    leaveCommunity,
    Community,
    CommunitySong,
    CommunityMember
} from '../../../api/tonality';
import { openInSpotify } from '../../../utils/spotifyLinks';

export default function CommunityDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const communityId = Number(id);

    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const router = useRouter();
    const { token } = useTonalityAuth();

    const [community, setCommunity] = useState<Community | null>(null);
    const [topSongs, setTopSongs] = useState<CommunitySong[]>([]);
    const [members, setMembers] = useState<CommunityMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [creatingPlaylist, setCreatingPlaylist] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        if (!communityId || Number.isNaN(communityId)) {
            setError('Invalid community id');
            setLoading(false);
            setRefreshing(false);
            return;
        }

        if (!token) {
            setError('Not authenticated');
            setLoading(false);
            setRefreshing(false);
            return;
        }

        console.log('🔄 Loading community detail for id:', communityId);
        setError(null);

        try {
            const [communityData, songsData, membersData] = await Promise.all([
                getCommunityDetails(token, communityId),
                getCommunityTopSongs(token, communityId),
                getCommunityMembers(token, communityId)
            ]);
            
            setCommunity(communityData);
            setTopSongs(songsData.songs || []);
            setMembers(membersData.members || []);
        } catch (err: any) {
            console.error('Error loading community details:', err);
            setError(err?.detail || 'Failed to load community');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [communityId, token]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData();
    }, [loadData]);

    const handleCreatePlaylist = async () => {
        if (!token) return;
        try {
            setCreatingPlaylist(true);
            const result = await createCommunityPlaylist(token, communityId);
            Alert.alert(
                'Playlist Created',
                'The community playlist has been created in your Spotify account!',
                [
                    { text: 'Open in Spotify', onPress: () => openInSpotify({ id: result.playlist_id, type: 'playlist' }) },
                    { text: 'OK' }
                ]
            );
        } catch (error) {
            console.error('Error creating playlist:', error);
            Alert.alert('Error', 'Failed to create playlist');
        } finally {
            setCreatingPlaylist(false);
        }
    };

    const handleLeaveCommunity = async () => {
        if (!token) return;
        
        Alert.alert(
            "Leave Community",
            "Are you sure you want to leave this community?",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Leave", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await leaveCommunity(token, communityId);
                            router.replace('/(tabs)/community');
                        } catch (error) {
                            console.error('Error leaving community:', error);
                            Alert.alert('Error', 'Failed to leave community');
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return <LoadingScreen message="Loading community..." />;
    }

    if (!community) {
        return (
            <SafeAreaView style={styles.containerCentered}>
                <Text style={styles.errorText}>
                    {error || 'Community not found'}
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
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
                        <View style={styles.iconContainer}>
                            <Ionicons 
                                name={community.icon_name as any || "musical-notes"} 
                                size={40} 
                                color={theme.colors.accent} 
                            />
                        </View>
                        <View style={styles.headerText}>
                            <Text style={styles.title}>{community.name}</Text>
                            <Text style={styles.subtitle}>{community.member_count} members</Text>
                        </View>
                    </View>
                    
                    {community.description && (
                        <Text style={styles.description}>{community.description}</Text>
                    )}

                    <View style={styles.statsRow}>
                        <View style={styles.stat}>
                            <Text style={styles.statValue}>{members.length}</Text>
                            <Text style={styles.statLabel}>Members</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.stat}>
                            <Text style={styles.statValue}>{topSongs.length}</Text>
                            <Text style={styles.statLabel}>Top Songs</Text>
                        </View>
                    </View>
                </View>

                {/* Top Songs */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Top Songs</Text>
                        <Pressable 
                            style={styles.createPlaylistButton}
                            onPress={handleCreatePlaylist}
                            disabled={creatingPlaylist || topSongs.length === 0}
                        >
                            {creatingPlaylist ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="add-circle-outline" size={18} color="#fff" />
                                    <Text style={styles.createPlaylistText}>Create Playlist</Text>
                                </>
                            )}
                        </Pressable>
                    </View>

                    {topSongs.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyText}>No listening activity yet.</Text>
                        </View>
                    ) : (
                        topSongs.map((song, index) => (
                            <Pressable 
                                key={`${song.song_id || song.track_name}-${index}`} 
                                style={styles.songCard}
                                onPress={() => song.song_id && openInSpotify({ id: song.song_id, type: 'track', name: song.track_name })}
                            >
                                <View style={styles.songRankCircle}>
                                    <Text style={styles.songRankText}>{index + 1}</Text>
                                </View>
                                {song.album_image_url ? (
                                    <Image 
                                        source={{ uri: song.album_image_url }} 
                                        style={styles.albumArt} 
                                    />
                                ) : (
                                    <View style={[styles.albumArt, styles.albumArtPlaceholder]}>
                                        <Ionicons name="musical-note" size={20} color={theme.colors.textMuted} />
                                    </View>
                                )}
                                <View style={styles.songInfo}>
                                    <Text style={styles.songName} numberOfLines={1}>{song.track_name}</Text>
                                    <Text style={styles.artistName} numberOfLines={1}>{song.artist_name}</Text>
                                    <Text style={styles.songMeta}>{song.count} plays in this community</Text>
                                </View>
                            </Pressable>
                        ))
                    )}
                </View>

                {/* Members */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Members</Text>
                    
                    {members.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyText}>No visible members yet.</Text>
                        </View>
                    ) : (
                        members.map((member) => (
                            <Pressable
                                key={member.id}
                                style={styles.memberCard}
                                onPress={() => router.push(`/user/${member.id}`)}
                            >
                                <View style={styles.memberAvatar}>
                                    <Ionicons
                                        name={member.is_self ? 'person-circle' : 'person'}
                                        size={24}
                                        color={theme.colors.accent}
                                    />
                                </View>
                                <View style={styles.memberInfo}>
                                    <Text style={styles.memberName}>
                                        {member.spotify_display_name || member.username}
                                        {member.is_self ? ' (You)' : ''}
                                    </Text>
                                    <View style={styles.memberMetaRow}>
                                        {member.joined_at && (
                                            <Text style={styles.memberMeta}>
                                                Joined {new Date(member.joined_at).toLocaleDateString()}
                                            </Text>
                                        )}
                                        {member.is_online && (
                                            <View style={styles.onlineDotWrapper}>
                                                <View style={styles.onlineDot} />
                                                <Text style={styles.memberMeta}>Online</Text>
                                            </View>
                                        )}
                                        {member.is_friend && !member.is_self && (
                                            <View style={styles.friendBadge}>
                                                <Ionicons name="heart" size={10} color={theme.colors.accent} />
                                                <Text style={styles.friendBadgeText}>Friend</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </Pressable>
                        ))
                    )}
                </View>

                {/* Leave Community Button */}
                <Pressable 
                    style={styles.leaveButton}
                    onPress={handleLeaveCommunity}
                >
                    <Ionicons name="exit-outline" size={18} color={theme.colors.danger} />
                    <Text style={styles.leaveButtonText}>Leave Community</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
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
    errorText: {
        color: theme.colors.danger,
        fontSize: 16,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 24,
        paddingBottom: 64,
        gap: 24,
    },
    header: {
        gap: 16,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    headerText: {
        flex: 1,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(29, 185, 84, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
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
        lineHeight: 20,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    stat: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
    },
    statDivider: {
        width: 1,
        height: 32,
        backgroundColor: theme.colors.border,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.colors.text,
    },
    statLabel: {
        fontSize: 12,
        color: theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    section: {
        gap: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.text,
    },
    createPlaylistButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: theme.colors.accent,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    createPlaylistText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
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
    albumArt: {
        width: 48,
        height: 48,
        borderRadius: 8,
    },
    albumArtPlaceholder: {
        backgroundColor: theme.colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    songInfo: {
        flex: 1,
        gap: 2,
    },
    songName: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.colors.text,
    },
    artistName: {
        fontSize: 13,
        color: theme.colors.textMuted,
    },
    songMeta: {
        fontSize: 12,
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
    leaveButton: {
        marginTop: 8,
        padding: 16,
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.danger,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    leaveButtonText: {
        color: theme.colors.danger,
        fontSize: 16,
        fontWeight: '600',
    },
});
