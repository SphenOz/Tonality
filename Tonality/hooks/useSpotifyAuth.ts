import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = '849539bc6c644d22a1e1f0ae019aa95d';
const CV_KEY = "spotify_pkce_cv";
const STATE_KEY = "spotify_oauth_state";
const TOKEN_KEY = "spotify_access_token";

// Use Expo's helper so this works across devices and dev/prod without
// hard-coding a single redirect URL.
const REDIRECT_URI = AuthSession.makeRedirectUri({
    scheme: 'tonality',
});

const discovery = {
    authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

export function useSpotifyAuth() {
    const [token, setToken] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    const [request, response, promptAsync] = AuthSession.useAuthRequest(
        {
            clientId: CLIENT_ID,
            usePKCE: true,
            responseType: AuthSession.ResponseType.Code,
            scopes: ['user-read-email', 'user-library-read', 'user-top-read'],
            redirectUri: REDIRECT_URI,
        },
        discovery
    );

    // Load token from storage on mount
    useEffect(() => {
        SecureStore.getItemAsync(TOKEN_KEY).then(storedToken => {
            if (storedToken) setToken(storedToken);
            setIsLoaded(true);
        });
    }, []);

    // Save verifier/state
    useEffect(() => {
        if (request?.codeVerifier) SecureStore.setItemAsync(CV_KEY, request.codeVerifier);
        if (request?.state) SecureStore.setItemAsync(STATE_KEY, request.state);
    }, [request]);

    // Handle response
    useEffect(() => {
        if (response?.type === 'success') {
            const { code, state } = response.params;
            exchangeCodeForToken(code, state);
        }
    }, [response]);


    const exchangeCodeForToken = async (code: string, returnedState: string) => {
        console.log("Exchanging code for token...");
        const expectedState = await SecureStore.getItemAsync(STATE_KEY);
        if (expectedState && returnedState && returnedState !== expectedState) {
            console.error("State mismatch during auth");
            return;
        }

        const cv = await SecureStore.getItemAsync(CV_KEY);
        if (!cv) {
            console.error("No code verifier found");
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
            if (json.access_token) {
                console.log("Token received successfully");
                setToken(json.access_token);
                SecureStore.setItemAsync(TOKEN_KEY, json.access_token);
            } else {
                console.error("Failed to get token", json);
            }
        } catch (e) {
            console.error("Token exchange failed", e);
        }
    };

    const logout = async () => {
        setToken(null);
        await SecureStore.deleteItemAsync(TOKEN_KEY);
    };

    return { token, promptAsync, request, logout, isLoaded };
}
