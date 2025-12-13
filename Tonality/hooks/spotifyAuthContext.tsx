import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { useTonalityAuth } from '../context/AuthContext';
import { API_BASE_URL, SPOTIFY_CLIENT_ID } from '../utils/runtimeConfig';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = SPOTIFY_CLIENT_ID;
const CV_KEY = 'spotify_pkce_cv';
const STATE_KEY = 'spotify_oauth_state';
const TOKEN_KEY = 'spotify_access_token';
const REDIRECT_PATH = 'profile';
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';
const REDIRECT_URI = AuthSession.makeRedirectUri({ path: REDIRECT_PATH });
const USE_PROXY = IS_EXPO_GO;

console.log(
  '[SpotifyAuth] redirectUri:',
  REDIRECT_URI,
  'useProxy:',
  USE_PROXY,
  'executionEnv:',
  Constants.executionEnvironment
);

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

interface SpotifyAuthContextValue {
  token: string | null;
  isLoaded: boolean;
  request: AuthSession.AuthRequest | null;
  promptAsync: (
    options?: AuthSession.AuthRequestPromptOptions
  ) => Promise<AuthSession.AuthSessionResult | undefined>;
  disconnect: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const SpotifyAuthContext =
  createContext<SpotifyAuthContextValue | undefined>(undefined);

function useProvideSpotifyAuth(): SpotifyAuthContextValue {
  const [token, setToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const { user, token: authToken } = useTonalityAuth();

  const stateRef = useRef<string | null>(null);
  const verifierRef = useRef<string | null>(null);

  const storageKey = useMemo(() => {
    return user?.username ? `${TOKEN_KEY}_${user.username}` : null;
  }, [user?.username]);

  // separate key for the Spotify refresh token
  const refreshStorageKey = useMemo(() => {
    return storageKey ? `${storageKey}_refresh` : null;
  }, [storageKey]);

  const [request, response, promptAsyncInternal] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      usePKCE: true,
      responseType: AuthSession.ResponseType.Code,
      scopes: [
        'user-read-email',
        'user-library-read',
        'user-top-read',
        'user-read-recently-played',
        'user-read-currently-playing',
        'user-read-playback-state',
        'playlist-read-private',
        'playlist-read-collaborative',
        'playlist-modify-public',
        'playlist-modify-private',
      ],
      redirectUri: REDIRECT_URI,
    },
    discovery
  );

  // Load access token from storage on mount
  useEffect(() => {
    let isMounted = true;

    (async () => {
      if (!storageKey) {
        if (isMounted) {
          setToken(null);
          setIsLoaded(true);
        }
        return;
      }

      try {
        const storedToken = await SecureStore.getItemAsync(storageKey);
        if (isMounted) {
          setToken(storedToken ?? null);
        }
      } finally {
        if (isMounted) {
          setIsLoaded(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [storageKey]);

  // Save verifier/state whenever they change on the request
  useEffect(() => {
    if (request?.codeVerifier) {
      console.log('[SpotifyAuth] Saving code verifier to storage');
      SecureStore.setItemAsync(CV_KEY, request.codeVerifier);
      verifierRef.current = request.codeVerifier;
    }
    if (request?.state) {
      console.log('[SpotifyAuth] Saving state to storage');
      SecureStore.setItemAsync(STATE_KEY, request.state);
      stateRef.current = request.state;
    }
  }, [request?.codeVerifier, request?.state]);

  const exchangeCodeForToken = useCallback(
    async (code: string, returnedState: string) => {
      console.log(
        '[SpotifyAuth] Exchanging code for token. redirectUri=',
        REDIRECT_URI
      );
      
      console.log('[SpotifyAuth] State check:', {
        stateRef: stateRef.current,
        returnedState,
      });
      
      const expectedState =
        stateRef.current ?? (await SecureStore.getItemAsync(STATE_KEY));
      if (expectedState && returnedState && returnedState !== expectedState) {
        console.error('State mismatch during auth', {
          expectedState,
          returnedState,
        });
        return;
      }

      console.log('[SpotifyAuth] Verifier check:', {
        verifierRef: verifierRef.current ? 'exists' : 'null',
      });
      
      // First try ref, then SecureStore
      let cv = verifierRef.current;
      if (!cv) {
        console.log('[SpotifyAuth] Verifier not in ref, checking SecureStore...');
        cv = await SecureStore.getItemAsync(CV_KEY);
        console.log('[SpotifyAuth] SecureStore CV:', cv ? 'found' : 'not found');
      }
      
      if (!cv) {
        console.error('No code verifier found');
        return;
      }

      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: cv,
      }).toString();

      try {
        const r = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });
        const json = await r.json();
        if (!r.ok) {
          console.error('[SpotifyAuth] Token endpoint error status:', r.status, json);
        }
        if (json.access_token) {
          console.log('Token received successfully');
          setToken(json.access_token);
          if (storageKey) {
            console.log('Storing access token with key:', storageKey);
            await SecureStore.setItemAsync(storageKey, json.access_token);
          }
        } else {
          console.error('Failed to get access token', json);
        }

        //store refresh token and send to backend
        if (json.refresh_token) {
          if (refreshStorageKey) {
            console.log(
              'Storing refresh token with key:',
              refreshStorageKey
            );
            await SecureStore.setItemAsync(
              refreshStorageKey,
              json.refresh_token
            );
          }

          // send refresh token to your backend /api/link_spotify
          if (authToken) {
            try {
              const res = await fetch(
                `${API_BASE_URL}/api/link_spotify`,
                {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                  },
                  body: JSON.stringify({
                    spotify_refresh_token: json.refresh_token,
                  }),
                }
              );
              if (!res.ok) {
                const errJson = await res.json().catch(() => null);
                console.error(
                  '[SpotifyAuth] Failed to link Spotify on backend:',
                  res.status,
                  errJson
                );
              } else {
                console.log(
                  '[SpotifyAuth] Spotify refresh token sent to backend successfully'
                );
              }
            } catch (e) {
              console.error(
                '[SpotifyAuth] Error calling /api/link_spotify',
                e
              );
            }
          } else {
            console.warn(
              '[SpotifyAuth] No auth token available; cannot call /api/link_spotify'
            );
          }
        }
      } catch (e) {
        console.error('Token exchange failed', e);
      } finally {
        await SecureStore.deleteItemAsync(CV_KEY);
        await SecureStore.deleteItemAsync(STATE_KEY);
        verifierRef.current = null;
        stateRef.current = null;
      }
    },
    [storageKey, refreshStorageKey, authToken]
  );

  // Handle response
  useEffect(() => {
    if (response) {
      console.log(
        '[SpotifyAuth] Received response:',
        JSON.stringify(response)
      );
    }
    if (response?.type === 'success') {
      const { code, state } = response.params;
      exchangeCodeForToken(code, state);
    } else if (response?.type === 'error') {
      console.error('Spotify auth error:', response.error);
    }
  }, [exchangeCodeForToken, response]);

  const refreshToken = useCallback(async () => {
    if (!refreshStorageKey) {
        console.warn('[SpotifyAuth] No refresh storage key available');
        return null;
    }
    try {
      const refresh_token = await SecureStore.getItemAsync(refreshStorageKey);
      if (!refresh_token) {
        console.warn('[SpotifyAuth] No refresh token available');
        return null;
      }

      console.log('[SpotifyAuth] Refreshing token...');
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token,
        client_id: CLIENT_ID,
      }).toString();

      const r = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      
      const json = await r.json();
      if (!r.ok) {
        console.error('[SpotifyAuth] Refresh token error:', r.status, json);
        // If the refresh token is invalid/revoked, clear the session so the user can re-login
        if (json.error === 'invalid_grant') {
            console.log('[SpotifyAuth] Refresh token revoked or invalid. Clearing session.');
            setToken(null);
            if (storageKey) await SecureStore.deleteItemAsync(storageKey);
            if (refreshStorageKey) await SecureStore.deleteItemAsync(refreshStorageKey);
        }
        return null;
      }

      if (json.access_token) {
        console.log('[SpotifyAuth] Token refreshed successfully');
        setToken(json.access_token);
        if (storageKey) {
          await SecureStore.setItemAsync(storageKey, json.access_token);
        }
        // If we get a new refresh token, update it too
        if (json.refresh_token && refreshStorageKey) {
             await SecureStore.setItemAsync(refreshStorageKey, json.refresh_token);
        }
        return json.access_token;
      }
    } catch (e) {
      console.error('[SpotifyAuth] Token refresh failed', e);
    }
    return null;
  }, [refreshStorageKey, storageKey]);

  const disconnect = useCallback(async () => {
    console.log('[SpotifyAuth] Disconnecting Spotify...', { hasAuthToken: !!authToken, authToken: authToken?.substring(0, 20) });
    
    // Notify backend to clear Spotify data FIRST before clearing local state
    if (authToken) {
      try {
        console.log('[SpotifyAuth] Calling backend disconnect endpoint:', `${API_BASE_URL}/api/disconnect_spotify`);
        const response = await fetch(`${API_BASE_URL}/api/disconnect_spotify`, {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
        });
        const responseText = await response.text();
        console.log('[SpotifyAuth] Backend disconnect response:', response.status, responseText);
        if (response.ok) {
          console.log('[SpotifyAuth] Backend notified of disconnect successfully');
        } else {
          console.warn('[SpotifyAuth] Backend disconnect failed:', response.status, responseText);
          Alert.alert('Disconnect Warning', `Backend returned ${response.status}: ${responseText}`);
        }
      } catch (e: any) {
        console.error('[SpotifyAuth] Failed to notify backend of disconnect:', e);
        Alert.alert('Disconnect Error', `Failed to call backend: ${e.message}`);
      }
    } else {
      console.warn('[SpotifyAuth] No authToken available, skipping backend disconnect call');
      Alert.alert('Disconnect Warning', 'No auth token available - backend will not be notified');
    }
    
    // Clear local state after backend call
    setToken(null);
    
    // Clear local storage
    if (storageKey) {
      await SecureStore.deleteItemAsync(storageKey);
    }
    if (refreshStorageKey) {
      await SecureStore.deleteItemAsync(refreshStorageKey);
    }
    
    // Also clear the verifier and state
    try {
      await SecureStore.deleteItemAsync(CV_KEY);
      await SecureStore.deleteItemAsync(STATE_KEY);
    } catch (e) {
      // Ignore errors clearing these
    }
    
    console.log('[SpotifyAuth] Spotify disconnected successfully');
  }, [storageKey, refreshStorageKey, authToken]);

  const promptAsync = useCallback(
    async (options?: AuthSession.AuthRequestPromptOptions) => {
      // Ensure the code verifier is saved before prompting
      // This fixes the issue where verifier is lost on reconnect
      if (request?.codeVerifier) {
        console.log('[SpotifyAuth] Pre-prompt: Ensuring code verifier is saved');
        await SecureStore.setItemAsync(CV_KEY, request.codeVerifier);
        verifierRef.current = request.codeVerifier;
      }
      if (request?.state) {
        console.log('[SpotifyAuth] Pre-prompt: Ensuring state is saved');
        await SecureStore.setItemAsync(STATE_KEY, request.state);
        stateRef.current = request.state;
      }

      const promptOptions = {
        useProxy: USE_PROXY,
        ...(options ?? {}),
      } as AuthSession.AuthRequestPromptOptions;
      console.log('[SpotifyAuth] Starting prompt', {
        ...promptOptions,
        redirectUri: REDIRECT_URI,
      });
      return promptAsyncInternal(promptOptions);
    },
    [promptAsyncInternal, request]
  );

  return {
    token,
    promptAsync,
    request,
    disconnect,
    refreshToken,
    isLoaded,
  };
}

export function SpotifyAuthProvider({ children }: { children: React.ReactNode }) {
  const value = useProvideSpotifyAuth();
  return (
    <SpotifyAuthContext.Provider value={value}>
      {children}
    </SpotifyAuthContext.Provider>
  );
}

export function useSpotifyAuth() {
  const context = useContext(SpotifyAuthContext);
  if (!context) {
    throw new Error('useSpotifyAuth must be used within a SpotifyAuthProvider');
  }
  return context;
}
