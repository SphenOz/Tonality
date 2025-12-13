import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Dimensions } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../context/ThemeContext';
import { useTonalityAuth } from '../../hooks/useTonalityAuth';
import { API_BASE_URL } from '../../utils/runtimeConfig';
import { openInSpotify } from '../../utils/spotifyLinks';
import { Image } from 'expo-image';
import Animated, { 
    FadeIn, 
    FadeInDown, 
    FadeInUp,
    SlideInRight,
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TopTrack {
    id: string;
    name: string;
    artist: string;
    album?: string;
    album_image_url?: string;
    spotify_uri?: string;
}

interface CurrentlyPlaying {
    id?: string;
    name: string;
    artist: string;
    album?: string;
    album_image_url?: string;
    spotify_uri?: string;
    progress_ms?: number;
    duration_ms?: number;
}

interface UserProfile {
    id: number;
    username: string;
    spotify_display_name?: string;
    spotify_profile_image_url?: string;
    is_online: boolean;
    is_friend: boolean;
    is_self: boolean;
    pending_request?: 'incoming' | 'outgoing';
    allow_friend_requests: boolean;
    listening_activity?: {
        track_name: string;
        artist_name: string;
        album_image_url?: string;
        spotify_uri?: string;
    };
    communities: {
        id: number;
        name: string;
        icon_name: string;
    }[];
}

export default function UserProfileScreen() {
    const { id } = useLocalSearchParams();
    const userId = parseInt(id as string);
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { token } = useTonalityAuth();
    const router = useRouter();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [topTracks, setTopTracks] = useState<TopTrack[]>([]);
    const [topGenres, setTopGenres] = useState<string[]>([]);
    const [recentTracks, setRecentTracks] = useState<TopTrack[]>([]);
    const [mutualTracks, setMutualTracks] = useState<TopTrack[]>([]);
    const [currentlyPlaying, setCurrentlyPlaying] = useState<CurrentlyPlaying | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [spotifyLinked, setSpotifyLinked] = useState<boolean | null>(null); // null = unknown, true = linked, false = not linked
    const [showCompare, setShowCompare] = useState(false);
    const [loadingCompare, setLoadingCompare] = useState(false);
    const [compareError, setCompareError] = useState<string | null>(null);
    
    // Animation for equalizer
    const equalizerAnim = useSharedValue(1);

    useEffect(() => {
        loadProfile();
        const interval = setInterval(() => {
            if (profile && !profile.is_self) {
                loadCurrentlyPlaying();
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [userId, token]);

    useEffect(() => {
        if (isPlaying) {
            equalizerAnim.value = withRepeat(
                withSequence(
                    withTiming(1.3, { duration: 300 }),
                    withTiming(0.8, { duration: 200 }),
                    withTiming(1.1, { duration: 250 }),
                    withTiming(0.9, { duration: 200 }),
                ),
                -1,
                true
            );
        } else {
            equalizerAnim.value = withTiming(1);
        }
    }, [isPlaying]);

    const equalizerStyle = useAnimatedStyle(() => ({
        transform: [{ scaleY: equalizerAnim.value }]
    }));

    const loadProfile = async () => {
        if (!token) return;
        try {
            const [profileRes, tracksRes, genresRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/users/${userId}/profile`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`${API_BASE_URL}/api/users/${userId}/top-tracks`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`${API_BASE_URL}/api/users/${userId}/top-genres`, {
                    headers: { Authorization: `Bearer ${token}` },
                })
            ]);
            
            // Check if Spotify is linked first from top-tracks response
            let isSpotifyLinked = true;
            if (tracksRes.ok) {
                const tracksData = await tracksRes.json();
                if (tracksData.spotify_linked === false) {
                    isSpotifyLinked = false;
                    setSpotifyLinked(false);
                    // Clear all Spotify-related data
                    setTopTracks([]);
                    setTopGenres([]);
                    setRecentTracks([]);
                    setMutualTracks([]);
                    setCurrentlyPlaying(null);
                    setIsPlaying(false);
                } else {
                    setTopTracks(tracksData.tracks || []);
                    setSpotifyLinked(true);
                }
            }
            
            if (profileRes.ok) {
                const profileData = await profileRes.json();
                setProfile(profileData);
                
                // Only load Spotify data if Spotify is linked
                if (isSpotifyLinked) {
                    if (profileData.is_friend || profileData.is_self) {
                        loadRecentTracks();
                        if (profileData.is_friend) {
                            loadMutualTracks();
                        }
                    }
                    if (!profileData.is_self) {
                        loadCurrentlyPlaying();
                    }
                }
            }
            
            if (genresRes.ok && isSpotifyLinked) {
                const genresData = await genresRes.json();
                if (genresData.spotify_linked !== false) {
                    setTopGenres(genresData.genres || []);
                }
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadRecentTracks = async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/users/${userId}/recent-tracks`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            console.log('Recent tracks response:', JSON.stringify(data, null, 2));
            
            if (data.spotify_linked === false) {
                setSpotifyLinked(false);
                setRecentTracks([]);
                return;
            }
            
            if (data.error) {
                console.warn('Recent tracks error:', data.error);
                if (data.error.includes('not linked')) {
                    setSpotifyLinked(false);
                    setRecentTracks([]);
                }
                return;
            }
            
            setRecentTracks(data.tracks || []);
            setSpotifyLinked(true);
        } catch (error) {
            console.error('Error loading recent tracks:', error);
        }
    };

    const loadMutualTracks = async () => {
        if (!token) return;
        setLoadingCompare(true);
        setCompareError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/users/${userId}/mutual-songs`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            console.log('Mutual tracks response:', JSON.stringify(data, null, 2));
            
            // Check for spotify_linked status
            if (data.spotify_linked === false || data.error?.includes('not linked')) {
                setSpotifyLinked(false);
                setMutualTracks([]);
                setCompareError('Spotify not linked');
                return;
            }
            
            setMutualTracks(data.mutual_tracks || []);
            if (data.error) {
                setCompareError(data.error);
            }
        } catch (error) {
            console.error('Error loading mutual tracks:', error);
            setCompareError('Failed to load mutual tracks');
        } finally {
            setLoadingCompare(false);
        }
    };

    const handleToggleCompare = () => {
        const newShowCompare = !showCompare;
        setShowCompare(newShowCompare);
        if (newShowCompare && mutualTracks.length === 0 && !loadingCompare) {
            loadMutualTracks();
        }
    };

    const loadCurrentlyPlaying = async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/users/${userId}/currently-playing`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                
                // Check if Spotify is linked
                if (data.spotify_linked === false) {
                    setSpotifyLinked(false);
                    setCurrentlyPlaying(null);
                    setIsPlaying(false);
                    return;
                }
                
                setIsPlaying(data.is_playing);
                if (data.is_playing && data.track) {
                    setCurrentlyPlaying(data.track);
                } else {
                    setCurrentlyPlaying(null);
                }
            }
        } catch (error) {
            console.error('Error loading currently playing:', error);
        }
    };

    const handleSendFriendRequest = async () => {
        if (!token || !profile) return;
        setActionLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/friends/request/${userId}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                loadProfile();
            } else {
                const err = await response.json().catch(() => ({}));
                if (err.detail?.includes('not accepting')) {
                    Alert.alert('Cannot Add Friend', 'This user is not accepting friend requests at this time.');
                } else {
                    Alert.alert('Error', err.detail || 'Failed to send friend request');
                }
            }
        } catch (error) {
            console.error('Error sending friend request:', error);
            Alert.alert('Error', 'Failed to send friend request');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveFriend = async () => {
        if (!token || !profile) return;
        Alert.alert(
            'Remove Friend',
            `Are you sure you want to remove ${profile.spotify_display_name || profile.username} as a friend?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            const response = await fetch(`${API_BASE_URL}/api/friends/${userId}`, {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${token}` },
                            });
                            if (response.ok) {
                                loadProfile();
                            } else {
                                Alert.alert('Error', 'Failed to remove friend');
                            }
                        } catch (error) {
                            console.error('Error removing friend:', error);
                            Alert.alert('Error', 'Failed to remove friend');
                        } finally {
                            setActionLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleFriendAction = () => {
        if (!profile) return;
        
        if (profile.is_friend) {
            handleRemoveFriend();
        } else if (profile.pending_request === 'incoming') {
            Alert.alert('Pending Request', 'Please go to the Friends tab to accept this request.');
        } else if (profile.pending_request === 'outgoing') {
            Alert.alert('Request Sent', 'You have already sent a friend request.');
        } else if (!profile.allow_friend_requests) {
            Alert.alert('Cannot Add Friend', 'This user is not accepting friend requests at this time.');
        } else {
            handleSendFriendRequest();
        }
    };

    if (loading) {
        return (
            <View style={styles.containerCentered}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
            </View>
        );
    }

    if (!profile) {
        return (
            <View style={styles.containerCentered}>
                <Text style={styles.errorText}>User not found</Text>
            </View>
        );
    }

    const renderTrackCard = (track: TopTrack, index: number, showRank = false) => (
        <Animated.View 
            key={track.id} 
            entering={FadeInDown.delay(index * 50).springify()}
        >
            <Pressable 
                style={styles.trackCard}
                onPress={() => track.spotify_uri && openInSpotify({
                    uri: track.spotify_uri,
                    type: 'track',
                    name: track.name,
                })}
            >
                {showRank && <Text style={styles.trackRank}>#{index + 1}</Text>}
                {track.album_image_url ? (
                    <Image source={{ uri: track.album_image_url }} style={styles.trackImage} />
                ) : (
                    <View style={[styles.trackImage, styles.trackImagePlaceholder]}>
                        <Ionicons name="musical-note" size={20} color={theme.colors.textMuted} />
                    </View>
                )}
                <View style={styles.trackInfo}>
                    <Text style={styles.trackName} numberOfLines={1}>{track.name}</Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                </View>
                <Ionicons name="play-circle-outline" size={24} color={theme.colors.accent} />
            </Pressable>
        </Animated.View>
    );

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ 
                headerTitle: profile.username,
                headerStyle: { backgroundColor: theme.colors.background },
                headerTintColor: theme.colors.text,
                headerShadowVisible: false,
            }} />
            
            <ScrollView contentContainerStyle={styles.content}>
                {/* Profile Header */}
                <Animated.View style={styles.header} entering={FadeIn.duration(400)}>
                    <View style={styles.avatarContainer}>
                        {profile.spotify_profile_image_url ? (
                            <Image source={{ uri: profile.spotify_profile_image_url }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarText}>
                                    {(profile.spotify_display_name || profile.username)[0].toUpperCase()}
                                </Text>
                            </View>
                        )}
                        {profile.is_online && <View style={styles.onlineDot} />}
                    </View>
                    
                    <Text style={styles.name}>{profile.spotify_display_name || profile.username}</Text>
                    <Text style={styles.username}>@{profile.username}</Text>

                    {!profile.is_self && (
                        <Pressable 
                            style={[
                                styles.actionButton, 
                                profile.is_friend ? styles.friendButton : 
                                profile.pending_request ? styles.pendingButton : 
                                !profile.allow_friend_requests ? styles.disabledButton : styles.addButton
                            ]}
                            onPress={handleFriendAction}
                            disabled={actionLoading}
                        >
                            {actionLoading ? (
                                <ActivityIndicator size="small" color={profile.is_friend ? theme.colors.text : "#fff"} />
                            ) : (
                                <>
                                    <Ionicons 
                                        name={
                                            profile.is_friend ? "person-remove" : 
                                            profile.pending_request ? "time-outline" : 
                                            !profile.allow_friend_requests ? "close-circle" : "person-add"
                                        } 
                                        size={18} 
                                        color={profile.is_friend ? theme.colors.danger : "#fff"} 
                                    />
                                    <Text style={[
                                        styles.actionButtonText, 
                                        profile.is_friend && styles.removeButtonText
                                    ]}>
                                        {profile.is_friend ? "Remove Friend" : 
                                         profile.pending_request === 'outgoing' ? "Request Sent" :
                                         profile.pending_request === 'incoming' ? "Accept Request" : 
                                         !profile.allow_friend_requests ? "Not Accepting Requests" : "Add Friend"}
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    )}
                </Animated.View>

                {/* Currently Playing - Live */}
                {isPlaying && currentlyPlaying && (
                    <Animated.View style={styles.section} entering={FadeInUp.springify()}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="radio" size={20} color={theme.colors.accent} />
                            <Text style={[styles.sectionTitle, { color: theme.colors.accent }]}>Now Playing</Text>
                        </View>
                        <Pressable 
                            style={styles.nowPlayingCard}
                            onPress={() => currentlyPlaying.spotify_uri && openInSpotify({
                                uri: currentlyPlaying.spotify_uri,
                                type: 'track',
                                name: currentlyPlaying.name,
                            })}
                        >
                            <Image 
                                source={{ uri: currentlyPlaying.album_image_url || 'https://via.placeholder.com/60' }} 
                                style={styles.nowPlayingImage} 
                            />
                            <View style={styles.nowPlayingInfo}>
                                <Text style={styles.nowPlayingTrack} numberOfLines={1}>{currentlyPlaying.name}</Text>
                                <Text style={styles.nowPlayingArtist} numberOfLines={1}>{currentlyPlaying.artist}</Text>
                                {currentlyPlaying.progress_ms && currentlyPlaying.duration_ms && (
                                    <View style={styles.progressBar}>
                                        <View 
                                            style={[
                                                styles.progressFill, 
                                                { width: `${(currentlyPlaying.progress_ms / currentlyPlaying.duration_ms) * 100}%` }
                                            ]} 
                                        />
                                    </View>
                                )}
                            </View>
                            <Animated.View style={[styles.equalizer, equalizerStyle]}>
                                <Ionicons name="stats-chart" size={24} color={theme.colors.accent} />
                            </Animated.View>
                        </Pressable>
                    </Animated.View>
                )}

                {/* Spotify Not Linked Notice */}
                {spotifyLinked === false && (
                    <Animated.View style={styles.noticeCard} entering={FadeIn.delay(200)}>
                        <Ionicons name="unlink" size={24} color={theme.colors.textMuted} />
                        <Text style={styles.noticeText}>
                            {profile.is_self 
                                ? "Link your Spotify to see your listening stats"
                                : `${profile.spotify_display_name || profile.username} hasn't linked their Spotify to Tonality`
                            }
                        </Text>
                    </Animated.View>
                )}

                {/* Top Genres */}
                {topGenres.length > 0 && (
                    <Animated.View style={styles.section} entering={FadeInDown.delay(100).springify()}>
                        <Text style={styles.sectionTitle}>Favorite Genres</Text>
                        <View style={styles.genresRow}>
                            {topGenres.map((genre, index) => (
                                <Animated.View 
                                    key={index} 
                                    style={styles.genreTag}
                                    entering={FadeIn.delay(150 + index * 50)}
                                >
                                    <Ionicons name="musical-note" size={14} color={theme.colors.accent} />
                                    <Text style={styles.genreText}>{genre}</Text>
                                </Animated.View>
                            ))}
                        </View>
                    </Animated.View>
                )}

                {/* Top 5 Songs */}
                {topTracks.length > 0 && (
                    <Animated.View style={styles.section} entering={FadeInDown.delay(200).springify()}>
                        <Text style={styles.sectionTitle}>Top 5 Songs</Text>
                        {topTracks.map((track, index) => renderTrackCard(track, index, true))}
                    </Animated.View>
                )}

                {/* Recent Listening History - Friends/Self Only */}
                {(profile.is_friend || profile.is_self) && spotifyLinked !== false && (
                    <Animated.View style={styles.section} entering={FadeInDown.delay(300).springify()}>
                        <Text style={styles.sectionTitle}>Recent Listening</Text>
                        {recentTracks.length > 0 ? (
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.horizontalScroll}
                            >
                                {recentTracks.slice(0, 10).map((track, index) => (
                                    <Animated.View 
                                        key={`${track.id}-${index}`}
                                        entering={SlideInRight.delay(index * 50)}
                                    >
                                        <Pressable 
                                            style={styles.recentCard}
                                            onPress={() => track.spotify_uri && openInSpotify({
                                                uri: track.spotify_uri,
                                                type: 'track',
                                                name: track.name,
                                            })}
                                        >
                                            {track.album_image_url ? (
                                                <Image source={{ uri: track.album_image_url }} style={styles.recentImage} />
                                            ) : (
                                                <View style={[styles.recentImage, styles.trackImagePlaceholder]}>
                                                    <Ionicons name="musical-note" size={24} color={theme.colors.textMuted} />
                                                </View>
                                            )}
                                            <Text style={styles.recentName} numberOfLines={2}>{track.name}</Text>
                                            <Text style={styles.recentArtist} numberOfLines={1}>{track.artist}</Text>
                                        </Pressable>
                                    </Animated.View>
                                ))}
                            </ScrollView>
                        ) : (
                            <View style={styles.emptySection}>
                                <Ionicons name="time-outline" size={32} color={theme.colors.textMuted} />
                                <Text style={styles.emptySectionText}>No recent listening history available</Text>
                            </View>
                        )}
                    </Animated.View>
                )}

                {/* Compare Listening - Friends Only */}
                {profile.is_friend && (
                    <Animated.View style={styles.section} entering={FadeInDown.delay(400).springify()}>
                        <Pressable 
                            style={styles.compareButton}
                            onPress={handleToggleCompare}
                        >
                            <Ionicons name="git-compare" size={20} color={theme.colors.accent} />
                            <Text style={styles.compareButtonText}>
                                {showCompare ? 'Hide' : 'Compare'} Listening
                            </Text>
                            {loadingCompare ? (
                                <ActivityIndicator size="small" color={theme.colors.accent} />
                            ) : (
                                <Ionicons 
                                    name={showCompare ? "chevron-up" : "chevron-down"} 
                                    size={20} 
                                    color={theme.colors.accent} 
                                />
                            )}
                        </Pressable>
                        
                        {showCompare && (
                            <Animated.View entering={FadeInDown.springify()}>
                                <Text style={styles.subsectionTitle}>
                                    Mutual Songs (Recent)
                                </Text>
                                {loadingCompare ? (
                                    <View style={styles.emptyCompare}>
                                        <ActivityIndicator size="large" color={theme.colors.accent} />
                                        <Text style={styles.emptyCompareText}>
                                            Finding mutual songs...
                                        </Text>
                                    </View>
                                ) : compareError ? (
                                    <View style={styles.emptyCompare}>
                                        <Ionicons name="alert-circle-outline" size={40} color={theme.colors.textMuted} />
                                        <Text style={styles.emptyCompareText}>
                                            {compareError}
                                        </Text>
                                    </View>
                                ) : mutualTracks.length === 0 ? (
                                    <View style={styles.emptyCompare}>
                                        <Ionicons name="musical-notes-outline" size={40} color={theme.colors.textMuted} />
                                        <Text style={styles.emptyCompareText}>
                                            No mutual songs in recent listening history
                                        </Text>
                                    </View>
                                ) : (
                                    mutualTracks.map((track, index) => renderTrackCard(track, index))
                                )}
                            </Animated.View>
                        )}
                    </Animated.View>
                )}

                {/* Last Listening Activity (fallback when not live) */}
                {!isPlaying && profile.listening_activity && (
                    <Animated.View style={styles.section} entering={FadeInDown.delay(300).springify()}>
                        <Text style={styles.sectionTitle}>Last Listened To</Text>
                        <Pressable 
                            style={styles.activityCard}
                            onPress={() => profile.listening_activity?.spotify_uri && openInSpotify({
                                uri: profile.listening_activity.spotify_uri,
                                type: 'track',
                                name: profile.listening_activity.track_name,
                            })}
                        >
                            <Image 
                                source={{ uri: profile.listening_activity.album_image_url || 'https://via.placeholder.com/60' }} 
                                style={styles.activityImage} 
                            />
                            <View style={styles.activityInfo}>
                                <Text style={styles.activityTrack}>{profile.listening_activity.track_name}</Text>
                                <Text style={styles.activityArtist}>{profile.listening_activity.artist_name}</Text>
                            </View>
                            <Ionicons name="play-circle-outline" size={24} color={theme.colors.textMuted} />
                        </Pressable>
                    </Animated.View>
                )}

                {/* Communities */}
                <Animated.View style={styles.section} entering={FadeInDown.delay(400).springify()}>
                    <Text style={styles.sectionTitle}>Communities</Text>
                    {profile.communities.length === 0 ? (
                        <Text style={styles.emptyText}>No communities yet</Text>
                    ) : (
                        <View style={styles.communitiesGrid}>
                            {profile.communities.map((community, index) => (
                                <Animated.View 
                                    key={community.id}
                                    entering={FadeIn.delay(450 + index * 50)}
                                >
                                    <Pressable 
                                        style={styles.communityTag}
                                        onPress={() => router.push(`/community/${community.id}`)}
                                    >
                                        <Ionicons name={community.icon_name as any || "musical-notes"} size={14} color={theme.colors.accent} />
                                        <Text style={styles.communityName}>{community.name}</Text>
                                    </Pressable>
                                </Animated.View>
                            ))}
                        </View>
                    )}
                </Animated.View>
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
        gap: 32,
        paddingBottom: 48,
    },
    header: {
        alignItems: 'center',
        gap: 8,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 8,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    avatarPlaceholder: {
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    avatarText: {
        fontSize: 40,
        fontWeight: '600',
        color: theme.colors.text,
    },
    onlineDot: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: theme.colors.success,
        borderWidth: 3,
        borderColor: theme.colors.background,
    },
    name: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.colors.text,
    },
    username: {
        fontSize: 16,
        color: theme.colors.textMuted,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
        marginTop: 16,
        minWidth: 140,
        justifyContent: 'center',
    },
    addButton: {
        backgroundColor: theme.colors.accent,
    },
    friendButton: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    pendingButton: {
        backgroundColor: theme.colors.surfaceMuted,
    },
    disabledButton: {
        backgroundColor: theme.colors.surfaceMuted,
        opacity: 0.7,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    removeButtonText: {
        color: theme.colors.danger,
    },
    section: {
        gap: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.text,
    },
    subsectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.colors.textMuted,
        marginTop: 12,
        marginBottom: 12,
    },
    nowPlayingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(29, 185, 84, 0.1)',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        gap: 12,
    },
    nowPlayingImage: {
        width: 64,
        height: 64,
        borderRadius: 8,
    },
    nowPlayingInfo: {
        flex: 1,
        gap: 4,
    },
    nowPlayingTrack: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.colors.text,
    },
    nowPlayingArtist: {
        fontSize: 14,
        color: theme.colors.textMuted,
    },
    progressBar: {
        height: 3,
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: 2,
        marginTop: 8,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: theme.colors.accent,
        borderRadius: 2,
    },
    equalizer: {
        padding: 8,
    },
    noticeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: theme.colors.surface,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    noticeText: {
        flex: 1,
        fontSize: 14,
        color: theme.colors.textMuted,
    },
    activityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 12,
    },
    activityImage: {
        width: 56,
        height: 56,
        borderRadius: 8,
    },
    activityInfo: {
        flex: 1,
        gap: 4,
    },
    activityTrack: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    activityArtist: {
        fontSize: 14,
        color: theme.colors.textMuted,
    },
    emptyText: {
        color: theme.colors.textMuted,
        fontStyle: 'italic',
    },
    communitiesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    communityTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: theme.colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    communityName: {
        fontSize: 14,
        color: theme.colors.text,
        fontWeight: '500',
    },
    trackCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 12,
        marginBottom: 8,
    },
    trackRank: {
        fontSize: 14,
        fontWeight: '700',
        color: theme.colors.accent,
        width: 24,
    },
    trackImage: {
        width: 48,
        height: 48,
        borderRadius: 6,
    },
    trackImagePlaceholder: {
        backgroundColor: theme.colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    trackInfo: {
        flex: 1,
        gap: 2,
    },
    trackName: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.colors.text,
    },
    trackArtist: {
        fontSize: 13,
        color: theme.colors.textMuted,
    },
    genresRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    genreTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(29, 185, 84, 0.1)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.accent,
    },
    genreText: {
        fontSize: 14,
        color: theme.colors.accent,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    horizontalScroll: {
        paddingRight: 24,
        gap: 12,
    },
    recentCard: {
        width: 120,
        gap: 8,
    },
    recentImage: {
        width: 120,
        height: 120,
        borderRadius: 8,
    },
    recentName: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.text,
    },
    recentArtist: {
        fontSize: 12,
        color: theme.colors.textMuted,
    },
    compareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: theme.colors.surface,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.accent,
    },
    compareButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.accent,
    },
    emptyCompare: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 12,
    },
    emptyCompareText: {
        fontSize: 14,
        color: theme.colors.textMuted,
        textAlign: 'center',
    },
    emptySection: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 12,
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    emptySectionText: {
        fontSize: 14,
        color: theme.colors.textMuted,
        textAlign: 'center',
    },
});
