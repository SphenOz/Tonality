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
