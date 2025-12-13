import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Image, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../context/ThemeContext';
import { useTonalityAuth } from '../../hooks/useTonalityAuth';
import { 
    getCommunityDetails, 
    getCommunityTopSongs, 
    getCommunityMembers, 
    createCommunityPlaylist,
    leaveCommunity,
    Community,
    CommunitySong,
    CommunityMember
} from '../../api/tonality';
import { openInSpotify } from '../../utils/spotifyLinks';

export default function CommunityDetailScreen() {
    const { id } = useLocalSearchParams();
    const communityId = parseInt(id as string);
    const router = useRouter();
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { token } = useTonalityAuth();

    const [community, setCommunity] = useState<Community | null>(null);
    const [topSongs, setTopSongs] = useState<CommunitySong[]>([]);
    const [members, setMembers] = useState<CommunityMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [creatingPlaylist, setCreatingPlaylist] = useState(false);

    useEffect(() => {
        loadData();
    }, [communityId, token]);

    const loadData = async () => {
        if (!token) return;
        try {
            const [communityData, songsData, membersData] = await Promise.all([
                getCommunityDetails(token, communityId),
                getCommunityTopSongs(token, communityId),
                getCommunityMembers(token, communityId)
            ]);
            setCommunity(communityData);
            setTopSongs(songsData.songs);
            setMembers(membersData.members);
        } catch (error) {
            console.error('Error loading community details:', error);
            Alert.alert('Error', 'Failed to load community details');
        } finally {
            setLoading(false);
        }
    };

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
        return (
            <View style={styles.containerCentered}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
            </View>
        );
    }

    if (!community) {
        return (
            <View style={styles.containerCentered}>
                <Text style={styles.errorText}>Community not found</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ 
                headerTitle: community.name,
                headerStyle: { backgroundColor: theme.colors.background },
                headerTintColor: theme.colors.text,
                headerShadowVisible: false,
            }} />
            
            <ScrollView contentContainerStyle={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <Ionicons name={community.icon_name as any || "musical-notes"} size={40} color={theme.colors.accent} />
                    </View>
                    <Text style={styles.description}>{community.description || "A community for music lovers"}</Text>
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
                        <Text style={styles.sectionTitle}>Top 5 Songs</Text>
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
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>No songs trending yet</Text>
                        </View>
                    ) : (
                        topSongs.map((song, index) => (
                            <Pressable 
                                key={`${song.song_id}-${index}`} 
                                style={styles.songCard}
                                onPress={() => openInSpotify({ id: song.song_id, type: 'track', name: song.track_name })}
                            >
                                <Text style={styles.rank}>#{index + 1}</Text>
                                <Image 
                                    source={{ uri: song.album_image_url || 'https://via.placeholder.com/50' }} 
                                    style={styles.albumArt} 
                                />
                                <View style={styles.songInfo}>
                                    <Text style={styles.songName} numberOfLines={1}>{song.track_name}</Text>
                                    <Text style={styles.artistName} numberOfLines={1}>{song.artist_name}</Text>
                                </View>
                                <View style={styles.playCount}>
                                    <Ionicons name="play" size={12} color={theme.colors.textMuted} />
                                    <Text style={styles.playCountText}>{song.count}</Text>
                                </View>
                            </Pressable>
                        ))
                    )}
                </View>

                {/* Members */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Members</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membersList}>
                        {members.map((member) => (
                            <Pressable 
                                key={member.id} 
                                style={styles.memberCard}
                                onPress={() => router.push(`/user/${member.id}`)}
                            >
                                <View style={styles.memberAvatar}>
                                    <Text style={styles.memberAvatarText}>
                                        {(member.spotify_display_name || member.username)[0].toUpperCase()}
                                    </Text>
                                </View>
                                <Text style={styles.memberName} numberOfLines={1}>
                                    {member.spotify_display_name || member.username}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>

                {/* Leave Community Button */}
                <Pressable 
                    style={styles.leaveButton}
                    onPress={handleLeaveCommunity}
                >
                    <Text style={styles.leaveButtonText}>Leave Community</Text>
                </Pressable>
            </ScrollView>
        </View>
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
    },
    errorText: {
        color: theme.colors.danger,
        fontSize: 16,
    },
    content: {
        padding: 24,
        paddingBottom: 40,
        gap: 32,
    },
    header: {
        alignItems: 'center',
        gap: 16,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(29, 185, 84, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    description: {
        fontSize: 16,
        color: theme.colors.textMuted,
        textAlign: 'center',
        lineHeight: 24,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        width: '100%',
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
        gap: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontSize: 20,
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
    emptyState: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    emptyStateText: {
        color: theme.colors.textMuted,
        fontSize: 14,
    },
    songCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    rank: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.colors.accent,
        width: 32,
    },
    albumArt: {
        width: 48,
        height: 48,
        borderRadius: 8,
        marginRight: 12,
    },
    songInfo: {
        flex: 1,
        gap: 4,
    },
    songName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    artistName: {
        fontSize: 14,
        color: theme.colors.textMuted,
    },
    playCount: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: theme.colors.background,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    playCountText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.textMuted,
    },
    membersList: {
        marginHorizontal: -24,
        paddingHorizontal: 24,
    },
    memberCard: {
        alignItems: 'center',
        marginRight: 16,
        width: 72,
        gap: 8,
    },
    memberAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: theme.colors.border,
    },
    memberAvatarText: {
        fontSize: 24,
        fontWeight: '600',
        color: theme.colors.text,
    },
    memberName: {
        fontSize: 12,
        color: theme.colors.text,
        textAlign: 'center',
    },
    leaveButton: {
        marginTop: 24,
        padding: 16,
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.danger,
        alignItems: 'center',
    },
    leaveButtonText: {
        color: theme.colors.danger,
        fontSize: 16,
        fontWeight: '600',
    },
});
