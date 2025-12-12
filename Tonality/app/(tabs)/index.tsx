import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpotifyAuth } from '../../hooks/useSpotifyAuth';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCurrentlyPlayingTrack, fetchUserProfile, fetchUserTopTracks } from '../../api/spotify';
import { Ionicons } from '@expo/vector-icons';
import { useTonalityAuth } from '../../hooks/useTonalityAuth';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../context/ThemeContext';

// Mock data for popular songs by genre
const mockPopularByGenre = [
    { genre: 'Indie', songs: [{ name: 'Little Dark Age', artist: 'MGMT' }, { name: 'Heat Waves', artist: 'Glass Animals' }] },
    { genre: 'Electronic', songs: [{ name: 'Midnight City', artist: 'M83' }, { name: 'Strobe', artist: 'Deadmau5' }] },
    { genre: 'Pop', songs: [{ name: 'Blinding Lights', artist: 'The Weeknd' }, { name: 'Levitating', artist: 'Dua Lipa' }] },
];

// Mock recommended songs
const mockRecommended = [
    { name: 'Dissolve', artist: 'Absofacto', reason: 'Because you like MGMT' },
    { name: 'Sweater Weather', artist: 'The Neighbourhood', reason: 'Popular with your friends' },
    { name: 'Electric Feel', artist: 'MGMT', reason: 'Based on your top tracks' },
];

export default function HomeScreen() {
    const { token, promptAsync } = useSpotifyAuth();
    const { user, isAuthenticated, loading } = useTonalityAuth();
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const [profile, setProfile] = useState<any>(null);
    const [songOfDay, setSongOfDay] = useState<any>(null);
    const [currentlyPlaying, setCurrentlyPlaying] = useState<any>(null);
    const routerInstance = useRouter();

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
        .catch(err => {
            console.error('Error loading profile', err);
        });

    const fetchTrack = async () => {
        try {
            const data = await fetchCurrentlyPlayingTrack(token);

            if (!isMounted) return;

            if (data && data.item) {
                setCurrentlyPlaying(data.item);
            } else {
                setCurrentlyPlaying(null); // Nothing playing / 204
            }
        } catch (err) {
            console.error('Error fetching currently playing track:', err);
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
        if (!token) return;
        try {
            const data = await fetchUserTopTracks(token, 'short_term', 20);
            if (data?.items && data.items.length > 0) {
                const randomIndex = Math.floor(Math.random() * data.items.length);
                setSongOfDay(data.items[randomIndex]);
            }
        } catch (error) {
            console.error('Error loading song of day:', error);
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            loadSongOfDay();
        } else {
            setSongOfDay(null);
        }
    }, [token, loadSongOfDay]);

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
            <ScrollView contentContainerStyle={styles.scrollContent}>
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
                                    onPress={() => {
                                        // You can route to a dedicated screen later if you want
                                        // routerInstance.push('/(tabs)/currently-listening');
                                    }}
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
                                    <Ionicons name="play-circle" size={24} color={theme.colors.accent} />
                                </Pressable>
                            )}
                        </>
                    ) : (
                        <>
                            <Text style={styles.connectHint}>
                                Connect Spotify for personalized recommendations
                            </Text>
                            <Pressable style={styles.primaryButton} onPress={handleConnect}>
                                <Ionicons name="link" size={20} color="#fff" />
                                <Text style={styles.primaryButtonText}>Link Spotify</Text>
                            </Pressable>
                        </>
                    )}
                </View>

                {/* Song of the Day */}
                {isConnected && songOfDay && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="sunny" size={18} color={theme.colors.accent} />
                            <Text style={styles.sectionTitle}>Song of the Day</Text>
                        </View>
                        <View style={styles.sotdCard}>
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
                                <Pressable style={styles.playButton} onPress={loadSongOfDay}>
                                    <Ionicons name="refresh" size={14} color={theme.colors.accent} />
                                    <Text style={styles.playButtonText}>Refresh</Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                )}

                {/* Popular Songs by Genre */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="flame" size={18} color={theme.colors.accent} />
                        <Text style={styles.sectionTitle}>Popular in Your Genres</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {mockPopularByGenre.map((genre, idx) => (
                            <View key={idx} style={styles.genreCard}>
                                <Text style={styles.genreName}>{genre.genre}</Text>
                                {genre.songs.map((song, sIdx) => (
                                    <View key={sIdx} style={styles.genreSongRow}>
                                        <Text style={styles.genreSongNumber}>{sIdx + 1}</Text>
                                        <View style={styles.genreSongInfo}>
                                            <Text style={styles.genreSongName} numberOfLines={1}>{song.name}</Text>
                                            <Text style={styles.genreSongArtist} numberOfLines={1}>{song.artist}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* Recommended for You */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="heart" size={18} color={theme.colors.accent} />
                        <Text style={styles.sectionTitle}>Recommended for You</Text>
                    </View>
                    {mockRecommended.map((song, idx) => (
                        <View key={idx} style={styles.recommendedCard}>
                            <View style={styles.recommendedIcon}>
                                <Ionicons name="musical-note" size={20} color={theme.colors.accent} />
                            </View>
                            <View style={styles.recommendedInfo}>
                                <Text style={styles.recommendedName}>{song.name}</Text>
                                <Text style={styles.recommendedArtist}>{song.artist}</Text>
                                <Text style={styles.recommendedReason}>{song.reason}</Text>
                            </View>
                            <Pressable style={styles.addButton}>
                                <Ionicons name="add" size={20} color={theme.colors.accent} />
                            </Pressable>
                        </View>
                    ))}
                </View>

                {/* Quick Links */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Links</Text>
                    <View style={styles.quickLinksRow}>
                        <Pressable style={styles.quickLinkCard} onPress={() => routerInstance.push('/(tabs)/community')}>
                            <Ionicons name="people" size={24} color={theme.colors.accent} />
                            <Text style={styles.quickLinkText}>Community</Text>
                        </Pressable>
                        <Pressable style={styles.quickLinkCard} onPress={() => routerInstance.push('/(tabs)/friends')}>
                            <Ionicons name="person-add" size={24} color={theme.colors.accent} />
                            <Text style={styles.quickLinkText}>Friends</Text>
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
    playButtonText: {
        fontSize: 13,
        color: theme.colors.accent,
        fontWeight: '600',
    },
    // Genre cards
    genreCard: {
        width: 180,
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
        gap: 8,
    },
    genreSongNumber: {
        fontSize: 14,
        fontWeight: '700',
        color: theme.colors.textMuted,
        width: 20,
    },
    genreSongInfo: {
        flex: 1,
    },
    genreSongName: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
    },
    genreSongArtist: {
        fontSize: 12,
        color: theme.colors.textMuted,
    },
    recommendedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 12,
    },
    recommendedIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
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
