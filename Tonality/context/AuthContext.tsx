import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../utils/runtimeConfig';

const TONALITY_TOKEN_KEY = "TONALITY_TOKEN";
const TONALITY_USER_KEY = "TONALITY_USERNAME";

interface TonalityUser {
    username: string;
}

interface AuthContextType {
    user: TonalityUser | null;
    token: string | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (username: string, password: string, signup: boolean) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<TonalityUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = useCallback(async () => {
        setLoading(true);
        try {
            const storedToken = await SecureStore.getItemAsync(TONALITY_TOKEN_KEY);
            const storedusername = await SecureStore.getItemAsync(TONALITY_USER_KEY);
            console.log("AuthContext: checkAuth", { storedToken, storedusername });
            if (storedToken && storedusername) {
                setToken(storedToken);
                setUser({ username: storedusername });
            } else {
                setToken(null);
                setUser(null);
            }
        } catch (e) {
            console.error("AuthContext: checkAuth failed", e);
            setToken(null);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const login = useCallback(
        async (username: string, password: string, signup: boolean) => {
            if (!username || !password) throw new Error("username and password are required");

            console.log("AuthContext: login called", { username, signup });

            const path = signup ? "/api/register" : "/api/login";

            const urlpath = `${API_BASE_URL}${path}`;
            console.log("AuthContext: login URL", urlpath);

            const response = await fetch(`${urlpath}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                let message = signup ? "Signup failed" : "Login failed";
                try {
                    const errorData = await response.json();
                    if (errorData?.detail) {
                    message = errorData.detail;
                    }
                } catch {
                    // ignore parse error, keep default message
                }
                throw new Error(message);
            }

            const data = await response.json();
            const token = data.access_token as string | undefined;

            if (!token) {
            throw new Error("No access token returned from server");
            }

            // Update state
            setUser({ username });
            setToken(token);
            console.log("AuthContext: login successful", { username });
            console.log(token);


            await SecureStore.setItemAsync(TONALITY_TOKEN_KEY, token);
            await SecureStore.setItemAsync(TONALITY_USER_KEY, username);
        },
        []
    );

    const logout = useCallback(async () => {
        console.log("AuthContext: logout called");
        // Update state immediately
        setUser(null);
        setToken(null);

        try {
            await SecureStore.deleteItemAsync(TONALITY_TOKEN_KEY);
            await SecureStore.deleteItemAsync(TONALITY_USER_KEY);
            console.log("AuthContext: SecureStore cleared");
        } catch (e) {
            console.error("AuthContext: logout failed", e);
        } finally {
            await checkAuth();
        }
    }, [checkAuth]);

    return (
        <AuthContext.Provider value={{
            user,
            token,
            loading,
            isAuthenticated: Boolean(token && user),
            login,
            logout,
            checkAuth
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useTonalityAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useTonalityAuth must be used within an AuthProvider');
    }
    return context;
}
