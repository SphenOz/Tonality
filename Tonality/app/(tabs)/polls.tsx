import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState } from 'react';
import { getCurrentPoll, voteForSong, getUserVote, Poll } from '../../api/mockBackend';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../context/ThemeContext';

export default function PollsScreen() {
    const [poll, setPoll] = useState<Poll | null>(null);
    const [loading, setLoading] = useState(true);
    const [userVote, setUserVote] = useState<string | undefined>();
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    useEffect(() => {
        loadPoll();
    }, []);

    const loadPoll = async () => {
        try {
            setLoading(true);
            const pollData = await getCurrentPoll();
            setPoll(pollData);
            if (pollData) {
                setUserVote(getUserVote(pollData.id));
            }
        } catch (error) {
            console.error('Error loading poll:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleVote = async (songId: string) => {
        if (!poll) return;

        try {
            await voteForSong(poll.id, songId);
            setUserVote(songId);
            // Refresh poll to get updated votes
            loadPoll();
        } catch (error) {
            console.error('Error voting:', error);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.containerCentered}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Text style={styles.loadingText}>Loading polls...</Text>
            </SafeAreaView>
        );
    }

    if (!poll) {
        return (
            <SafeAreaView style={styles.containerCentered}>
                <Ionicons name="stats-chart" size={48} color={theme.colors.accent} />
                <Text style={styles.title}>Weekly Polls</Text>
                <Text style={styles.subtitle}>No active polls right now. Check back soon!</Text>
            </SafeAreaView>
        );
    }

    const totalVotes = poll.songs.reduce((sum, song) => sum + song.votes, 0);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Weekly Poll</Text>
                    <Text style={styles.pollTitle}>{poll.title}</Text>
                    <Text style={styles.subtitle}>Vote for your favorite track this week</Text>
                    <View style={styles.badgeRow}>
                        <View style={styles.badge}>
                            <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} />
                            <Text style={styles.badgeText}>Closes in 3 days</Text>
                        </View>
                        <View style={styles.badge}>
                            <Ionicons name="people-outline" size={14} color={theme.colors.textMuted} />
                            <Text style={styles.badgeText}>Community pick</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.songsContainer}>
                    {poll.songs.map((song) => {
                        const percentage = totalVotes > 0 ? (song.votes / totalVotes) * 100 : 0;
                        const isVoted = userVote === song.id;

                        return (
                                <Pressable
                                key={song.id}
                                style={[styles.songCard, isVoted && styles.songCardVoted]}
                                onPress={() => handleVote(song.id)}
                            >
                                <View style={styles.songInfo}>
                                    <Text style={styles.songName}>{song.name}</Text>
                                    <Text style={styles.artistName}>{song.artist}</Text>
                                </View>

                                <View style={styles.voteInfo}>
                                    {isVoted && (
                                        <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />
                                    )}
                                    <Text style={styles.voteCount}>{song.votes} votes</Text>
                                </View>

                                <View style={styles.progressBarContainer}>
                                    <View style={[styles.progressBar, { width: `${percentage}%` }]} />
                                </View>

                                <Text style={styles.percentage}>{percentage.toFixed(0)}%</Text>
                            </Pressable>
                        );
                    })}
                </View>

                <Text style={styles.totalVotes}>Total Votes: {totalVotes}</Text>
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
        gap: 12,
        padding: 24,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 64,
        gap: 24,
    },
    header: {
        alignItems: 'center',
        gap: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: theme.colors.text,
        textAlign: 'center',
    },
    pollTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.text,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: theme.colors.textMuted,
        textAlign: 'center',
    },
    loadingText: {
        color: theme.colors.textMuted,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 12,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: theme.colors.surface,
        borderRadius: 18,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    badgeText: {
        fontSize: 12,
        color: theme.colors.textMuted,
    },
    songsContainer: {
        gap: 16,
    },
    songCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 10,
    },
    songCardVoted: {
        borderColor: theme.colors.accent,
        borderWidth: 2,
    },
    songInfo: {
        gap: 4,
    },
    songName: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.text,
    },
    artistName: {
        fontSize: 14,
        color: theme.colors.textMuted,
    },
    voteInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    voteCount: {
        fontSize: 14,
        color: theme.colors.textMuted,
    },
    progressBarContainer: {
        height: 8,
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: theme.colors.accent,
        borderRadius: 4,
    },
    percentage: {
        fontSize: 12,
        color: theme.colors.textMuted,
        textAlign: 'right',
    },
    totalVotes: {
        fontSize: 14,
        color: theme.colors.textMuted,
        textAlign: 'center',
    },
});
