import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState } from 'react';
import { getCurrentPoll, voteForSong, getUserVote, Poll } from '../../api/mockBackend';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../context/ThemeContext';

export default function CommunityScreen() {
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
            loadPoll();
        } catch (error) {
            console.error('Error voting:', error);
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

    const totalVotes = poll ? poll.songs.reduce((sum, song) => sum + song.votes, 0) : 0;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Ionicons name="people" size={32} color={theme.colors.accent} />
                    <Text style={styles.title}>Community</Text>
                    <Text style={styles.subtitle}>Polls, playlists, and community picks</Text>
                </View>

                {/* Communities Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Communities</Text>
                    <View style={styles.communityCard}>
                        <View style={styles.communityRow}>
                            <View style={styles.communityIcon}>
                                <Ionicons name="musical-notes" size={20} color={theme.colors.accent} />
                            </View>
                            <View style={styles.communityInfo}>
                                <Text style={styles.communityName}>Indie Lovers</Text>
                                <Text style={styles.communityMembers}>128 members</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                        </View>
                    </View>
                    <View style={styles.communityCard}>
                        <View style={styles.communityRow}>
                            <View style={styles.communityIcon}>
                                <Ionicons name="headset" size={20} color={theme.colors.accent} />
                            </View>
                            <View style={styles.communityInfo}>
                                <Text style={styles.communityName}>Lo-Fi Chill</Text>
                                <Text style={styles.communityMembers}>256 members</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                        </View>
                    </View>
                    <Pressable style={styles.joinButton}>
                        <Ionicons name="add" size={18} color={theme.colors.accent} />
                        <Text style={styles.joinButtonText}>Discover Communities</Text>
                    </Pressable>
                </View>

                {/* Active Poll Section */}
                {poll && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Active Poll</Text>
                        <View style={styles.pollCard}>
                            <View style={styles.pollHeader}>
                                <Text style={styles.pollTitle}>{poll.title}</Text>
                                <View style={styles.badgeRow}>
                                    <View style={styles.badge}>
                                        <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
                                        <Text style={styles.badgeText}>3 days left</Text>
                                    </View>
                                </View>
                            </View>

                            {poll.songs.map((song) => {
                                const percentage = totalVotes > 0 ? (song.votes / totalVotes) * 100 : 0;
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

                {/* Community Playlists */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Community Playlists</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.playlistsRow}>
                        {['Weekend Vibes', 'Study Session', 'Workout Mix'].map((name, idx) => (
                            <View key={idx} style={styles.playlistCard}>
                                <View style={styles.playlistCover}>
                                    <Ionicons name="musical-note" size={28} color={theme.colors.accent} />
                                </View>
                                <Text style={styles.playlistName}>{name}</Text>
                                <Text style={styles.playlistMeta}>24 songs</Text>
                            </View>
                        ))}
                    </ScrollView>
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
        gap: 12,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 64,
        gap: 28,
    },
    header: {
        alignItems: 'center',
        gap: 8,
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
    loadingText: {
        color: theme.colors.textMuted,
    },
    section: {
        gap: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.text,
    },
    communityCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    communityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    communityIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.colors.accentMuted,
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
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        borderStyle: 'dashed',
    },
    joinButtonText: {
        color: theme.colors.accent,
        fontWeight: '600',
    },
    pollCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 12,
    },
    pollHeader: {
        gap: 8,
    },
    pollTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: theme.colors.text,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    badgeText: {
        fontSize: 11,
        color: theme.colors.textMuted,
    },
    songOption: {
        backgroundColor: theme.colors.surfaceMuted,
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
    playlistsRow: {
        marginTop: 8,
    },
    playlistCard: {
        width: 140,
        marginRight: 16,
        alignItems: 'center',
        gap: 8,
    },
    playlistCover: {
        width: 120,
        height: 120,
        borderRadius: 16,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playlistName: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
        textAlign: 'center',
    },
    playlistMeta: {
        fontSize: 12,
        color: theme.colors.textMuted,
    },
});
