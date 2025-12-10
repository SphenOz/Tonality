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
import { useTonalityAuth } from '../context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = 'dada8bee46da49d68928a05c68828cc4';
const CV_KEY = 'spotify_pkce_cv';
const STATE_KEY = 'spotify_oauth_state';
const TOKEN_KEY = 'spotify_access_token';
const REDIRECT_PATH = 'profile';
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';
const REDIRECT_URI = AuthSession.makeRedirectUri({ path: REDIRECT_PATH });
const USE_PROXY = IS_EXPO_GO;

// ⭐ backend base URL (adjust to your env)
const API_BASE_URL = 'http://10.250.196.103:8000';

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
}

const SpotifyAuthContext =
  createContext<SpotifyAuthContextValue | undefined>(undefined);

function useProvideSpotifyAuth(): SpotifyAuthContextValue {
  const [token, setToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // ⭐ assume AuthContext exposes an auth token
  const { user, token: authToken } = useTonalityAuth();

  const stateRef = useRef<string | null>(null);
  const verifierRef = useRef<string | null>(null);

  const storageKey = useMemo(() => {
    return user?.username ? `${TOKEN_KEY}_${user.username}` : null;
  }, [user?.username]);

  // ⭐ separate key for the Spotify refresh token
  const refreshStorageKey = useMemo(() => {
    return storageKey ? `${storageKey}_refresh` : null;
  }, [storageKey]);

  const [request, response, promptAsyncInternal] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      usePKCE: true,
      responseType: AuthSession.ResponseType.Code,
      scopes: ['user-read-email', 'user-library-read', 'user-top-read'],
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
      SecureStore.setItemAsync(CV_KEY, request.codeVerifier);
      verifierRef.current = request.codeVerifier;
    }
    if (request?.state) {
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
      const expectedState =
        stateRef.current ?? (await SecureStore.getItemAsync(STATE_KEY));
      if (expectedState && returnedState && returnedState !== expectedState) {
        console.error('State mismatch during auth', {
          expectedState,
          returnedState,
        });
        return;
      }

      const cv =
        verifierRef.current ?? (await SecureStore.getItemAsync(CV_KEY));
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

        // ⭐ NEW: store refresh token and send to backend
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

          // ⭐ send refresh token to your backend /api/link_spotify
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

  const disconnect = useCallback(async () => {
    setToken(null);
    if (storageKey) {
      await SecureStore.deleteItemAsync(storageKey);
    }
    if (refreshStorageKey) {
      // ⭐ also clear the stored refresh token
      await SecureStore.deleteItemAsync(refreshStorageKey);
    }
  }, [storageKey, refreshStorageKey]);

  const promptAsync = useCallback(
    (options?: AuthSession.AuthRequestPromptOptions) => {
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
    [promptAsyncInternal]
  );

  return {
    token,
    promptAsync,
    request,
    disconnect,
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
