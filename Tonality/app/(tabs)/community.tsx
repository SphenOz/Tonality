import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../context/ThemeContext';
import { API_BASE_URL } from '../../utils/runtimeConfig';
import { useTonalityAuth } from '../../context/AuthContext';

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

const getCommunities = () => apiFetch(`/api/communities`);
const getMyCommunities = (token: string) => apiFetch(`/api/communities/my`, token);
const joinCommunity = (id: number, token: string) =>
    apiFetch(`/api/communities/${id}/join`, token, { method: "POST" });

const getActivePolls = () => apiFetch(`/api/polls/active`);
const voteOnPoll = (pollId: number, optionId: number, token: string) =>
    apiFetch(`/api/polls/${pollId}/vote`, token, {
        method: "POST",
        body: JSON.stringify({ option_id: optionId })
    });


/* ────────────────────────────────────────────── */
/*               COMMUNITY SCREEN                  */
/* ────────────────────────────────────────────── */
export default function CommunityScreen() {
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const { token: authToken } = useTonalityAuth();

    const [loading, setLoading] = useState(true);
    const [communities, setCommunities] = useState<any[]>([]);
    const [myCommunities, setMyCommunities] = useState<any[]>([]);
    const [poll, setPoll] = useState<any | null>(null);
    const [userVote, setUserVote] = useState<number | undefined>();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        console.log("🔄 Loading Community Data… Token:", authToken);
        setLoading(true);

        try {
            /* ──────────────────────────── */
            /* Get ALL Communities          */
            /* ──────────────────────────── */
            let all = [];
            try {
                all = await getCommunities();
                console.log("✓ All communities:", all.length);
            } catch (err) {
                console.error("❌ Failed /api/communities", err);
            }

            /* ──────────────────────────── */
            /* Get My Communities (Auth)   */
            /* ──────────────────────────── */
            let mine = [];
            if (authToken) {
                try {
                    mine = await getMyCommunities(authToken);
                    console.log("✓ My communities:", mine.length);
                } catch (err) {
                    console.error("❌ Failed /api/communities/my", err);
                }
            } else {
                console.log("⚠️ No auth token — skipping my communities");
            }

            /* ──────────────────────────── */
            /* Get Active Poll              */
            /* ──────────────────────────── */
            try {
                const polls = await getActivePolls();
                console.log("✓ Active Polls:", polls);

                if (polls.length > 0) {
                    const p = polls[0];

                    // Some backends require querying poll options separately
                    // This structure assumes /api/polls/active returns options inline
                    if (!p.options) {
                        console.warn("⚠️ Poll missing options, skipping poll rendering");
                    } else {
                        setPoll({
                            id: p.id,
                            title: p.title,
                            songs: p.options.map((opt: any) => ({
                                id: opt.id,
                                name: opt.song_name,
                                artist: opt.artist_name,
                                votes: opt.votes,
                            }))
                        });
                    }
                }
            } catch (err) {
                console.error("❌ Failed /api/polls/active", err);
            }

            setCommunities(all);
            setMyCommunities(mine);

        } catch (err) {
            console.error("❌ Major failure in loadData:", err);
        } finally {
            console.log("🏁 Finished loadData()");
            setLoading(false);
        }
    };

    const handleJoin = async (communityId: number) => {
        if (!authToken) {
            console.warn("⚠️ Cannot join — no auth token");
            return;
        }

        try {
            console.log(`➡️ Joining Community ${communityId}`);
            await joinCommunity(communityId, authToken);
            loadData();
        } catch (err) {
            console.error("❌ Join failed:", err);
        }
    };

    const handleVote = async (songOptionId: number) => {
        if (!poll || !authToken) {
            console.warn("⚠️ Cannot vote — missing poll or token");
            return;
        }

        try {
            await voteOnPoll(poll.id, songOptionId, authToken);
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
                <Text style={styles.loadingText}>Loading community...</Text>
            </SafeAreaView>
        );
    }

    const totalVotes = poll
        ? poll.songs.reduce((sum: number, s: any) => sum + s.votes, 0)
        : 0;

    /* ────────────────────────────────────────────── */
    /*                   UI                           */
    /* ────────────────────────────────────────────── */
    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Ionicons name="people" size={32} color={theme.colors.accent} />
                    <Text style={styles.title}>Community</Text>
                    <Text style={styles.subtitle}>Polls, playlists, and community picks</Text>
                </View>

                {/* My Communities */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Communities</Text>

                    {myCommunities.map(comm => (
                        <View key={comm.id} style={styles.communityCard}>
                            <View style={styles.communityRow}>
                                <View style={styles.communityIcon}>
                                    <Ionicons name={comm.icon_name || "people"} size={20} color={theme.colors.accent} />
                                </View>
                                <View style={styles.communityInfo}>
                                    <Text style={styles.communityName}>{comm.name}</Text>
                                    <Text style={styles.communityMembers}>{comm.member_count} members</Text>
                                </View>
                            </View>
                        </View>
                    ))}

                    {/* Discover */}
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

                {/* Poll */}
                {poll && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Active Poll</Text>

                        <View style={styles.pollCard}>
                            <Text style={styles.pollTitle}>{poll.title}</Text>

                            {poll.songs.map((song: any) => {
                                const percentage = totalVotes > 0
                                    ? (song.votes / totalVotes) * 100
                                    : 0;

                                const isVoted = userVote === song.id;

                                return (
                                    <Pressable
                                        key={song.id}
                                        style={[styles.songOption, isVoted && styles.songOptionVoted]}
                                        onPress={() => handleVote(song.id)}
                                    >
                                        <View style={styles.songInfo}>
                                            <Text style={styles.songName}>{song.name}</Text>
                                            <Text style={styles.artistName}>{song.artist}</Text>
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
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}


/* ────────────────────────────────────────────── */
/*                STYLES (unchanged)              */
/* ────────────────────────────────────────────── */
const createStyles = (theme: Theme) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.colors.background },
        containerCentered: {
            flex: 1,
            backgroundColor: theme.colors.background,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
        },
        scrollView: { flex: 1 },
        scrollContent: { padding: 24, paddingBottom: 64, gap: 28 },

        header: { alignItems: 'center', gap: 8 },
        title: { fontSize: 28, fontWeight: '800', color: theme.colors.text },
        subtitle: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center' },
        loadingText: { color: theme.colors.textMuted },

        section: { gap: 12 },
        sectionTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },

        communityCard: {
            backgroundColor: theme.colors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        communityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        communityIcon: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.colors.accentMuted,
            alignItems: 'center',
            justifyContent: 'center',
        },
        communityInfo: { flex: 1 },
        communityName: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
        communityMembers: { fontSize: 13, color: theme.colors.textMuted },

        pollCard: {
            backgroundColor: theme.colors.surface,
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.colors.border,
            gap: 12,
        },
        pollTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },

        songOption: {
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: 12,
            padding: 14,
            gap: 8,
        },
        songOptionVoted: { borderWidth: 2, borderColor: theme.colors.accent },

        songInfo: { gap: 2 },
        songName: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
        artistName: { fontSize: 13, color: theme.colors.textMuted },

        voteInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
        percentage: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },

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
        totalVotes: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center' },
    });
