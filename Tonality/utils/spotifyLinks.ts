import { Linking, Alert, Platform } from 'react-native';

/**
 * Spotify Deep Linking Utility
 * Opens songs, albums, playlists, and artists in the Spotify app
 * Falls back to web URL if Spotify isn't installed
 */

// Spotify URI patterns
export const SPOTIFY_URI_PREFIX = 'spotify:';
export const SPOTIFY_WEB_BASE = 'https://open.spotify.com';

export interface SpotifyItem {
  uri?: string;        // spotify:track:xxx format
  id?: string;         // just the ID
  type: 'track' | 'album' | 'artist' | 'playlist';
  name?: string;       // for display in fallback messages
}

/**
 * Check if Spotify app is installed on the device
 */
export async function isSpotifyInstalled(): Promise<boolean> {
  try {
    return await Linking.canOpenURL('spotify://');
  } catch {
    return false;
  }
}

/**
 * Extract Spotify ID from a URI (spotify:track:xxx -> xxx)
 */
export function extractSpotifyId(uri: string): string | null {
  if (!uri) return null;
  
  // Already just an ID
  if (!uri.includes(':') && !uri.includes('/')) {
    return uri;
  }
  
  // spotify:track:xxx format
  if (uri.startsWith('spotify:')) {
    const parts = uri.split(':');
    return parts.length >= 3 ? parts[2] : null;
  }
  
  // https://open.spotify.com/track/xxx format
  if (uri.includes('open.spotify.com')) {
    const parts = uri.split('/');
    const idPart = parts[parts.length - 1];
    // Remove query params if any
    return idPart.split('?')[0];
  }
  
  return null;
}

/**
 * Build a Spotify app URI from type and ID
 */
export function buildSpotifyUri(type: string, id: string): string {
  return `spotify:${type}:${id}`;
}

/**
 * Build a Spotify web URL from type and ID
 */
export function buildSpotifyWebUrl(type: string, id: string): string {
  return `${SPOTIFY_WEB_BASE}/${type}/${id}`;
}

/**
 * Open a Spotify item (track, album, artist, playlist) in the Spotify app
 * Falls back to web URL if Spotify isn't installed
 */
export async function openInSpotify(item: SpotifyItem): Promise<boolean> {
  const id = item.id || (item.uri ? extractSpotifyId(item.uri) : null);
  
  if (!id) {
    console.error('[SpotifyLinks] No valid ID provided:', item);
    return false;
  }
  
  const appUri = buildSpotifyUri(item.type, id);
  const webUrl = buildSpotifyWebUrl(item.type, id);
  
  try {
    // First, try to open in Spotify app
    try {
      // Check if we can open the URL (requires LSApplicationQueriesSchemes on iOS)
      const canOpenApp = await Linking.canOpenURL(appUri);
      
      if (canOpenApp) {
        await Linking.openURL(appUri);
        return true;
      } else {
        // On iOS, canOpenURL might return false if the scheme isn't in Info.plist
        // (which happens in Expo Go). Try to open it anyway.
        await Linking.openURL(appUri);
        return true;
      }
    } catch (error) {
      // If openURL fails, it means the app is likely not installed
      console.log('[SpotifyLinks] Could not open app directly, falling back to prompt:', error);
    }
    
    // Fallback: Show alert with options
    return new Promise((resolve) => {
      Alert.alert(
        'Spotify Not Installed',
        item.name 
          ? `Would you like to listen to "${item.name}" in your browser?`
          : 'Would you like to open this in your browser?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Open in Browser',
            onPress: async () => {
              try {
                await Linking.openURL(webUrl);
                resolve(true);
              } catch {
                resolve(false);
              }
            },
          },
          {
            text: 'Get Spotify',
            onPress: async () => {
              try {
                const storeUrl = Platform.OS === 'ios'
                  ? 'https://apps.apple.com/app/spotify-music/id324684580'
                  : 'https://play.google.com/store/apps/details?id=com.spotify.music';
                await Linking.openURL(storeUrl);
                resolve(false);
              } catch {
                resolve(false);
              }
            },
          },
        ]
      );
    });
  } catch (error) {
    console.error('[SpotifyLinks] Error opening Spotify:', error);
    
    // Last resort: try web URL directly
    try {
      await Linking.openURL(webUrl);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Open a track in Spotify
 */
export async function openTrack(trackIdOrUri: string, trackName?: string): Promise<boolean> {
  return openInSpotify({
    uri: trackIdOrUri.startsWith('spotify:') ? trackIdOrUri : undefined,
    id: trackIdOrUri.startsWith('spotify:') ? undefined : trackIdOrUri,
    type: 'track',
    name: trackName,
  });
}

/**
 * Open an album in Spotify
 */
export async function openAlbum(albumIdOrUri: string, albumName?: string): Promise<boolean> {
  return openInSpotify({
    uri: albumIdOrUri.startsWith('spotify:') ? albumIdOrUri : undefined,
    id: albumIdOrUri.startsWith('spotify:') ? undefined : albumIdOrUri,
    type: 'album',
    name: albumName,
  });
}

/**
 * Open an artist in Spotify
 */
export async function openArtist(artistIdOrUri: string, artistName?: string): Promise<boolean> {
  return openInSpotify({
    uri: artistIdOrUri.startsWith('spotify:') ? artistIdOrUri : undefined,
    id: artistIdOrUri.startsWith('spotify:') ? undefined : artistIdOrUri,
    type: 'artist',
    name: artistName,
  });
}

/**
 * Open a playlist in Spotify
 */
export async function openPlaylist(playlistIdOrUri: string, playlistName?: string): Promise<boolean> {
  return openInSpotify({
    uri: playlistIdOrUri.startsWith('spotify:') ? playlistIdOrUri : undefined,
    id: playlistIdOrUri.startsWith('spotify:') ? undefined : playlistIdOrUri,
    type: 'playlist',
    name: playlistName,
  });
}

/**
 * Search for a track on Spotify and open it
 * Useful when you only have track name/artist but no ID
 */
export async function searchAndOpenTrack(trackName: string, artistName?: string): Promise<boolean> {
  const query = artistName ? `${trackName} ${artistName}` : trackName;
  const searchUrl = `${SPOTIFY_WEB_BASE}/search/${encodeURIComponent(query)}`;
  
  try {
    await Linking.openURL(searchUrl);
    return true;
  } catch {
    return false;
  }
}
