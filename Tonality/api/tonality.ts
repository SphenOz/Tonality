import { API_BASE_URL } from '../utils/runtimeConfig';

export interface Community {
    id: number;
    name: string;
    description: string;
    image_url?: string;
    member_count: number;
    icon_name: string;
}

export interface CommunitySong {
    song_id: string;
    track_name: string;
    artist_name: string;
    album_name?: string;
    album_image_url?: string;
    spotify_uri?: string;
    count: number;
}

export interface CommunityMember {
    id: number;
    username: string;
    spotify_display_name?: string;
    spotify_profile_image_url?: string;
    is_online?: boolean;
    is_friend?: boolean;
    is_self?: boolean;
    joined_at?: string;
}

export interface Poll {
    id: number;
    community_id: number;
    title: string;
    description: string;
    ends_at: string;
    is_active: boolean;
}

export interface PollOption {
    id: number;
    song_name: string;
    artist_name: string;
    votes: number;
}

export interface PollDetail {
    poll: Poll;
    options: PollOption[];
}

export const getCommunities = async (token: string): Promise<Community[]> => {
    const response = await fetch(`${API_BASE_URL}/api/communities`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch communities');
    return response.json();
};

export const leaveCommunity = async (token: string, id: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/communities/${id}/leave`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to leave community');
};

export const getCommunityDetails = async (token: string, id: number): Promise<Community> => {
    const response = await fetch(`${API_BASE_URL}/api/communities/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch community details');
    return response.json();
};

export const getCommunityTopSongs = async (token: string, id: number): Promise<{ songs: CommunitySong[] }> => {
    const response = await fetch(`${API_BASE_URL}/api/communities/${id}/top-songs`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        console.error('Top songs fetch failed', { status: response.status });
        return { songs: [] };
    }
    return response.json();
};

export const getCommunityMembers = async (token: string, id: number): Promise<{ members: CommunityMember[], count: number }> => {
    const response = await fetch(`${API_BASE_URL}/api/communities/${id}/members`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        console.error('Members fetch failed', { status: response.status });
        return { members: [], count: 0 };
    }
    return response.json();
};

export const createCommunityPlaylist = async (token: string, id: number): Promise<{ playlist_id: string, playlist_url: string }> => {
    const response = await fetch(`${API_BASE_URL}/api/communities/${id}/playlist`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to create playlist');
    return response.json();
};

export const getActivePolls = async (token: string, communityId?: number): Promise<Poll[]> => {
    const url = communityId 
        ? `${API_BASE_URL}/api/polls/active?community_id=${communityId}`
        : `${API_BASE_URL}/api/polls/active`;
        
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch active polls');
    return response.json();
};

export const getPollDetails = async (token: string, pollId: number): Promise<PollDetail> => {
    const response = await fetch(`${API_BASE_URL}/api/polls/${pollId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch poll details');
    return response.json();
};

export const voteOnPoll = async (token: string, pollId: number, optionId: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ option_id: optionId })
    });
    if (!response.ok) throw new Error('Failed to vote');
};

export const generateWeeklyPolls = async (token: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/polls/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to generate polls');
};
