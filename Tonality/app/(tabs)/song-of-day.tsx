import { View, Text, StyleSheet, Image, Pressable, Linking, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpotifyAuth } from '../../hooks/useSpotifyAuth';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { fetchUserTopTracks } from '../../api/spotify';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../context/ThemeContext';

export default function SongOfDayScreen() {
    const { token, promptAsync, refreshToken } = useSpotifyAuth();
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const [songOfDay, setSongOfDay] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    
    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    
    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, scaleAnim, songOfDay]);

    const loadSongOfDay = useCallback(async () => {
        if (!token) return;
        try {
            setLoading(true);
            const data = await fetchUserTopTracks(token, 'short_term', 20);
            if (data?.items && data.items.length > 0) {
                const randomIndex = Math.floor(Math.random() * data.items.length);
                setSongOfDay(data.items[randomIndex]);
            } else {
                setSongOfDay(null);
            }
        } catch (error: any) {
            console.error('Error loading song of day:', error);
            if (error.message && error.message.includes('401')) {
                await refreshToken();
            }
        } finally {
            setLoading(false);
        }
    }, [token, refreshToken]);

    useEffect(() => {
        if (token) {
            loadSongOfDay();
        } else {
            setSongOfDay(null);
            setLoading(false);
        }
    }, [token, loadSongOfDay]);

    const openInSpotify = () => {
        if (songOfDay?.external_urls?.spotify) {
            Linking.openURL(songOfDay.external_urls.spotify);
        }
    };

    const handleConnect = () => {
        if (!token) {
            promptAsync();
        }
    };

    if (!token) {
        return (
            <SafeAreaView style={styles.containerCentered}>
                <View style={styles.emptyCard}>
                    <Ionicons name="musical-notes" size={52} color={theme.colors.accent} />
                    <Text style={styles.title}>Song of the Day</Text>
                    <Text style={styles.description}>
                        Connect Spotify to let Tonality craft a daily track based on your freshest plays.
                    </Text>
                    <Pressable style={styles.primaryButton} onPress={handleConnect}>
                        <Ionicons name="link" size={20} color="#fff" />
                        <Text style={styles.primaryButtonText}>Link Spotify</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={styles.containerCentered}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Text style={styles.loadingText}>Finding your song of the day...</Text>
            </SafeAreaView>
        );
    }

    if (!songOfDay) {
        return (
            <SafeAreaView style={styles.containerCentered}>
                <Text style={styles.title}>Song of the Day</Text>
                <Text style={styles.description}>
                    No tracks found. Try listening to more music on Spotify and then refresh.
                </Text>
                <Pressable style={styles.secondaryButton} onPress={loadSongOfDay}>
                    <Ionicons name="refresh" size={18} color={theme.colors.text} />
                    <Text style={styles.secondaryButtonText}>Try Again</Text>
                </Pressable>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Song of the Day</Text>
                <Text style={styles.subtitle}>Based on your listening habits</Text>
            </View>

            <Animated.View style={[styles.songCard, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
                {songOfDay.album?.images?.[0]?.url && (
                    <Image
                        source={{ uri: songOfDay.album.images[0].url }}
                        style={styles.albumArt}
                    />
                )}

                <Text style={styles.songTitle}>{songOfDay.name}</Text>
                <Text style={styles.artistName}>
                    {songOfDay.artists?.map((a: any) => a.name).join(', ')}
                </Text>
                <Text style={styles.albumName}>{songOfDay.album?.name}</Text>

                <Pressable style={styles.playButton} onPress={openInSpotify}>
                    <Ionicons name="play" size={20} color="#000" />
                    <Text style={styles.playButtonText}>Play on Spotify</Text>
                </Pressable>

                <Pressable style={styles.refreshButton} onPress={loadSongOfDay}>
                    <Ionicons name="refresh" size={18} color={theme.colors.textMuted} />
                    <Text style={styles.refreshButtonText}>Spin again</Text>
                </Pressable>
            </Animated.View>
        </SafeAreaView>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        padding: 20,
    },
    containerCentered: {
        flex: 1,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    emptyCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: theme.colors.surface,
        borderRadius: 28,
        alignItems: 'center',
        padding: 32,
        gap: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    header: {
        marginTop: 12,
        marginBottom: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: theme.colors.text,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: theme.colors.textMuted,
        marginTop: 6,
        textAlign: 'center',
    },
    loadingText: {
        marginTop: 20,
        color: theme.colors.textMuted,
    },
    description: {
        marginTop: 6,
        fontSize: 14,
        color: theme.colors.textMuted,
        textAlign: 'center',
        lineHeight: 20,
    },
    songCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 32,
        padding: 26,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
        width: '100%',
        maxWidth: 380,
        gap: 12,
    },
    albumArt: {
        width: 220,
        height: 220,
        borderRadius: 24,
    },
    songTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.colors.text,
        textAlign: 'center',
    },
    artistName: {
        fontSize: 16,
        color: theme.colors.textMuted,
        textAlign: 'center',
    },
    albumName: {
        fontSize: 14,
        color: theme.colors.textMuted,
        textAlign: 'center',
    },
    playButton: {
        marginTop: 16,
        backgroundColor: theme.colors.accent,
        borderRadius: 999,
        paddingVertical: 14,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    playButtonText: {
        color: '#000',
        fontWeight: '700',
        fontSize: 15,
    },
    primaryButton: {
        marginTop: 12,
        backgroundColor: theme.colors.accent,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 999,
        gap: 8,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    refreshButton: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
    },
    refreshButtonText: {
        color: theme.colors.textMuted,
        fontSize: 14,
    },
    secondaryButton: {
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 22,
        borderRadius: 999,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    secondaryButtonText: {
        color: theme.colors.text,
        fontSize: 14,
        marginLeft: 6,
        fontWeight: '600',
    },
});
