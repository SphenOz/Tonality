import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpotifyAuth } from '../../hooks/useSpotifyAuth';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { fetchUserProfile } from '../../api/spotify';
import { Ionicons } from '@expo/vector-icons';
import { useTonalityAuth } from '../../hooks/useTonalityAuth';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../context/ThemeContext';

export default function HomeScreen() {
    const { token, promptAsync } = useSpotifyAuth();
        const { user, isAuthenticated, loading } = useTonalityAuth();
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const [profile, setProfile] = useState<any>(null);
    const routerInstance = useRouter();

    useEffect(() => {
        if (token) {
            fetchUserProfile(token).then(setProfile).catch(err => {
                console.error('Error loading profile', err);
            });
        } else {
            setProfile(null);
        }
    }, [token]);

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            console.log("HomeScreen: effect redirecting to login");
            routerInstance.replace('/');
        }
    }, [loading, isAuthenticated, routerInstance]);

    if (loading) {
        return null;
    }

    if (!isAuthenticated) {
        return null;
    }

    const handleConnect = () => {
        if (!token) {
            promptAsync();
        }
    };

    const goToSongOfDay = () => {
        routerInstance.push('/(tabs)/song-of-day');
    };

    const goToPolls = () => {
        routerInstance.push('/(tabs)/polls');
    };

    const isConnected = Boolean(token);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <View style={styles.headerBadge}>
                        <Ionicons name="sparkles" size={14} color={theme.colors.accent} />
                        <Text style={styles.headerBadgeText}>Good to see you, {user?.email?.split('@')[0] || 'friend'}</Text>
                    </View>
                    <Text style={styles.appName}>Tonality</Text>
                    <Text style={styles.tagline}>Symmetric social listening for every vibe.</Text>

                    {isConnected ? (
                        <View style={styles.connectedBadge}>
                            <Ionicons name="musical-note" size={18} color={theme.colors.accent} />
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
                            <Ionicons name="link" size={20} color="#fff" />
                            <Text style={styles.primaryButtonText}>Link Spotify to Tonality</Text>
                        </Pressable>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Jump back in</Text>

                    <View style={styles.cardsRow}>
                        <Pressable style={styles.featureCard} onPress={goToSongOfDay}>
                            <View style={styles.featureIconCircle}>
                                <Ionicons name="musical-notes" size={22} color={theme.colors.text} />
                            </View>
                            <Text style={styles.featureTitle}>Song of the Day</Text>
                            <Text style={styles.featureSubtitle}>
                                Get a daily pick based on your recent listening.
                            </Text>
                        </Pressable>

                        <Pressable style={styles.featureCard} onPress={goToPolls}>
                            <View style={styles.featureIconCircle}>
                                <Ionicons name="stats-chart" size={22} color={theme.colors.text} />
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
    },
    header: {
        marginTop: 8,
        marginBottom: 32,
        alignItems: 'center',
        gap: 12,
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
        fontSize: 34,
        fontWeight: '800',
        color: theme.colors.text,
        textAlign: 'center',
    },
    tagline: {
        marginTop: 4,
        fontSize: 16,
        color: theme.colors.textMuted,
        textAlign: 'center',
    },
    connectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 18,
        backgroundColor: theme.colors.accentMuted,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        gap: 8,
    },
    connectedText: {
        fontSize: 14,
        color: theme.colors.accent,
        fontWeight: '600',
    },
    connectHint: {
        marginTop: 20,
        fontSize: 14,
        color: theme.colors.textMuted,
        textAlign: 'center',
        lineHeight: 20,
    },
    primaryButton: {
        marginTop: 20,
        backgroundColor: theme.colors.accent,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 32,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        alignSelf: 'stretch',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.colors.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    cardsRow: {
        flexDirection: 'row',
        gap: 16,
    },
    featureCard: {
        flex: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: 24,
        padding: 20,
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    featureIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.colors.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.colors.text,
        textAlign: 'center',
    },
    featureSubtitle: {
        fontSize: 13,
        color: theme.colors.textMuted,
        textAlign: 'center',
        lineHeight: 18,
    },
    activityCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 16,
    },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    activityTextContainer: {
        flex: 1,
    },
    activityPrimary: {
        fontSize: 15,
        color: theme.colors.text,
        fontWeight: '600',
    },
    activitySecondary: {
        fontSize: 13,
        color: theme.colors.textMuted,
    },
    mockNote: {
        marginTop: 12,
        fontSize: 12,
        color: theme.colors.textMuted,
        textAlign: 'center',
        fontStyle: 'italic',
    },
});
