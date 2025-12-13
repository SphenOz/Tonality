import { View, Text, StyleSheet, Pressable, ScrollView, Image, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpotifyAuth } from '../../hooks/useSpotifyAuth';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { fetchCurrentlyPlayingTrack, fetchUserProfile, fetchUserTopTracks } from '../../api/spotify';
import { Ionicons } from '@expo/vector-icons';
import { useTonalityAuth } from '../../hooks/useTonalityAuth';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../context/ThemeContext';
import { API_BASE_URL } from '../../utils/runtimeConfig';
import { openInSpotify } from '../../utils/spotifyLinks';

interface SpotifyTrack {
    id: string;
    name: string;
    artist: string;
    album?: string;
    album_image_url?: string;
    spotify_uri: string;
    preview_url?: string;
}

interface GenreWithTracks {
    genre: string;
    tracks: SpotifyTrack[];
}

export default function HomeScreen() {
    const { token, promptAsync, refreshToken } = useSpotifyAuth();
    const { user, isAuthenticated, loading, token: authToken } = useTonalityAuth();
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const [profile, setProfile] = useState<any>(null);
    const [songOfDay, setSongOfDay] = useState<any>(null);
    const [sotdError, setSotdError] = useState<string | null>(null);
    const [currentlyPlaying, setCurrentlyPlaying] = useState<any>(null);
    const [recommendations, setRecommendations] = useState<SpotifyTrack[]>([]);
    const [genreTracks, setGenreTracks] = useState<GenreWithTracks[]>([]);
    const [loadingRecs, setLoadingRecs] = useState(false);
    const [loadingGenres, setLoadingGenres] = useState(false);
    const routerInstance = useRouter();
    
    // Keep a ref to the latest token for use in async callbacks
    const tokenRef = useRef(token);
    useEffect(() => {
        tokenRef.current = token;
    }, [token]);
    
    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    
    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, slideAnim]);

    // Clear all Spotify-related data when disconnected
    useEffect(() => {
        if (!token) {
            setProfile(null);
            setCurrentlyPlaying(null);
            setRecommendations([]);
            setGenreTracks([]);
        }
    }, [token]);

    useEffect(() => {
    if (!token) {
        setProfile(null);
        setCurrentlyPlaying(null);
        return;
    }

    let isMounted = true;

    // Fetch profile once on load (doesn't need polling)
    fetchUserProfile(token)
        .then(profile => {
            if (isMounted) setProfile(profile);
        })
        .catch(async (err) => {
            console.error('Error loading profile', err);
            if (err.message && err.message.includes('401')) {
                const newToken = await refreshToken();
                if (newToken && isMounted) {
                    // Retry with new token
                    try {
                        const retryProfile = await fetchUserProfile(newToken);
                        if (isMounted) setProfile(retryProfile);
                    } catch (retryErr) {
                        console.error('Retry failed:', retryErr);
                    }
                }
            }
        });

    const fetchTrack = async (retryWithToken?: string) => {
        const currentToken = retryWithToken || tokenRef.current;
        if (!currentToken) return;
        
        try {
            const data = await fetchCurrentlyPlayingTrack(currentToken);

            if (!isMounted) return;

            if (data && data.item) {
                setCurrentlyPlaying(data.item);
            } else {
                setCurrentlyPlaying(null); // Nothing playing / 204
            }
        } catch (err: any) {
            console.error('Error fetching currently playing track:', err);
            if (err.message && err.message.includes('401') && !retryWithToken) {
                console.log('Token expired, attempting refresh...');
                const newToken = await refreshToken();
                if (newToken && isMounted) {
                    // Retry immediately with the new token
                    await fetchTrack(newToken);
                    return;
                }
            }
            if (isMounted) setCurrentlyPlaying(null);
        }
    };

    // Fetch immediately
    fetchTrack();

    // Poll every 5 seconds
    const intervalId = setInterval(fetchTrack, 5000);

    // Cleanup on unmount or token change
    return () => {
        isMounted = false;
        clearInterval(intervalId);
    };

}, [token]);



    const loadSongOfDay = useCallback(async () => {
        // Song of the Day is global (same for all users) - fetched from backend
        try {
            setSotdError(null);
            const response = await fetch(`${API_BASE_URL}/api/song-of-day`);
            const data = await response.json();
            
            if (response.ok && data.track) {
                // Transform to match expected format
                setSongOfDay({
                    id: data.track.id,
                    name: data.track.name,
                    artists: [{ name: data.track.artist }],
                    album: { 
                        name: data.track.album,
                        images: data.track.album_image_url ? [{ url: data.track.album_image_url }] : []
                    },
                    uri: data.track.spotify_uri,
                });
            } else if (data.error) {
                setSotdError(data.error);
            }
        } catch (error) {
            console.error('Error loading song of day:', error);
            setSotdError('Failed to connect to server');
        }
    }, []);

    const loadRecommendations = useCallback(async () => {
        if (!authToken) return;
        setLoadingRecs(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/spotify/recommendations`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            if (response.ok) {
                const data = await response.json();
                setRecommendations(data.tracks || []);
            }
        } catch (error) {
            console.error('Error loading recommendations:', error);
        } finally {
            setLoadingRecs(false);
        }
    }, [authToken]);

    const loadGenreTracks = useCallback(async () => {
        if (!authToken) return;
        setLoadingGenres(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/spotify/genre-tracks`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            if (response.ok) {
                const data = await response.json();
                setGenreTracks(data.genres || []);
            }
        } catch (error) {
            console.error('Error loading genre tracks:', error);
        } finally {
            setLoadingGenres(false);
        }
    }, [authToken]);

    useEffect(() => {
        // Song of the Day is global - load it regardless of Spotify connection
        loadSongOfDay();
    }, [loadSongOfDay]);

    useEffect(() => {
        if (authToken && token) {
            loadRecommendations();
            loadGenreTracks();
        }
    }, [authToken, token, loadRecommendations, loadGenreTracks]);

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            routerInstance.replace('/');
        }
    }, [loading, isAuthenticated, routerInstance]);

    if (loading || !isAuthenticated) {
        return null;
    }

    const handleConnect = () => {
        if (!token) {
            promptAsync();
        }
    };

    const isConnected = Boolean(token);

    return (
        <SafeAreaView style={styles.container}>
            <Animated.ScrollView 
                contentContainerStyle={styles.scrollContent}
                style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerBadge}>
                        <Ionicons name="sparkles" size={14} color={theme.colors.accent} />
                        <Text style={styles.headerBadgeText}>Good to see you, {user?.username?.split('@')[0] || 'friend'}</Text>
                    </View>
                    <Text style={styles.appName}>Tonality</Text>

                    {isConnected ? (
                        <>
                            <View style={styles.connectedBadge}>
                                <Ionicons name="musical-note" size={16} color={theme.colors.accent} />
                                <Text style={styles.connectedText}>
                                    Connected as {profile?.display_name || 'Spotify User'}
                                </Text>
                            </View>

                            {currentlyPlaying && (
                                <Pressable
                                    style={styles.nowPlayingBadge}
                                    onPress={() => openInSpotify({ id: currentlyPlaying.id, type: 'track', name: currentlyPlaying.name })}
                                >
                                    {currentlyPlaying.album?.images?.[0]?.url && (
                                        <Image
                                            source={{ uri: currentlyPlaying.album.images[0].url }}
                                            style={styles.nowPlayingImage}
                                        />
                                    )}
                                    <View style={styles.nowPlayingInfo}>
                                        <Text style={styles.nowPlayingLabel}>Currently listening</Text>
                                        <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                                            {currentlyPlaying.name}
                                        </Text>
                                        <Text style={styles.nowPlayingArtist} numberOfLines={1}>
                                            {currentlyPlaying.artists?.map((a: any) => a.name).join(', ')}
                                        </Text>
                                    </View>
                                    <Ionicons name="play-circle" size={28} color={theme.colors.accent} />
                                </Pressable>
                            )}
                        </>
                    ) : (
                        <>
                            <Text style={styles.connectHint}>
                                Connect Spotify for personalized recommendations
                            </Text>
                            <Pressable 
                                style={({ pressed }) => [
                                    styles.primaryButton,
                                    pressed && styles.primaryButtonPressed,
                                ]} 
                                onPress={handleConnect}
                            >
                                <Ionicons name="link" size={20} color="#fff" />
                                <Text style={styles.primaryButtonText}>Link Spotify</Text>
                            </Pressable>
                        </>
                    )}
                </View>

                {/* Song of the Day - Global for all users */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="sunny" size={18} color={theme.colors.accent} />
                        <Text style={styles.sectionTitle}>Song of the Day</Text>
                    </View>
                    
                    {sotdError ? (
                        <View style={[styles.sotdCard, { justifyContent: 'center', alignItems: 'center', padding: 20, minHeight: 100 }]}>
                            <Ionicons name="warning-outline" size={24} color={theme.colors.textSecondary} />
                            <Text style={{ color: theme.colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
                                {sotdError}
                            </Text>
                        </View>
                    ) : songOfDay ? (
                        <Pressable 
                            style={({ pressed }) => [
                                styles.sotdCard,
                                pressed && styles.sotdCardPressed,
                            ]}
                            onPress={() => openInSpotify({ id: songOfDay.id, type: 'track', name: songOfDay.name })}
                        >
                            {songOfDay.album?.images?.[0]?.url && (
                                <Image
                                    source={{ uri: songOfDay.album.images[0].url }}
                                    style={styles.sotdImage}
                                />
                            )}
                            <View style={styles.sotdInfo}>
                                <Text style={styles.sotdName} numberOfLines={1}>{songOfDay.name}</Text>
                                <Text style={styles.sotdArtist} numberOfLines={1}>
                                    {songOfDay.artists?.map((a: any) => a.name).join(', ')}
                                </Text>
                                <View style={styles.playButtonRow}>
                                    <Pressable style={styles.playButton} onPress={(e) => { e.stopPropagation(); openInSpotify({ id: songOfDay.id, type: 'track' }); }}>
                                        <Ionicons name="play-circle" size={16} color={theme.colors.accent} />
                                        <Text style={styles.playButtonText}>Play on Spotify</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </Pressable>
                    ) : (
                        <View style={[styles.sotdCard, { justifyContent: 'center', alignItems: 'center', padding: 20, minHeight: 100 }]}>
                            <ActivityIndicator color={theme.colors.accent} />
                        </View>
                    )}
                </View>

                {/* Popular Songs by Genre */}
                {isConnected && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="flame" size={18} color={theme.colors.accent} />
                            <Text style={styles.sectionTitle}>Popular in Your Genres</Text>
                        </View>
                        {loadingGenres ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color={theme.colors.accent} />
                                <Text style={styles.loadingText}>Loading your genres...</Text>
                            </View>
                        ) : genreTracks.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyStateText}>Listen to more music to see genre recommendations</Text>
                            </View>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {genreTracks.map((genre, idx) => (
                                    <View key={idx} style={styles.genreCard}>
                                        <Text style={styles.genreName}>{genre.genre}</Text>
                                        {genre.tracks.map((track, sIdx) => (
                                            <Pressable 
                                                key={sIdx} 
                                                style={styles.genreSongRow}
                                                onPress={() => openInSpotify({ id: track.id, type: 'track', name: track.name })}
                                            >
                                                {track.album_image_url && (
                                                    <Image source={{ uri: track.album_image_url }} style={styles.genreSongImage} />
                                                )}
                                                <View style={styles.genreSongInfo}>
                                                    <Text style={styles.genreSongName} numberOfLines={1}>{track.name}</Text>
                                                    <Text style={styles.genreSongArtist} numberOfLines={1}>{track.artist}</Text>
                                                </View>
                                            </Pressable>
                                        ))}
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}

                {/* Recommended for You */}
                {isConnected && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="heart" size={18} color={theme.colors.accent} />
                            <Text style={styles.sectionTitle}>Recommended for You</Text>
                        </View>
                        {loadingRecs ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color={theme.colors.accent} />
                                <Text style={styles.loadingText}>Getting recommendations...</Text>
                            </View>
                        ) : recommendations.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyStateText}>Listen to more music to get personalized recommendations</Text>
                            </View>
                        ) : (
                            recommendations.slice(0, 5).map((track, idx) => (
                                <Pressable 
                                    key={idx} 
                                    style={({ pressed }) => [
                                        styles.recommendedCard,
                                        pressed && styles.recommendedCardPressed,
                                    ]}
                                    onPress={() => openInSpotify({ id: track.id, type: 'track', name: track.name })}
                                >
                                    {track.album_image_url ? (
                                        <Image source={{ uri: track.album_image_url }} style={styles.recommendedImage} />
                                    ) : (
                                        <View style={styles.recommendedIcon}>
                                            <Ionicons name="musical-note" size={20} color={theme.colors.accent} />
                                        </View>
                                    )}
                                    <View style={styles.recommendedInfo}>
                                        <Text style={styles.recommendedName} numberOfLines={1}>{track.name}</Text>
                                        <Text style={styles.recommendedArtist} numberOfLines={1}>{track.artist}</Text>
                                        <Text style={styles.recommendedReason}>Based on your listening</Text>
                                    </View>
                                    <Pressable 
                                        style={styles.playIconButton}
                                        onPress={() => openInSpotify({ id: track.id, type: 'track' })}
                                    >
                                        <Ionicons name="play-circle" size={28} color={theme.colors.accent} />
                                    </Pressable>
                                </Pressable>
                            ))
                        )}
                    </View>
                )}

                {/* Quick Links */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Links</Text>
                    <View style={styles.quickLinksRow}>
                        <Pressable 
                            style={({ pressed }) => [
                                styles.quickLinkCard,
                                pressed && styles.quickLinkCardPressed,
                            ]} 
                            onPress={() => routerInstance.push('/(tabs)/community')}
                        >
                            <Ionicons name="people" size={24} color={theme.colors.accent} />
                            <Text style={styles.quickLinkText}>Community</Text>
                        </Pressable>
                        <Pressable 
                            style={({ pressed }) => [
                                styles.quickLinkCard,
                                pressed && styles.quickLinkCardPressed,
                            ]} 
                            onPress={() => routerInstance.push('/(tabs)/friends')}
                        >
                            <Ionicons name="person-add" size={24} color={theme.colors.accent} />
                            <Text style={styles.quickLinkText}>Friends</Text>
                        </Pressable>
                    </View>
                </View>
            </Animated.ScrollView>
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
        gap: 10,
    },
    headerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    headerBadgeText: {
        fontSize: 12,
        color: theme.colors.text,
        fontWeight: '600',
    },
    appName: {
        fontSize: 32,
        fontWeight: '800',
        color: theme.colors.text,
        textAlign: 'center',
    },
    connectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        backgroundColor: theme.colors.accentMuted,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        gap: 6,
    },
    connectedText: {
        fontSize: 13,
        color: theme.colors.accent,
        fontWeight: '600',
    },
    connectHint: {
        marginTop: 8,
        fontSize: 14,
        color: theme.colors.textMuted,
        textAlign: 'center',
    },
    primaryButton: {
        marginTop: 12,
        backgroundColor: theme.colors.accent,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    primaryButtonPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }],
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    section: {
        gap: 12,
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
    // Song of the Day
    sotdCard: {
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 16,
        alignItems: 'center',
    },
    sotdCardPressed: {
        backgroundColor: theme.colors.border,
        transform: [{ scale: 0.98 }],
    },
    sotdImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
    },
    sotdInfo: {
        flex: 1,
        gap: 4,
    },
    sotdName: {
        fontSize: 17,
        fontWeight: '700',
        color: theme.colors.text,
    },
    sotdArtist: {
        fontSize: 14,
        color: theme.colors.textMuted,
    },
    playButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
    },
    playButtonRow: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 8,
    },
    playButtonText: {
        fontSize: 13,
        color: theme.colors.accent,
        fontWeight: '600',
    },
    // Loading and empty states
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    loadingText: {
        fontSize: 13,
        color: theme.colors.textMuted,
    },
    emptyState: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    emptyStateText: {
        fontSize: 13,
        color: theme.colors.textMuted,
        textAlign: 'center',
    },
    // Genre cards
    genreCard: {
        width: 200,
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 16,
        marginRight: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 10,
    },
    genreName: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.colors.accent,
        marginBottom: 4,
    },
    genreSongRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 4,
    },
    genreSongImage: {
        width: 36,
        height: 36,
        borderRadius: 6,
    },
    genreSongInfo: {
        flex: 1,
    },
    genreSongNumber: {
        fontSize: 14,
        fontWeight: '700',
        color: theme.colors.textMuted,
        width: 20,
    },
    genreSongName: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.text,
    },
    genreSongArtist: {
        fontSize: 11,
        color: theme.colors.textMuted,
    },
    recommendedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 12,
        marginBottom: 8,
    },
    recommendedCardPressed: {
        backgroundColor: theme.colors.border,
        transform: [{ scale: 0.98 }],
    },
    recommendedImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
    },
    recommendedIcon: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: theme.colors.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recommendedInfo: {
        flex: 1,
        gap: 2,
    },
    recommendedName: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.colors.text,
    },
    recommendedArtist: {
        fontSize: 13,
        color: theme.colors.textMuted,
    },
    recommendedReason: {
        fontSize: 11,
        color: theme.colors.accent,
        fontStyle: 'italic',
    },
    playIconButton: {
        padding: 4,
    },
    addButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickLinksRow: {
        flexDirection: 'row',
        gap: 12,
    },
    quickLinkCard: {
        flex: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    quickLinkCardPressed: {
        backgroundColor: theme.colors.border,
        transform: [{ scale: 0.96 }],
    },
    quickLinkText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
    },nowPlayingBadge: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignSelf: 'stretch',
    },
    nowPlayingImage: {
        width: 40,
        height: 40,
        borderRadius: 8,
    },
    nowPlayingInfo: {
        flex: 1,
        gap: 2,
    },
    nowPlayingLabel: {
        fontSize: 11,
        color: theme.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: '600',
    },
    nowPlayingTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: theme.colors.text,
    },
    nowPlayingArtist: {
        fontSize: 12,
        color: theme.colors.textMuted,
    },

});
