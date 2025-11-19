import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpotifyAuth } from '../../hooks/useSpotifyAuth';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { fetchUserProfile } from '../../api/spotify';
import { Ionicons } from '@expo/vector-icons';
import { useTonalityAuth } from '../../hooks/useTonalityAuth';

export default function HomeScreen() {
    const { token, promptAsync } = useSpotifyAuth();
    const { logout: tonalityLogout } = useTonalityAuth();
    const [profile, setProfile] = useState<any>(null);

    useEffect(() => {
        if (token) {
            fetchUserProfile(token).then(setProfile).catch(err => {
                console.error('Error loading profile', err);
            });
        } else {
            setProfile(null);
        }
    }, [token]);

    const handleLogout = async () => {
        console.log("Logout button pressed");
        try {
            await tonalityLogout();
            console.log("Tonality logout completed");
            // Navigation is handled by app/_layout.tsx effect
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    const handleConnect = () => {
        if (!token) {
            promptAsync();
        }
    };

    const goToSongOfDay = () => {
        router.push('/(tabs)/song-of-day');
    };

    const goToPolls = () => {
        router.push('/(tabs)/polls');
    };

    const isConnected = Boolean(token);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.appName}>Tonality</Text>
                    <Text style={styles.tagline}>Share music. Discover together.</Text>

                    {isConnected ? (
                        <View style={styles.connectedBadge}>
                            <Ionicons name="musical-note" size={18} color="#1DB954" />
                            <Text style={styles.connectedText}>
                                Connected as {profile?.display_name || 'Spotify User'}
                            </Text>
                        </View>
                    ) : (
                        <Text style={styles.connectHint}>
                            Connect your Spotify to get a personalized Song of the Day and better
                            recommendations.
                        </Text>
                    )}

                    {!isConnected && (
                        <Pressable style={styles.primaryButton} onPress={handleConnect}>
                            <Ionicons name="musical-notes" size={24} color="white" />
                            <Text style={styles.primaryButtonText}>Connect with Spotify</Text>
                        </Pressable>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Jump back in</Text>

                    <View style={styles.cardsRow}>
                        <Pressable style={styles.featureCard} onPress={goToSongOfDay}>
                            <View style={styles.featureIconCircle}>
                                <Ionicons name="musical-notes" size={22} color="#ffffff" />
                            </View>
                            <Text style={styles.featureTitle}>Song of the Day</Text>
                            <Text style={styles.featureSubtitle}>
                                Get a daily pick based on your recent listening.
                            </Text>
                        </Pressable>

                        <Pressable style={styles.featureCard} onPress={goToPolls}>
                            <View style={styles.featureIconCircle}>
                                <Ionicons name="stats-chart" size={22} color="#ffffff" />
                            </View>
                            <Text style={styles.featureTitle}>Weekly Polls</Text>
                            <Text style={styles.featureSubtitle}>
                                Vote on tracks and see what the community loves.
                            </Text>
                        </Pressable>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Friend activity (mock)</Text>
                    <View style={styles.activityCard}>
                        <View style={styles.activityRow}>
                            <Ionicons name="person-circle" size={22} color="#3E3E3E" />
                            <View style={styles.activityTextContainer}>
                                <Text style={styles.activityPrimary}>Alex voted for Little Dark Age</Text>
                                <Text style={styles.activitySecondary}>in Best Indie Track This Week</Text>
                            </View>
                        </View>
                        <View style={styles.activityRow}>
                            <Ionicons name="person-circle" size={22} color="#3E3E3E" />
                            <View style={styles.activityTextContainer}>
                                <Text style={styles.activityPrimary}>Sam shared Heat Waves</Text>
                                <Text style={styles.activitySecondary}>with 5 friends</Text>
                            </View>
                        </View>
                        <View style={styles.activityRow}>
                            <Ionicons name="person-circle" size={22} color="#3E3E3E" />
                            <View style={styles.activityTextContainer}>
                                <Text style={styles.activityPrimary}>Jordan is listening to Electric Feel</Text>
                                <Text style={styles.activitySecondary}>right now</Text>
                            </View>
                        </View>
                    </View>
                    <Text style={styles.mockNote}>
                        These events are currently mocked. In the full project they will come from a
                        FastAPI + MySQL backend.
                    </Text>
                </View>

                {isConnected && (
                    <Pressable style={styles.logoutButton} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={18} color="#FF6B6B" />
                        <Text style={styles.logoutText}>Log out</Text>
                    </Pressable>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 40,
    },
    header: {
        marginTop: 20,
        marginBottom: 32,
        alignItems: 'center', // Center align for symmetry
    },
    appName: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1DB954',
        letterSpacing: 0.5,
    },
    tagline: {
        marginTop: 8,
        fontSize: 16,
        color: '#B3B3B3',
        textAlign: 'center',
    },
    connectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        backgroundColor: 'rgba(29, 185, 84, 0.1)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(29, 185, 84, 0.3)',
        gap: 8,
    },
    connectedText: {
        fontSize: 14,
        color: '#1DB954',
        fontWeight: '600',
    },
    connectHint: {
        marginTop: 20,
        fontSize: 14,
        color: '#B3B3B3',
        textAlign: 'center',
        lineHeight: 20,
    },
    primaryButton: {
        marginTop: 24,
        backgroundColor: '#1DB954',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 32,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
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
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 16,
        textAlign: 'center', // Center align for symmetry
    },
    cardsRow: {
        flexDirection: 'row',
        gap: 16,
    },
    featureCard: {
        flex: 1,
        backgroundColor: '#282828',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center', // Center align content
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    featureIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(29, 185, 84, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 6,
        textAlign: 'center',
    },
    featureSubtitle: {
        fontSize: 12,
        color: '#B3B3B3',
        textAlign: 'center',
        lineHeight: 16,
    },
    activityCard: {
        backgroundColor: '#282828',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    activityTextContainer: {
        flex: 1,
    },
    activityPrimary: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    activitySecondary: {
        fontSize: 12,
        color: '#B3B3B3',
        marginTop: 2,
    },
    mockNote: {
        marginTop: 12,
        fontSize: 12,
        color: '#666666',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    logoutButton: {
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        padding: 12,
        gap: 8,
    },
    logoutText: {
        color: '#FF6B6B',
        fontSize: 16,
        fontWeight: '600',
    },
});
