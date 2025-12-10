export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

export async function fetchUserProfile(token: string) {
    const response = await fetch(`${SPOTIFY_API_BASE}/me`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}

export async function fetchUserTopTracks(token: string, timeRange: 'short_term' | 'medium_term' | 'long_term' = 'short_term', limit: number = 20) {
    const response = await fetch(`${SPOTIFY_API_BASE}/me/top/tracks?time_range=${timeRange}&limit=${limit}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}
