import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Modal, TextInput, Alert, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import LoadingScreen from '../../components/LoadingScreen';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, { 
    FadeIn, 
    FadeOut, 
    SlideInDown, 
    SlideOutDown,
    FadeInDown,
    FadeOutUp,
    Layout,
    withTiming,
    Easing,
    useSharedValue,
    useAnimatedStyle,
    interpolate,
    Extrapolation
} from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../context/ThemeContext';
import { Image } from 'expo-image';
import { useTonalityAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../utils/runtimeConfig';
import { openInSpotify } from '../../utils/spotifyLinks';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.7;

interface Friend {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    isOnline: boolean;
    currentlyPlaying: { name: string; artist: string; spotify_uri?: string } | null;
    topGenre?: string;
    topSongs?: string[];
}

interface SearchResult {
    id: number;
    username: string;
    spotify_display_name: string | null;
    spotify_profile_image_url: string | null;
    is_friend: boolean;
}

interface FriendRequest {
    request_id: number;
    user_id: number;
    username: string;
    spotify_display_name: string | null;
    spotify_profile_image_url: string | null;
    created_at: string;
}

export default function FriendsScreen() {
    const { theme } = useTheme();
    const { token } = useTonalityAuth();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Friend requests state
    const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
    const [showRequestsModal, setShowRequestsModal] = useState(false);
    const [processingRequest, setProcessingRequest] = useState<number | null>(null);
    const [loadingRequests, setLoadingRequests] = useState(false);
    
    // Add friend modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [addingFriend, setAddingFriend] = useState<number | null>(null);
    const [sendingRequest, setSendingRequest] = useState(false);
    const [requestError, setRequestError] = useState<string | null>(null);
    const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
    
    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;
    const modalAnim = useRef(new Animated.Value(0)).current;
    const requestsModalAnim = useRef(new Animated.Value(0)).current;
    
    // Reanimated shared values for smoother modal animations
    const requestsModalProgress = useSharedValue(0);
    const addModalProgress = useSharedValue(0);
    
    // Animated styles for requests modal backdrop
    const requestsBackdropStyle = useAnimatedStyle(() => ({
        opacity: interpolate(requestsModalProgress.value, [0, 1], [0, 1]),
    }));
    
    // Animated styles for requests modal content
    const requestsContentStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: interpolate(requestsModalProgress.value, [0, 1], [MODAL_HEIGHT, 0], Extrapolation.CLAMP) }
        ],
        opacity: interpolate(requestsModalProgress.value, [0, 0.5, 1], [0, 1, 1]),
    }));
    
    // Animated styles for add friend modal backdrop
    const addBackdropStyle = useAnimatedStyle(() => ({
        opacity: interpolate(addModalProgress.value, [0, 1], [0, 1]),
    }));
    
    // Animated styles for add friend modal content
    const addContentStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: interpolate(addModalProgress.value, [0, 1], [MODAL_HEIGHT, 0], Extrapolation.CLAMP) }
        ],
        opacity: interpolate(addModalProgress.value, [0, 0.5, 1], [0, 1, 1]),
    }));

    const fetchFriends = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            // Fetch friends list
            const friendsRes = await fetch(`${API_BASE_URL}/api/friends`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!friendsRes.ok) throw new Error('Failed to fetch friends');
            const friendsData = await friendsRes.json();

            // Fetch friends' listening activity
            const activityRes = await fetch(`${API_BASE_URL}/api/friends/activity`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const activityData = activityRes.ok ? await activityRes.json() : [];

            // Map activity to friends
            const activityMap = new Map();
            activityData.forEach((item: any) => {
                activityMap.set(item.user.id, item.activity);
            });

            const mappedFriends: Friend[] = friendsData.map((f: any) => {
                const activity = activityMap.get(f.id);
                return {
                    id: String(f.id),
                    name: f.spotify_display_name || f.username,
                    username: `@${f.username}`,
                    avatar: f.spotify_profile_image_url,
                    isOnline: f.is_online,
                    currentlyPlaying: activity ? { 
                        name: activity.track_name, 
                        artist: activity.artist_name,
                        spotify_uri: activity.spotify_uri 
                    } : null,
                };
            });

            setFriends(mappedFriends);
        } catch (err) {
            console.error('Failed to fetch friends:', err);
        } finally {
            setLoading(false);
        }
    }, [token]);

    // Fetch friend requests
    const fetchFriendRequests = useCallback(async () => {
        if (!token) return;
        try {
            setLoadingRequests(true);
            const [incomingRes, outgoingRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/friends/requests/incoming`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`${API_BASE_URL}/api/friends/requests/outgoing`, {
                    headers: { Authorization: `Bearer ${token}` },
                })
            ]);
            
            if (!incomingRes.ok || !outgoingRes.ok) {
                console.error('Friend requests fetch failed', {
                    incomingStatus: incomingRes.status,
                    outgoingStatus: outgoingRes.status
                });
            }
            
            const incomingRaw = incomingRes.ok ? await incomingRes.json() : [];
            const outgoingRaw = outgoingRes.ok ? await outgoingRes.json() : [];

            console.log('Friend requests raw data:', { incomingRaw, outgoingRaw });

            // Normalize backend shape to FriendRequest
            const incoming = (incomingRaw || []).map((req: any) => ({
                request_id: req.id,
                user_id: req.from_user?.id,
                username: req.from_user?.username,
                spotify_display_name: req.from_user?.spotify_display_name,
                spotify_profile_image_url: req.from_user?.spotify_profile_image_url,
                created_at: req.created_at,
            }));

            console.log('Mapped incoming requests:', incoming);

            const outgoing = (outgoingRaw || []).map((req: any) => ({
                request_id: req.id,
                user_id: req.to_user?.id,
                username: req.to_user?.username,
                spotify_display_name: req.to_user?.spotify_display_name,
                spotify_profile_image_url: req.to_user?.spotify_profile_image_url,
                created_at: req.created_at,
            }));
            
            setIncomingRequests(incoming);
            setOutgoingRequests(outgoing);
        } catch (err) {
            console.error('Failed to fetch friend requests:', err);
            setIncomingRequests([]);
            setOutgoingRequests([]);
        } finally {
            setLoadingRequests(false);
        }
    }, [token]);

    // Accept friend request
    const acceptRequest = async (requestId: number) => {
        if (!token) return;
        setProcessingRequest(requestId);
        try {
            const res = await fetch(`${API_BASE_URL}/api/friends/requests/${requestId}/accept`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to accept request');
            Alert.alert('Success', 'Friend request accepted!');
            await fetchFriendRequests();
            await fetchFriends();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to accept request');
        } finally {
            setProcessingRequest(null);
        }
    };

    // Reject friend request
    const rejectRequest = async (requestId: number) => {
        if (!token) return;
        setProcessingRequest(requestId);
        try {
            const res = await fetch(`${API_BASE_URL}/api/friends/requests/${requestId}/reject`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to reject request');
            await fetchFriendRequests();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to reject request');
        } finally {
            setProcessingRequest(null);
        }
    };

    // Cancel outgoing request
    const cancelRequest = async (requestId: number) => {
        if (!token) return;
        setProcessingRequest(requestId);
        try {
            const res = await fetch(`${API_BASE_URL}/api/friends/requests/${requestId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to cancel request');
            await fetchFriendRequests();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to cancel request');
        } finally {
            setProcessingRequest(null);
        }
    };

    // Open requests modal with smooth animation
    const openRequestsModal = () => {
        setShowRequestsModal(true);
        requestsModalProgress.value = withTiming(1, {
            duration: 350,
            easing: Easing.out(Easing.cubic),
        });
    };

    // Close requests modal with smooth animation
    const closeRequestsModal = () => {
        requestsModalProgress.value = withTiming(0, {
            duration: 250,
            easing: Easing.in(Easing.cubic),
        });
        setTimeout(() => setShowRequestsModal(false), 250);
    };

    // Search for users by username
    const searchUsers = useCallback(async (query: string) => {
        if (!token || query.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Search failed');
            const data = await res.json();
            setSearchResults(data);
        } catch (err) {
            console.error('Search failed:', err);
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    }, [token]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.length >= 2) {
                searchUsers(searchQuery);
            } else {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, searchUsers]);

    // Add friend by ID (now sends a friend request)
    const handleAddFriend = async (userId: number) => {
        if (!token) return;
        setAddingFriend(userId);
        try {
            const res = await fetch(`${API_BASE_URL}/api/friends/request/${userId}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Failed to send friend request');
            }
            // Refresh requests
            await fetchFriendRequests();
            // Update search results
            setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, is_friend: true } : u));
            Alert.alert('Success', 'Friend request sent!');
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to send friend request');
        } finally {
            setAddingFriend(null);
        }
    };

    // Send friend request by username
    const handleSendRequestByUsername = async () => {
        if (!token || !searchQuery.trim()) return;
        setSendingRequest(true);
        setRequestError(null);
        setRequestSuccess(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/friends/request-by-username`, {
                method: 'POST',
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username: searchQuery.trim() })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || 'Failed to send friend request');
            }
            setRequestSuccess(`Friend request sent to ${data.user?.username || searchQuery}!`);
            setSearchQuery('');
            await fetchFriendRequests();
        } catch (err: any) {
            setRequestError(err.message || 'Failed to send friend request');
        } finally {
            setSendingRequest(false);
        }
    };

    // Open add friend modal with smooth animation
    const openAddModal = () => {
        setShowAddModal(true);
        setSearchQuery('');
        setSearchResults([]);
        setRequestError(null);
        setRequestSuccess(null);
        addModalProgress.value = withTiming(1, {
            duration: 350,
            easing: Easing.out(Easing.cubic),
        });
    };

    // Close add friend modal with smooth animation
    const closeAddModal = () => {
        addModalProgress.value = withTiming(0, {
            duration: 250,
            easing: Easing.in(Easing.cubic),
        });
        setTimeout(() => {
            setShowAddModal(false);
            setSearchQuery('');
            setSearchResults([]);
        }, 250);
    };

    useEffect(() => {
        fetchFriends();
        fetchFriendRequests();
    }, [fetchFriends, fetchFriendRequests]);

    // Refresh friends list when tab is focused for real-time updates
    useFocusEffect(
        useCallback(() => {
            fetchFriends();
            fetchFriendRequests();
        }, [fetchFriends, fetchFriendRequests])
    );

    useEffect(() => {
        // Animate in when data loads
        if (!loading) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [loading, fadeAnim, slideAnim]);

    const router = useRouter();
    const onlineFriends = friends.filter(f => f.isOnline);
    const offlineFriends = friends.filter(f => !f.isOnline);

    const handleFriendPress = (friend: Friend) => {
        // Navigate to the user profile page
        router.push(`/user/${friend.id}`);
    };

    const handleDeleteFriend = async (friendId: string) => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/friends/${friendId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to remove friend');
            setFriends(prev => prev.filter(f => f.id !== friendId));
        } catch (err) {
            console.error('Failed to remove friend:', err);
            alert('Failed to remove friend');
        }
    };

    if (loading) {
        return <LoadingScreen message="Loading friends..." />;
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Ionicons name="people" size={32} color={theme.colors.accent} />
                    <Text style={styles.title}>Friends</Text>
                    <Text style={styles.subtitle}>See what your friends are listening to</Text>
                </View>

                {/* Friend Requests Button */}
                {incomingRequests.length > 0 && (
                    <Pressable 
                        style={({ pressed }) => [
                            styles.requestsButton,
                            pressed && styles.requestsButtonPressed
                        ]} 
                        onPress={openRequestsModal}
                    >
                        <View style={styles.requestsButtonContent}>
                            <Ionicons name="mail" size={20} color={theme.colors.accent} />
                            <Text style={styles.requestsButtonText}>Friend Requests</Text>
                        </View>
                        <View style={styles.requestsBadge}>
                            <Text style={styles.requestsBadgeText}>{incomingRequests.length}</Text>
                        </View>
                    </Pressable>
                )}

                {/* Listening Now */}
                {onlineFriends.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="radio" size={18} color={theme.colors.success} />
                            <Text style={styles.sectionTitle}>Listening Now</Text>
                        </View>
                        {onlineFriends.map((friend, index) => (
                            <Reanimated.View
                                key={friend.id}
                                entering={FadeInDown.delay(index * 50).duration(300)}
                            >
                                <Pressable 
                                    style={({ pressed }) => [
                                        styles.friendCard,
                                        pressed && styles.friendCardPressed
                                    ]} 
                                    onPress={() => handleFriendPress(friend)}
                                >
                                    <View style={styles.friendRow}>
                                        <View style={styles.avatarContainer}>
                                            <View style={styles.avatar}>
                                                <Text style={styles.avatarText}>{friend.name[0]}</Text>
                                            </View>
                                            <View style={styles.onlineDot} />
                                        </View>
                                        <View style={styles.friendInfo}>
                                            <Text style={styles.friendName}>{friend.name}</Text>
                                            {friend.currentlyPlaying && (
                                                <Pressable 
                                                    style={styles.playingRow}
                                                    onPress={() => friend.currentlyPlaying?.spotify_uri && openInSpotify({ uri: friend.currentlyPlaying.spotify_uri, type: 'track', name: friend.currentlyPlaying.name })}
                                                >
                                                    <Ionicons name="musical-note" size={12} color={theme.colors.accent} />
                                                    <Text style={styles.playingText} numberOfLines={1}>
                                                        {friend.currentlyPlaying.name} • {friend.currentlyPlaying.artist}
                                                    </Text>
                                                    <Ionicons name="play-circle" size={16} color={theme.colors.accent} />
                                                </Pressable>
                                            )}
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                                    </View>
                                </Pressable>
                            </Reanimated.View>
                        ))}
                    </View>
                )}

                {/* All Friends */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>All Friends ({friends.length})</Text>
                    {friends.length === 0 && !loading && (
                        <Reanimated.View 
                            entering={FadeInDown.duration(400)}
                            style={styles.emptyState}
                        >
                            <Ionicons name="people-outline" size={48} color={theme.colors.textMuted} />
                            <Text style={styles.emptyStateText}>No friends yet</Text>
                            <Text style={styles.emptyStateHint}>Add friends to see what they're listening to</Text>
                        </Reanimated.View>
                    )}
                    {friends.map((friend, index) => (
                        <Reanimated.View
                            key={friend.id}
                            entering={FadeInDown.delay(index * 40).duration(300)}
                        >
                            <Pressable 
                                style={({ pressed }) => [
                                    styles.friendCard,
                                    pressed && styles.friendCardPressed
                                ]} 
                                onPress={() => handleFriendPress(friend)}
                            >
                                <View style={styles.friendRow}>
                                    <View style={styles.avatarContainer}>
                                        <View style={styles.avatar}>
                                            <Text style={styles.avatarText}>{friend.name[0]}</Text>
                                        </View>
                                        {friend.isOnline && <View style={styles.onlineDot} />}
                                    </View>
                                    <View style={styles.friendInfo}>
                                        <Text style={styles.friendName}>{friend.name}</Text>
                                        <Text style={styles.friendUsername}>{friend.username}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                                </View>
                            </Pressable>
                        </Reanimated.View>
                    ))}
                </View>

                <Pressable 
                    style={({ pressed }) => [
                        styles.addFriendButton,
                        pressed && styles.addFriendButtonPressed
                    ]} 
                    onPress={openAddModal}
                >
                    <Ionicons name="person-add" size={20} color={theme.colors.accent} />
                    <Text style={styles.addFriendText}>Add Friend</Text>
                </Pressable>
            </ScrollView>

            {/* Friend Requests Modal */}
            <Modal
                visible={showRequestsModal}
                transparent
                animationType="none"
                onRequestClose={closeRequestsModal}
                statusBarTranslucent
            >
                <Reanimated.View style={[styles.modalOverlay, requestsBackdropStyle]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={closeRequestsModal} />
                    <Reanimated.View style={[styles.modalContent, requestsContentStyle]}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Friend Requests</Text>
                            <Pressable 
                                onPress={closeRequestsModal}
                                style={({ pressed }) => [
                                    styles.closeButton,
                                    pressed && styles.closeButtonPressed
                                ]}
                            >
                                <Ionicons name="close" size={24} color={theme.colors.text} />
                            </Pressable>
                        </View>

                        <ScrollView 
                            style={styles.requestsList} 
                            contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {loadingRequests ? (
                                <ActivityIndicator size="large" color={theme.colors.accent} style={{ paddingVertical: 40 }} />
                            ) : incomingRequests.length === 0 ? (
                                <View style={styles.emptyRequestsState}>
                                    <Ionicons name="mail-outline" size={48} color={theme.colors.textMuted} />
                                    <Text style={styles.emptyRequestsText}>No pending requests</Text>
                                    <Text style={styles.emptyRequestsHint}>Friend requests you receive will appear here</Text>
                                </View>
                            ) : (
                                incomingRequests.map((request, index) => (
                                    <Reanimated.View
                                        key={request.request_id}
                                        entering={FadeInDown.delay(index * 50).duration(300)}
                                        layout={Layout.springify().damping(15)}
                                        style={styles.requestCard}
                                    >
                                        <View style={styles.requestAvatar}>
                                            <Text style={styles.requestAvatarText}>
                                                {(request.spotify_display_name || request.username || '?')[0]?.toUpperCase()}
                                            </Text>
                                        </View>
                                        <View style={styles.requestInfo}>
                                            <Text style={styles.requestName}>
                                                {request.spotify_display_name || request.username || 'Unknown User'}
                                            </Text>
                                            <Text style={styles.requestUsername}>@{request.username || 'unknown'}</Text>
                                            <Text style={styles.requestTime}>
                                                {request.created_at ? new Date(request.created_at).toLocaleDateString() : 'Unknown date'}
                                            </Text>
                                        </View>
                                        <View style={styles.requestActions}>
                                            <Pressable
                                                style={({ pressed }) => [
                                                    styles.acceptButton,
                                                    pressed && styles.acceptButtonPressed
                                                ]}
                                                onPress={() => acceptRequest(request.request_id)}
                                                disabled={processingRequest === request.request_id}
                                            >
                                                {processingRequest === request.request_id ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <Ionicons name="checkmark" size={20} color="#fff" />
                                                )}
                                            </Pressable>
                                            <Pressable
                                                style={({ pressed }) => [
                                                    styles.rejectButton,
                                                    pressed && styles.rejectButtonPressed
                                                ]}
                                                onPress={() => rejectRequest(request.request_id)}
                                                disabled={processingRequest === request.request_id}
                                            >
                                                <Ionicons name="close" size={20} color={theme.colors.danger} />
                                            </Pressable>
                                        </View>
                                    </Reanimated.View>
                                ))
                            )}
                        </ScrollView>
                    </Reanimated.View>
                </Reanimated.View>
            </Modal>

            {/* Add Friend Modal */}
            <Modal
                visible={showAddModal}
                transparent
                animationType="none"
                onRequestClose={closeAddModal}
                statusBarTranslucent
            >
                <Reanimated.View style={[styles.modalOverlay, addBackdropStyle]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={closeAddModal} />
                    <Reanimated.View style={[styles.modalContent, addContentStyle]}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Friend</Text>
                            <Pressable 
                                onPress={closeAddModal} 
                                hitSlop={10}
                                style={({ pressed }) => [
                                    styles.closeButton,
                                    pressed && styles.closeButtonPressed
                                ]}
                            >
                                <Ionicons name="close" size={24} color={theme.colors.text} />
                            </Pressable>
                        </View>

                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={20} color={theme.colors.textMuted} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Enter username..."
                                placeholderTextColor={theme.colors.textMuted}
                                value={searchQuery}
                                onChangeText={(text) => {
                                    setSearchQuery(text);
                                    setRequestError(null);
                                    setRequestSuccess(null);
                                }}
                                autoCapitalize="none"
                                autoCorrect={false}
                                onSubmitEditing={handleSendRequestByUsername}
                                returnKeyType="send"
                            />
                            {searching && <ActivityIndicator size="small" color={theme.colors.accent} />}
                        </View>

                        {/* Send Request Button */}
                        <Pressable
                            style={({ pressed }) => [
                                styles.sendRequestButton,
                                (!searchQuery.trim() || sendingRequest) && styles.sendRequestButtonDisabled,
                                pressed && searchQuery.trim() && !sendingRequest && styles.sendRequestButtonPressed
                            ]}
                            onPress={handleSendRequestByUsername}
                            disabled={!searchQuery.trim() || sendingRequest}
                        >
                            {sendingRequest ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="send" size={18} color="#fff" />
                                    <Text style={styles.sendRequestButtonText}>Send Friend Request</Text>
                                </>
                            )}
                        </Pressable>

                        {/* Error Message */}
                        {requestError && (
                            <Reanimated.View 
                                entering={FadeInDown.duration(200)}
                                style={styles.errorMessage}
                            >
                                <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
                                <Text style={styles.errorMessageText}>{requestError}</Text>
                            </Reanimated.View>
                        )}

                        {/* Success Message */}
                        {requestSuccess && (
                            <Reanimated.View 
                                entering={FadeInDown.duration(200)}
                                style={styles.successMessage}
                            >
                                <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                                <Text style={styles.successMessageText}>{requestSuccess}</Text>
                            </Reanimated.View>
                        )}

                        <View style={styles.dividerContainer}>
                            <View style={styles.divider} />
                            <Text style={styles.dividerText}>or search users</Text>
                            <View style={styles.divider} />
                        </View>

                        <ScrollView 
                            style={styles.searchResults} 
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {searchQuery.length > 0 && searchQuery.length < 2 && (
                                <Text style={styles.searchHint}>Type at least 2 characters to search</Text>
                            )}
                            {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
                                <Text style={styles.searchHint}>No users found</Text>
                            )}
                            {searchResults.map((user, index) => (
                                <Reanimated.View 
                                    key={user.id} 
                                    entering={FadeInDown.delay(index * 30).duration(200)}
                                    style={styles.searchResultItem}
                                >
                                    <View style={styles.searchResultAvatar}>
                                        <Text style={styles.searchResultAvatarText}>
                                            {(user.spotify_display_name || user.username)[0].toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={styles.searchResultInfo}>
                                        <Text style={styles.searchResultName}>
                                            {user.spotify_display_name || user.username}
                                        </Text>
                                        <Text style={styles.searchResultUsername}>@{user.username}</Text>
                                    </View>
                                    {user.is_friend ? (
                                        <View style={styles.alreadyFriendBadge}>
                                            <Ionicons name="checkmark" size={14} color={theme.colors.success} />
                                            <Text style={styles.alreadyFriendText}>Friends</Text>
                                        </View>
                                    ) : (
                                        <Pressable
                                            style={({ pressed }) => [
                                                styles.addButton,
                                                pressed && styles.addButtonPressed
                                            ]}
                                            onPress={() => handleAddFriend(user.id)}
                                            disabled={addingFriend === user.id}
                                        >
                                            {addingFriend === user.id ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <>
                                                    <Ionicons name="person-add" size={16} color="#fff" />
                                                    <Text style={styles.addButtonText}>Add</Text>
                                                </>
                                            )}
                                        </Pressable>
                                    )}
                                </Reanimated.View>
                            ))}
                        </ScrollView>
                    </Reanimated.View>
                </Reanimated.View>
            </Modal>
        </SafeAreaView>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: theme.colors.textMuted,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    emptyStateText: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.text,
    },
    emptyStateHint: {
        fontSize: 14,
        color: theme.colors.textMuted,
        textAlign: 'center',
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 64,
        gap: 24,
    },
    profileContent: {
        padding: 24,
        paddingBottom: 64,
        gap: 20,
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
    section: {
        gap: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.text,
    },
    friendCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: 8,
    },
    friendCardPressed: {
        backgroundColor: theme.colors.border,
        transform: [{ scale: 0.98 }],
    },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.colors.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.accent,
    },
    onlineDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: theme.colors.success,
        borderWidth: 2,
        borderColor: theme.colors.surface,
    },
    friendInfo: {
        flex: 1,
        gap: 4,
    },
    friendName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    friendUsername: {
        fontSize: 13,
        color: theme.colors.textMuted,
    },
    playingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    playingText: {
        fontSize: 13,
        color: theme.colors.accent,
        flex: 1,
    },
    addFriendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        borderStyle: 'dashed',
    },
    addFriendButtonPressed: {
        backgroundColor: theme.colors.accentMuted,
        transform: [{ scale: 0.98 }],
    },
    addFriendText: {
        color: theme.colors.accent,
        fontWeight: '600',
        fontSize: 15,
    },
    // Profile view styles
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    backButtonText: {
        fontSize: 16,
        color: theme.colors.text,
        fontWeight: '600',
    },
    profileHeader: {
        alignItems: 'center',
        gap: 8,
    },
    largeAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: theme.colors.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    largeAvatarText: {
        fontSize: 32,
        fontWeight: '700',
        color: theme.colors.accent,
    },
    profileName: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.colors.text,
    },
    profileUsername: {
        fontSize: 15,
        color: theme.colors.textMuted,
    },
    onlineIndicator: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    onlineText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '600',
    },
    nowPlayingCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        gap: 4,
    },
    nowPlayingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    nowPlayingLabel: {
        fontSize: 12,
        color: theme.colors.accent,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    nowPlayingSong: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.text,
    },
    nowPlayingArtist: {
        fontSize: 14,
        color: theme.colors.textMuted,
    },
    genreBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignSelf: 'flex-start',
    },
    genreText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    topSongRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    topSongNumber: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.colors.accent,
        width: 24,
    },
    topSongName: {
        fontSize: 15,
        color: theme.colors.text,
        flex: 1,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    compareButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    compareButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
    },
    historyButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    historyButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.danger,
    },
    deleteButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.danger,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: theme.colors.background,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        height: MODAL_HEIGHT,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 24,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -8,
        },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: theme.colors.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: theme.colors.text,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButtonPressed: {
        backgroundColor: theme.colors.border,
        transform: [{ scale: 0.95 }],
    },
    requestsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.colors.surface,
        padding: 16,
        borderRadius: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    requestsButtonPressed: {
        backgroundColor: theme.colors.border,
        transform: [{ scale: 0.98 }],
    },
    requestsButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    requestsButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    requestsBadge: {
        backgroundColor: theme.colors.accent,
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        minWidth: 24,
        alignItems: 'center',
    },
    requestsBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    requestsList: {
        flex: 1,
    },
    emptyRequestsState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 16,
    },
    emptyRequestsText: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.text,
    },
    emptyRequestsHint: {
        fontSize: 14,
        color: theme.colors.textMuted,
        textAlign: 'center',
    },
    requestCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    requestAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    requestAvatarText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
    },
    requestInfo: {
        flex: 1,
    },
    requestName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 2,
    },
    requestUsername: {
        fontSize: 14,
        color: theme.colors.textMuted,
        marginBottom: 4,
    },
    requestTime: {
        fontSize: 12,
        color: theme.colors.textMuted,
    },
    requestActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    acceptButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    acceptButtonPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.95 }],
    },
    rejectButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rejectButtonPressed: {
        backgroundColor: theme.colors.border,
        transform: [{ scale: 0.95 }],
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    searchResults: {
        flex: 1,
    },
    searchInput: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        color: theme.colors.text,
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    searchResultInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    searchResultAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchResultAvatarText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    searchResultName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    searchResultUsername: {
        fontSize: 14,
        color: theme.colors.textMuted,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: theme.colors.accent,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    addButtonPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.95 }],
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    alreadyFriendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(29, 185, 84, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    alreadyFriendText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.success,
    },
    noResultsText: {
        fontSize: 16,
        color: theme.colors.textMuted,
        textAlign: 'center',
        paddingVertical: 20,
    },
    searchHint: {
        fontSize: 14,
        color: theme.colors.textMuted,
        textAlign: 'center',
        paddingVertical: 20,
    },
    sendRequestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: theme.colors.accent,
        borderRadius: 12,
        paddingVertical: 14,
        marginBottom: 12,
    },
    sendRequestButtonDisabled: {
        opacity: 0.5,
    },
    sendRequestButtonPressed: {
        opacity: 0.85,
        transform: [{ scale: 0.98 }],
    },
    sendRequestButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    errorMessage: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255, 59, 48, 0.1)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    errorMessageText: {
        fontSize: 14,
        color: theme.colors.danger,
        flex: 1,
    },
    successMessage: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(29, 185, 84, 0.1)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    successMessageText: {
        fontSize: 14,
        color: theme.colors.success,
        flex: 1,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 12,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: theme.colors.border,
    },
    dividerText: {
        fontSize: 12,
        color: theme.colors.textMuted,
        marginHorizontal: 12,
    },
});
