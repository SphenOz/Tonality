import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../context/ThemeContext';
import { useTonalityAuth } from '../../hooks/useTonalityAuth';
import { getCommunities, getActivePolls, generateWeeklyPolls, Community, Poll } from '../../api/tonality';

export default function CommunityScreen() {
    const [communities, setCommunities] = useState<Community[]>([]);
    const [activePolls, setActivePolls] = useState<Poll[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [generating, setGenerating] = useState(false);
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { token } = useTonalityAuth();
    const router = useRouter();

    const loadData = useCallback(async () => {
        if (!token) return;
        try {
            const [communitiesData, pollsData] = await Promise.all([
                getCommunities(token),
                getActivePolls(token)
            ]);
            setCommunities(communitiesData);
            setActivePolls(pollsData);
        } catch (error) {
            console.error('Error loading community data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData();
    }, [loadData]);

    const handleGeneratePolls = async () => {
        if (!token) return;
        try {
            setGenerating(true);
            await generateWeeklyPolls(token);
            loadData();
        } catch (error) {
            console.error('Error generating polls:', error);
        } finally {
            setGenerating(false);
        }
    };

    const handleCommunityPress = (communityId: number) => {
        router.push(`/community/${communityId}`);
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.containerCentered}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Text style={styles.loadingText}>Loading communities...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView 
                style={styles.scrollView} 
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />
                }
            >
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <Ionicons name="people" size={32} color={theme.colors.accent} />
                        <Pressable 
                            style={styles.generateButton} 
                            onPress={handleGeneratePolls}
                            disabled={generating}
                        >
                            {generating ? (
                                <ActivityIndicator size="small" color={theme.colors.accent} />
                            ) : (
                                <Ionicons name="refresh-circle" size={24} color={theme.colors.accent} />
                            )}
                        </Pressable>
                    </View>
                    <Text style={styles.title}>Community</Text>
                    <Text style={styles.subtitle}>Polls, playlists, and community picks</Text>
                </View>

                {/* Communities Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Communities</Text>
                    {communities.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>No communities found</Text>
                        </View>
                    ) : (
                        communities.map((community) => (
                            <Pressable 
                                key={community.id} 
                                style={styles.communityCard}
                                onPress={() => handleCommunityPress(community.id)}
                            >
                                <View style={styles.communityRow}>
                                    <View style={styles.communityIcon}>
                                        <Ionicons name={community.icon_name as any || "musical-notes"} size={20} color={theme.colors.accent} />
                                    </View>
                                    <View style={styles.communityInfo}>
                                        <Text style={styles.communityName}>{community.name}</Text>
                                        <Text style={styles.communityMembers}>{community.member_count} members</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                                </View>
                            </Pressable>
                        ))
                    )}
                    <Pressable style={styles.joinButton}>
                        <Ionicons name="add" size={18} color={theme.colors.accent} />
                        <Text style={styles.joinButtonText}>Discover Communities</Text>
                    </Pressable>
                </View>

                {/* Active Polls Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Active Polls</Text>
                    {activePolls.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>No active polls</Text>
                        </View>
                    ) : (
                        activePolls.map((poll) => (
                            <Pressable key={poll.id} style={styles.pollCard}>
                                <View style={styles.pollHeader}>
                                    <Text style={styles.pollTitle}>{poll.title}</Text>
                                    <View style={styles.pollBadge}>
                                        <Text style={styles.pollBadgeText}>Active</Text>
                                    </View>
                                </View>
                                <Text style={styles.pollDescription}>{poll.description}</Text>
                                <Text style={styles.pollEnds}>Ends {new Date(poll.ends_at).toLocaleDateString()}</Text>
                            </Pressable>
                        ))
                    )}
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
    containerCentered: {
        flex: 1,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: theme.colors.textMuted,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 100,
        gap: 32,
    },
    header: {
        alignItems: 'center',
        gap: 8,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: '100%',
    },
    generateButton: {
        position: 'absolute',
        right: 0,
        padding: 8,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: theme.colors.text,
    },
    subtitle: {
        fontSize: 14,
        color: theme.colors.textMuted,
        textAlign: 'center',
    },
    section: {
        gap: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.colors.text,
    },
    communityCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: 12,
    },
    communityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    communityIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(29, 185, 84, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    communityInfo: {
        flex: 1,
    },
    communityName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 4,
    },
    communityMembers: {
        fontSize: 13,
        color: theme.colors.textMuted,
    },
    joinButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        borderRadius: 24,
        borderStyle: 'dashed',
    },
    joinButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.accent,
    },
    emptyState: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
    },
    emptyStateText: {
        color: theme.colors.textMuted,
        fontSize: 14,
    },
    pollCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: 12,
    },
    pollHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    pollTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.text,
        flex: 1,
        marginRight: 12,
    },
    pollBadge: {
        backgroundColor: 'rgba(29, 185, 84, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    pollBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.accent,
    },
    pollDescription: {
        fontSize: 14,
        color: theme.colors.textMuted,
        marginBottom: 12,
        lineHeight: 20,
    },
    pollEnds: {
        fontSize: 12,
        color: theme.colors.textMuted,
        fontStyle: 'italic',
    },
});
