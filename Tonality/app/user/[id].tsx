import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Image, Alert } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../context/ThemeContext';
import { useTonalityAuth } from '../../hooks/useTonalityAuth';
import { API_BASE_URL } from '../../utils/runtimeConfig';
import { openInSpotify } from '../../utils/spotifyLinks';

interface UserProfile {
    id: number;
    username: string;
    spotify_display_name?: string;
    spotify_profile_image_url?: string;
    is_online: boolean;
    is_friend: boolean;
    is_self: boolean;
    pending_request?: 'incoming' | 'outgoing';
    listening_activity?: {
        track_name: string;
        artist_name: string;
        album_image_url?: string;
        spotify_uri?: string;
    };
    communities: {
        id: number;
        name: string;
        icon_name: string;
    }[];
}

export default function UserProfileScreen() {
    const { id } = useLocalSearchParams();
    const userId = parseInt(id as string);
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { token } = useTonalityAuth();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        loadProfile();
    }, [userId, token]);

    const loadProfile = async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/users/${userId}/profile`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                setProfile(await response.json());
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFriendAction = async () => {
        if (!token || !profile) return;
        setActionLoading(true);
        try {
            if (profile.is_friend) {
                // Remove friend (not implemented in UI for safety, but logic would be here)
                Alert.alert('Remove Friend', 'Are you sure you want to remove this friend?', [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                        text: 'Remove', 
                        style: 'destructive',
                        onPress: async () => {
                            // Call remove endpoint
                            // await fetch(...)
                            // loadProfile();
                        }
                    }
                ]);
            } else if (profile.pending_request === 'incoming') {
                // Accept request (need request ID, which we don't have here easily without fetching requests)
                // For now, just show a message
                Alert.alert('Pending Request', 'Please go to the Friends tab to accept this request.');
            } else if (profile.pending_request === 'outgoing') {
                // Cancel request
                Alert.alert('Request Sent', 'You have already sent a friend request.');
            } else {
                // Send request
                const response = await fetch(`${API_BASE_URL}/api/friends/request/${userId}`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (response.ok) {
                    loadProfile();
                } else {
                    Alert.alert('Error', 'Failed to send friend request');
                }
            }
        } catch (error) {
            console.error('Error performing friend action:', error);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.containerCentered}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
            </View>
        );
    }

    if (!profile) {
        return (
            <View style={styles.containerCentered}>
                <Text style={styles.errorText}>User not found</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ 
                headerTitle: profile.username,
                headerStyle: { backgroundColor: theme.colors.background },
                headerTintColor: theme.colors.text,
                headerShadowVisible: false,
            }} />
            
            <ScrollView contentContainerStyle={styles.content}>
                {/* Profile Header */}
                <View style={styles.header}>
                    <View style={styles.avatarContainer}>
                        {profile.spotify_profile_image_url ? (
                            <Image source={{ uri: profile.spotify_profile_image_url }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarText}>
                                    {(profile.spotify_display_name || profile.username)[0].toUpperCase()}
                                </Text>
                            </View>
                        )}
                        {profile.is_online && <View style={styles.onlineDot} />}
                    </View>
                    
                    <Text style={styles.name}>{profile.spotify_display_name || profile.username}</Text>
                    <Text style={styles.username}>@{profile.username}</Text>

                    {!profile.is_self && (
                        <Pressable 
                            style={[
                                styles.actionButton, 
                                profile.is_friend ? styles.friendButton : 
                                profile.pending_request ? styles.pendingButton : styles.addButton
                            ]}
                            onPress={handleFriendAction}
                            disabled={actionLoading}
                        >
                            {actionLoading ? (
                                <ActivityIndicator size="small" color={profile.is_friend ? theme.colors.text : "#fff"} />
                            ) : (
                                <>
                                    <Ionicons 
                                        name={
                                            profile.is_friend ? "checkmark" : 
                                            profile.pending_request ? "time-outline" : "person-add"
                                        } 
                                        size={18} 
                                        color={profile.is_friend ? theme.colors.text : "#fff"} 
                                    />
                                    <Text style={[
                                        styles.actionButtonText, 
                                        profile.is_friend && styles.friendButtonText
                                    ]}>
                                        {profile.is_friend ? "Friends" : 
                                         profile.pending_request === 'outgoing' ? "Sent" :
                                         profile.pending_request === 'incoming' ? "Accept" : "Add Friend"}
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    )}
                </View>

                {/* Listening Activity */}
                {profile.listening_activity && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Listening Now</Text>
                        <Pressable 
                            style={styles.activityCard}
                            onPress={() => profile.listening_activity?.spotify_uri && openInSpotify({
                                uri: profile.listening_activity.spotify_uri,
                                type: 'track',
                                name: profile.listening_activity.track_name,
                            })}
                        >
                            <Image 
                                source={{ uri: profile.listening_activity.album_image_url || 'https://via.placeholder.com/60' }} 
                                style={styles.activityImage} 
                            />
                            <View style={styles.activityInfo}>
                                <Text style={styles.activityTrack}>{profile.listening_activity.track_name}</Text>
                                <Text style={styles.activityArtist}>{profile.listening_activity.artist_name}</Text>
                            </View>
                            <View style={styles.equalizer}>
                                <Ionicons name="stats-chart" size={20} color={theme.colors.accent} />
                            </View>
                        </Pressable>
                    </View>
                )}

                {/* Communities */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Communities</Text>
                    {profile.communities.length === 0 ? (
                        <Text style={styles.emptyText}>No communities yet</Text>
                    ) : (
                        <View style={styles.communitiesGrid}>
                            {profile.communities.map(community => (
                                <View key={community.id} style={styles.communityTag}>
                                    <Ionicons name={community.icon_name as any || "musical-notes"} size={14} color={theme.colors.accent} />
                                    <Text style={styles.communityName}>{community.name}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
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
    },
    errorText: {
        color: theme.colors.danger,
        fontSize: 16,
    },
    content: {
        padding: 24,
        gap: 32,
    },
    header: {
        alignItems: 'center',
        gap: 8,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 8,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    avatarPlaceholder: {
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    avatarText: {
        fontSize: 40,
        fontWeight: '600',
        color: theme.colors.text,
    },
    onlineDot: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: theme.colors.success,
        borderWidth: 3,
        borderColor: theme.colors.background,
    },
    name: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.colors.text,
    },
    username: {
        fontSize: 16,
        color: theme.colors.textMuted,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
        marginTop: 16,
        minWidth: 140,
        justifyContent: 'center',
    },
    addButton: {
        backgroundColor: theme.colors.accent,
    },
    friendButton: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    pendingButton: {
        backgroundColor: theme.colors.surfaceMuted,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    friendButtonText: {
        color: theme.colors.text,
    },
    section: {
        gap: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.text,
    },
    activityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 12,
    },
    activityImage: {
        width: 56,
        height: 56,
        borderRadius: 8,
    },
    activityInfo: {
        flex: 1,
        gap: 4,
    },
    activityTrack: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    activityArtist: {
        fontSize: 14,
        color: theme.colors.textMuted,
    },
    equalizer: {
        padding: 8,
    },
    emptyText: {
        color: theme.colors.textMuted,
        fontStyle: 'italic',
    },
    communitiesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    communityTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: theme.colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    communityName: {
        fontSize: 14,
        color: theme.colors.text,
        fontWeight: '500',
    },
});
