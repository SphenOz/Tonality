export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

// ============= User Profile & Library =============

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

export async function fetchUserTopArtists(token: string, timeRange: 'short_term' | 'medium_term' | 'long_term' = 'short_term', limit: number = 20) {
    const response = await fetch(`${SPOTIFY_API_BASE}/me/top/artists?time_range=${timeRange}&limit=${limit}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}

export async function fetchRecentlyPlayed(token: string, limit: number = 20) {
    const response = await fetch(`${SPOTIFY_API_BASE}/me/player/recently-played?limit=${limit}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}

// ============= Currently Playing =============

export async function fetchCurrentlyPlaying(token: string) {
    const response = await fetch(`${SPOTIFY_API_BASE}/me/player/currently-playing`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    
    // 204 means nothing is playing
    if (response.status === 204) {
        return null;
    }
    
    return response.json();
}

// ============= Search =============

export interface SpotifyTrack {
    id: string;
    name: string;
    uri: string;
    artists: Array<{ id: string; name: string }>;
    album: {
        id: string;
        name: string;
        images: Array<{ url: string; width: number; height: number }>;
    };
    duration_ms: number;
    preview_url: string | null;
    popularity: number;
}

export interface SpotifyArtist {
    id: string;
    name: string;
    uri: string;
    images: Array<{ url: string; width: number; height: number }>;
    genres: string[];
    popularity: number;
    followers: { total: number };
}

export interface SpotifyPlaylist {
    id: string;
    name: string;
    uri: string;
    description: string;
    images: Array<{ url: string; width: number; height: number }>;
    owner: { display_name: string; id: string };
    tracks: { total: number };
}

export async function searchTracks(token: string, query: string, limit: number = 20): Promise<{ tracks: { items: SpotifyTrack[] } }> {
    const response = await fetch(
        `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
    return response.json();
}

export async function searchArtists(token: string, query: string, limit: number = 20): Promise<{ artists: { items: SpotifyArtist[] } }> {
    const response = await fetch(
        `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=artist&limit=${limit}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
    return response.json();
}

export async function searchPlaylists(token: string, query: string, limit: number = 20): Promise<{ playlists: { items: SpotifyPlaylist[] } }> {
    const response = await fetch(
        `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=playlist&limit=${limit}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
    return response.json();
}

// ============= Track Details =============

export async function getTrack(token: string, trackId: string): Promise<SpotifyTrack> {
    const response = await fetch(`${SPOTIFY_API_BASE}/tracks/${trackId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}

export async function getTracks(token: string, trackIds: string[]): Promise<{ tracks: SpotifyTrack[] }> {
    const response = await fetch(`${SPOTIFY_API_BASE}/tracks?ids=${trackIds.join(',')}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}

// ============= Browse & Discover =============

export async function getFeaturedPlaylists(token: string, limit: number = 20) {
    const response = await fetch(`${SPOTIFY_API_BASE}/browse/featured-playlists?limit=${limit}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}

export async function getCategoryPlaylists(token: string, categoryId: string, limit: number = 20) {
    const response = await fetch(`${SPOTIFY_API_BASE}/browse/categories/${categoryId}/playlists?limit=${limit}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}

export async function getCategories(token: string, limit: number = 50) {
    const response = await fetch(`${SPOTIFY_API_BASE}/browse/categories?limit=${limit}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}

export async function getNewReleases(token: string, limit: number = 20) {
    const response = await fetch(`${SPOTIFY_API_BASE}/browse/new-releases?limit=${limit}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}

// ============= Recommendations =============

export async function getRecommendations(
    token: string, 
    options: {
        seedTracks?: string[];
        seedArtists?: string[];
        seedGenres?: string[];
        limit?: number;
        targetPopularity?: number;
    }
): Promise<{ tracks: SpotifyTrack[] }> {
    const params = new URLSearchParams();
    
    if (options.seedTracks?.length) {
        params.append('seed_tracks', options.seedTracks.slice(0, 5).join(','));
    }
    if (options.seedArtists?.length) {
        params.append('seed_artists', options.seedArtists.slice(0, 5).join(','));
    }
    if (options.seedGenres?.length) {
        params.append('seed_genres', options.seedGenres.slice(0, 5).join(','));
    }
    if (options.limit) {
        params.append('limit', String(options.limit));
    }
    if (options.targetPopularity !== undefined) {
        params.append('target_popularity', String(options.targetPopularity));
    }
    
    const response = await fetch(`${SPOTIFY_API_BASE}/recommendations?${params.toString()}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}

// ============= Playlists =============

export async function getPlaylist(token: string, playlistId: string) {
    const response = await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}

export async function getPlaylistTracks(token: string, playlistId: string, limit: number = 100) {
    const response = await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks?limit=${limit}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}

export async function createPlaylist(
    token: string, 
    userId: string, 
    name: string, 
    description?: string, 
    isPublic: boolean = false
) {
    const response = await fetch(`${SPOTIFY_API_BASE}/users/${userId}/playlists`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name,
            description: description || '',
            public: isPublic,
        }),
    });
    return response.json();
}

export async function addTracksToPlaylist(token: string, playlistId: string, trackUris: string[]) {
    const response = await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            uris: trackUris,
        }),
    });
    return response.json();
}

// ============= Artists =============

export async function getArtist(token: string, artistId: string): Promise<SpotifyArtist> {
    const response = await fetch(`${SPOTIFY_API_BASE}/artists/${artistId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}

export async function getArtistTopTracks(token: string, artistId: string, market: string = 'US'): Promise<{ tracks: SpotifyTrack[] }> {
    const response = await fetch(`${SPOTIFY_API_BASE}/artists/${artistId}/top-tracks?market=${market}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}

// ============= Audio Features =============

export interface AudioFeatures {
    danceability: number;
    energy: number;
    key: number;
    loudness: number;
    mode: number;
    speechiness: number;
    acousticness: number;
    instrumentalness: number;
    liveness: number;
    valence: number;
    tempo: number;
}

export async function getAudioFeatures(token: string, trackId: string): Promise<AudioFeatures> {
    const response = await fetch(`${SPOTIFY_API_BASE}/audio-features/${trackId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}

export async function getMultipleAudioFeatures(token: string, trackIds: string[]): Promise<{ audio_features: AudioFeatures[] }> {
    const response = await fetch(`${SPOTIFY_API_BASE}/audio-features?ids=${trackIds.join(',')}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}

// ============= Available Genre Seeds =============

export async function getAvailableGenreSeeds(token: string): Promise<{ genres: string[] }> {
    const response = await fetch(`${SPOTIFY_API_BASE}/recommendations/available-genre-seeds`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.json();
}

