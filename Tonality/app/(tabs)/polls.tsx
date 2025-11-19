import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { getCurrentPoll, voteForSong, getUserVote, Poll } from '../../api/mockBackend';
import { Ionicons } from '@expo/vector-icons';

export default function PollsScreen() {
    const [poll, setPoll] = useState<Poll | null>(null);
    const [loading, setLoading] = useState(true);
    const [userVote, setUserVote] = useState<string | undefined>();

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
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#a8C3A0" />
                <Text style={styles.loadingText}>Loading polls...</Text>
            </SafeAreaView>
        );
    }

    if (!poll) {
        return (
            <SafeAreaView style={styles.container}>
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
                            <Ionicons name="time-outline" size={14} color="#3E3E3E" />
                            <Text style={styles.badgeText}>Closes in 3 days</Text>
                        </View>
                        <View style={styles.badge}>
                            <Ionicons name="people-outline" size={14} color="#3E3E3E" />
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
                                        <Ionicons name="checkmark-circle" size={24} color="#1DB954" />
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
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
    pollTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginTop: 15,
        textAlign: 'center',
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
    badgeRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    badgeText: {
        fontSize: 12,
        color: '#B3B3B3',
    },
    songsContainer: {
        gap: 16,
    },
    songCard: {
        backgroundColor: '#282828',
        borderRadius: 16,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
        position: 'relative',
    },
    songCardVoted: {
        borderWidth: 2,
        borderColor: '#1DB954',
    },
    songInfo: {
        marginBottom: 12,
    },
    songName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    artistName: {
        fontSize: 14,
        color: '#B3B3B3',
        marginTop: 4,
    },
    voteInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    voteCount: {
        fontSize: 14,
        color: '#B3B3B3',
    },
    progressBarContainer: {
        height: 8,
        backgroundColor: '#404040',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 6,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#1DB954',
    },
    percentage: {
        fontSize: 12,
        color: '#B3B3B3',
        textAlign: 'right',
    },
    totalVotes: {
        fontSize: 14,
        color: '#666666',
        textAlign: 'center',
        marginTop: 30,
        marginBottom: 20,
    },
});
