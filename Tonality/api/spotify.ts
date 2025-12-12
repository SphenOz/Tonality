export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

function getAuthHeaders(token: string) {
    return {
        Authorization: `Bearer ${token}`,
    };
}

async function handleSpotifyResponse(response: Response) {
    // Some endpoints (like currently playing) return 204 when nothing is playing
    if (response.status === 204) return null;

    if (!response.ok) {
        let errorBody: unknown;
        try {
            errorBody = await response.json();
        } catch {
            errorBody = await response.text();
        }
        console.error("Spotify API error:", response.status, errorBody);
        throw new Error(`Spotify API error: ${response.status}`);
    }

    return response.json();
}

export async function fetchUserProfile(token: string) {
    const response = await fetch(`${SPOTIFY_API_BASE}/me`, {
        headers: getAuthHeaders(token),
    });
    return handleSpotifyResponse(response);
}

/**
 * Get user's top tracks
 */
export async function fetchUserTopTracks(
    token: string,
    timeRange: "short_term" | "medium_term" | "long_term" = "short_term",
    limit: number = 20
) {
    const response = await fetch(
        `${SPOTIFY_API_BASE}/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
        {
            headers: getAuthHeaders(token),
        }
    );
    return handleSpotifyResponse(response);
}

/**
 * Get user's top artists
 * https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks
 */
export async function fetchUserTopArtists(
    token: string,
    timeRange: "short_term" | "medium_term" | "long_term" = "short_term",
    limit: number = 20
) {
    const response = await fetch(
        `${SPOTIFY_API_BASE}/me/top/artists?time_range=${timeRange}&limit=${limit}`,
        {
            headers: getAuthHeaders(token),
        }
    );
    return handleSpotifyResponse(response);
}

/**
 * Get current playback state (device, context, item, is_playing, etc.)
 * https://developer.spotify.com/documentation/web-api/reference/get-information-about-the-users-current-playback
 */
export async function fetchCurrentPlayback(token: string) {
    const response = await fetch(`${SPOTIFY_API_BASE}/me/player`, {
        headers: getAuthHeaders(token),
    });
    return handleSpotifyResponse(response);
}

/**
 * Get the currently playing track (slightly different, more focused endpoint)
 * https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track
 */
export async function fetchCurrentlyPlayingTrack(token: string) {
    const response = await fetch(
        `${SPOTIFY_API_BASE}/me/player/currently-playing`,
        {
            headers: getAuthHeaders(token),
        }
    );
    return handleSpotifyResponse(response);
}

/**
 * Get recently played tracks
 * https://developer.spotify.com/documentation/web-api/reference/get-recently-played
 *
 * `after` / `before` are timestamps in ms since epoch. You usually only use one.
 */
export async function fetchRecentlyPlayedTracks(
    token: string,
    options: {
        limit?: number;
        before?: number; // timestamp (ms)
        after?: number;  // timestamp (ms)
    } = {}
) {
    const params = new URLSearchParams();

    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.before !== undefined)
        params.set("before", String(options.before));
    if (options.after !== undefined)
        params.set("after", String(options.after));

    const query = params.toString();
    const url = `${SPOTIFY_API_BASE}/me/player/recently-played${query ? `?${query}` : ""}`;

    const response = await fetch(url, {
        headers: getAuthHeaders(token),
    });
    return handleSpotifyResponse(response);
}

/**
 * Get recommendations
 * https://developer.spotify.com/documentation/web-api/reference/get-recommendations
 *
 * seeds: at least one of artists, genres, or tracks must be non-empty,
 * and total seeds (artists + genres + tracks) <= 5
 */
export async function fetchRecommendations(
    token: string,
    options: {
        seedArtists?: string[]; // Spotify artist IDs
        seedTracks?: string[];  // Spotify track IDs
        seedGenres?: string[];  // genre strings
        limit?: number;
        market?: string;
        minEnergy?: number;
        maxEnergy?: number;
        minValence?: number;
        maxValence?: number;
        [key: string]: unknown;
    }
) {
    const params = new URLSearchParams();

    if (options.seedArtists?.length)
        params.set("seed_artists", options.seedArtists.join(","));
    if (options.seedTracks?.length)
        params.set("seed_tracks", options.seedTracks.join(","));
    if (options.seedGenres?.length)
        params.set("seed_genres", options.seedGenres.join(","));

    if (options.limit !== undefined)
        params.set("limit", String(options.limit));
    if (options.market !== undefined)
        params.set("market", options.market);

    // Example of passing tunable track attributes
    if (options.minEnergy !== undefined)
        params.set("min_energy", String(options.minEnergy));
    if (options.maxEnergy !== undefined)
        params.set("max_energy", String(options.maxEnergy));
    if (options.minValence !== undefined)
        params.set("min_valence", String(options.minValence));
    if (options.maxValence !== undefined)
        params.set("max_valence", String(options.maxValence));

    const url = `${SPOTIFY_API_BASE}/recommendations?${params.toString()}`;

    const response = await fetch(url, {
        headers: getAuthHeaders(token),
    });
    return handleSpotifyResponse(response);
}

/**
 * Get a track by ID
 * https://developer.spotify.com/documentation/web-api/reference/get-track
 */
export async function fetchTrack(token: string, trackId: string) {
    const response = await fetch(`${SPOTIFY_API_BASE}/tracks/${trackId}`, {
        headers: getAuthHeaders(token),
    });
    return handleSpotifyResponse(response);
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

