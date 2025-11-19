import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

const TONALITY_TOKEN_KEY = 'tonality_auth_token';
const TONALITY_USER_KEY = 'tonality_user_email';

interface TonalityUser {
    email: string;
}

interface AuthContextType {
    user: TonalityUser | null;
    token: string | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
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
            const storedEmail = await SecureStore.getItemAsync(TONALITY_USER_KEY);
            console.log("AuthContext: checkAuth", { storedToken, storedEmail });
            if (storedToken && storedEmail) {
                setToken(storedToken);
                setUser({ email: storedEmail });
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

    const login = useCallback(async (email: string, password: string) => {
        if (!email || !password) throw new Error('Email and password are required');

        const fakeToken = `mock-tonality-token-${Date.now()}`;

        // Update state immediately
        setUser({ email });
        setToken(fakeToken);

        await SecureStore.setItemAsync(TONALITY_TOKEN_KEY, fakeToken);
        await SecureStore.setItemAsync(TONALITY_USER_KEY, email);
    }, []);

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
        }
    }, []);

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
