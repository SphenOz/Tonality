import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../context/ThemeContext';
import { API_BASE_URL } from '../../utils/runtimeConfig';
import { useTonalityAuth } from '../../context/AuthContext';
import { getCommunities, getActivePolls, generateWeeklyPolls } from '../../api/tonality';

/* ────────────────────────────────────────────── */
/*                API HELPERS                     */
/* ────────────────────────────────────────────── */

async function apiFetch(path: string, token?: string, options: RequestInit = {}) {
    console.log(`🌐 FETCH → ${API_BASE_URL}${path}`);

    try {
        const res = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(options.headers ?? {})
            }
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error("❌ API ERROR:", res.status, err);
            throw new Error(err.detail || "API request failed");
        }

        return res.json();
    } catch (err) {
        console.error(`❌ Network/API Failure @ ${path}:`, err);
        throw err;
    }
}

const getMyCommunities = (token: string) => apiFetch(`/api/communities/my`, token);
const joinCommunity = (id: number, token: string) =>
    apiFetch(`/api/communities/${id}/join`, token, { method: "POST" });

const voteOnPoll = (pollId: number, optionId: number, token: string) =>
    apiFetch(`/api/polls/${pollId}/vote`, token, {
        method: "POST",
        body: JSON.stringify({ option_id: optionId })
    });


/* ────────────────────────────────────────────── */
/*               COMMUNITY SCREEN                  */
/* ────────────────────────────────────────────── */
export default function CommunityScreen() {
    const [communities, setCommunities] = useState<any[]>([]);
    const [myCommunities, setMyCommunities] = useState<any[]>([]);
    const [activePolls, setActivePolls] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [userVote, setUserVote] = useState<number | undefined>();
    
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { token } = useTonalityAuth();
    const router = useRouter();

    const loadData = useCallback(async () => {
        if (!token) return;
        console.log("🔄 Loading Community Data…");
        
        try {
            const [allCommunities, myComms, polls] = await Promise.all([
                getCommunities(token),
                getMyCommunities(token),
                getActivePolls(token)
            ]);
            
            setCommunities(allCommunities);
            setMyCommunities(myComms);
            setActivePolls(polls);
            
            console.log("✓ Loaded:", allCommunities.length, "communities,", polls.length, "polls");
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
        router.push({
            pathname: '/community/[id]',
            params: { id: String(communityId) },
        });
    };

    const handleJoin = async (communityId: number) => {
        if (!token) {
            console.warn("⚠️ Cannot join — no auth token");
            return;
        }

        try {
            console.log(`➡️ Joining Community ${communityId}`);
            await joinCommunity(communityId, token);
            loadData();
        } catch (err) {
            console.error("❌ Join failed:", err);
        }
    };

    const handleVote = async (pollId: number, songOptionId: number) => {
        if (!token) {
            console.warn("⚠️ Cannot vote — missing token");
            return;
        }

        try {
            await voteOnPoll(pollId, songOptionId, token);
            setUserVote(songOptionId);
            loadData();
        } catch (err) {
            console.error("❌ Vote failed:", err);
        }
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

                {/* My Communities */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Communities</Text>
                    
                    {myCommunities.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>No communities yet</Text>
                        </View>
                    ) : (
                        myCommunities.map((community) => (
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
                    
                    {/* Discover Communities */}
                    <Text style={styles.sectionTitle}>Discover Communities</Text>
                    {communities
                        .filter(c => !myCommunities.some(m => m.id === c.id))
                        .map(comm => (
                            <Pressable
                                key={comm.id}
                                style={styles.communityCard}
                                onPress={() => handleJoin(comm.id)}
                            >
                                <View style={styles.communityRow}>
                                    <View style={styles.communityIcon}>
                                        <Ionicons name={comm.icon_name || "add"} size={20} color={theme.colors.accent} />
                                    </View>
                                    <View style={styles.communityInfo}>
                                        <Text style={styles.communityName}>{comm.name}</Text>
                                        <Text style={styles.communityMembers}>{comm.member_count} members</Text>
                                    </View>
                                    <Ionicons name="add-circle-outline" size={20} color={theme.colors.accent} />
                                </View>
                            </Pressable>
                        ))}
                </View>

                {/* Active Polls Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Active Polls</Text>
                    {activePolls.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>No active polls</Text>
                        </View>
                    ) : (
                        activePolls.map((poll) => {
                            const totalVotes = poll.options?.reduce((sum: number, opt: any) => sum + (opt.votes || 0), 0) || 0;
                            
                            return (
                                <View key={poll.id} style={styles.pollCard}>
                                    <Text style={styles.pollTitle}>{poll.title}</Text>
                                    
                                    {poll.options?.map((option: any) => {
                                        const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                                        const isVoted = userVote === option.id;

                                        return (
                                            <Pressable
                                                key={option.id}
                                                style={[styles.songOption, isVoted && styles.songOptionVoted]}
                                                onPress={() => handleVote(poll.id, option.id)}
                                            >
                                                <View style={styles.songInfo}>
                                                    <Text style={styles.songName}>{option.song_name || option.name}</Text>
                                                    <Text style={styles.artistName}>{option.artist_name || option.artist}</Text>
                                                </View>

                                                <View style={styles.voteInfo}>
                                                    {isVoted && (
                                                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent} />
                                                    )}
                                                    <Text style={styles.percentage}>{percentage.toFixed(0)}%</Text>
                                                </View>

                                                <View style={styles.progressBarContainer}>
                                                    <View style={[styles.progressBar, { width: `${percentage}%` }]} />
                                                </View>
                                            </Pressable>
                                        );
                                    })}

                                    <Text style={styles.totalVotes}>{totalVotes} total votes</Text>
                                </View>
                            );
                        })
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
        gap: 12,
    },
    pollTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.text,
    },
    songOption: {
        backgroundColor: theme.colors.surfaceMuted || theme.colors.background,
        borderRadius: 12,
        padding: 14,
        gap: 8,
    },
    songOptionVoted: {
        borderWidth: 2,
        borderColor: theme.colors.accent,
    },
    songInfo: {
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
    voteInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 6,
    },
    percentage: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.textMuted,
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: theme.colors.border,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: theme.colors.accent,
        borderRadius: 3,
    },
    totalVotes: {
        fontSize: 12,
        color: theme.colors.textMuted,
        textAlign: 'center',
    },
});
