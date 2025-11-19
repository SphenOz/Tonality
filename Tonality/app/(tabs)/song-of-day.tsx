import { View, Text, StyleSheet, Image, Pressable, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpotifyAuth } from '../../hooks/useSpotifyAuth';
import { useCallback, useEffect, useState } from 'react';
import { fetchUserTopTracks } from '../../api/spotify';
import { Ionicons } from '@expo/vector-icons';

export default function SongOfDayScreen() {
    const { token, promptAsync } = useSpotifyAuth();
    const [songOfDay, setSongOfDay] = useState<any>(null);
    const [loading, setLoading] = useState(false);

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
        } catch (error) {
            console.error('Error loading song of day:', error);
        } finally {
            setLoading(false);
        }
    }, [token]);

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
                <Ionicons name="musical-notes" size={48} color="#3E3E3E" />
                <Text style={styles.title}>Song of the Day</Text>
                <Text style={styles.description}>
                    Connect your Spotify account to generate a personalized Song of the Day based on
                    your recent listening.
                </Text>
                <Pressable style={styles.primaryButton} onPress={handleConnect}>
                    <Ionicons name="musical-notes" size={22} color="white" />
                    <Text style={styles.primaryButtonText}>Connect with Spotify</Text>
                </Pressable>
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={styles.containerCentered}>
                <ActivityIndicator size="large" color="#a8C3A0" />
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
                    <Ionicons name="refresh" size={18} color="#3E3E3E" />
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

            <View style={styles.songCard}>
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
                    <Ionicons name="play-circle" size={28} color="white" />
                    <Text style={styles.playButtonText}>Play on Spotify</Text>
                </Pressable>

                <Pressable style={styles.refreshButton} onPress={loadSongOfDay}>
                    <Ionicons name="refresh" size={20} color="#3E3E3E" />
                    <Text style={styles.refreshButtonText}>Get Another</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
        alignItems: 'center',
        padding: 20,
    },
    containerCentered: {
        flex: 1,
        backgroundColor: '#121212',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        marginTop: 20,
        marginBottom: 30,
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    subtitle: {
        fontSize: 14,
        color: '#B3B3B3',
        marginTop: 5,
    },
    loadingText: {
        marginTop: 20,
        color: '#B3B3B3',
    },
    description: {
        marginTop: 10,
        fontSize: 14,
        color: '#B3B3B3',
        textAlign: 'center',
        lineHeight: 20,
    },
    songCard: {
        backgroundColor: '#282828',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
        width: '100%',
        maxWidth: 350,
    },
    albumArt: {
        width: 200,
        height: 200,
        borderRadius: 12,
        marginBottom: 20,
    },
    songTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 8,
    },
    artistName: {
        fontSize: 16,
        color: '#B3B3B3',
        textAlign: 'center',
        marginBottom: 4,
    },
    albumName: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        marginBottom: 25,
    },
    playButton: {
        backgroundColor: '#1DB954',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 32,
        marginBottom: 15,
        shadowColor: '#1DB954',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    playButtonText: {
        color: '#000000',
        fontSize: 16,
        fontWeight: '700',
        marginLeft: 8,
    },
    primaryButton: {
        marginTop: 20,
        backgroundColor: '#1DB954',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 32,
        shadowColor: '#1DB954',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    primaryButtonText: {
        color: '#000000',
        fontSize: 16,
        fontWeight: '700',
        marginLeft: 8,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 20,
    },
    refreshButtonText: {
        color: '#B3B3B3',
        fontSize: 14,
        marginLeft: 6,
    },
    secondaryButton: {
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 32,
        backgroundColor: '#282828',
    },
    secondaryButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        marginLeft: 6,
        fontWeight: '600',
    },
});
