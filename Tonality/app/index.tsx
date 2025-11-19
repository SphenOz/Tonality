import { Redirect, router } from 'expo-router';
import React, { useEffect, useState } from "react";
import { Text, View, StyleSheet, ActivityIndicator, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { useTonalityAuth } from '../hooks/useTonalityAuth';
import { Ionicons } from '@expo/vector-icons';

export default function Index() {
  const { token, promptAsync, request, isLoaded: spotifyLoaded } = useSpotifyAuth();
  const { login: tonalityLogin, isAuthenticated, loading: tonalityLoading } = useTonalityAuth();

  // Auth Flow State
  // 0: Welcome
  // 1: Tonality Login/Signup
  // 2: Spotify Connect (if Tonality auth done)
  const [step, setStep] = useState(0);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Note: Global redirection is now handled in app/_layout.tsx
  // We only need to handle local step advancement if needed
  // Note: Global redirection is now handled in app/_layout.tsx
  // We only need to handle local step advancement if needed
  useEffect(() => {
    if (isAuthenticated && !spotifyLoaded) {
      // Waiting for spotify load
    } else if (isAuthenticated && spotifyLoaded && !token) {
      // User is logged in to Tonality but needs to connect Spotify
      setStep(2);
    }
  }, [isAuthenticated, spotifyLoaded, token]);

  // Navigate to main tabs after authentication
  const handleEnterApp = () => {
    router.replace('/(tabs)');
  };

  // Handle Tonality Auth (Mock)
  const handleTonalityAuth = async () => {
    if (email && password) {
      try {
        await tonalityLogin(email, password);
        setStep(2);
      } catch (e) {
        alert("Login failed");
      }
    } else {
      alert("Please enter email and password");
    }
  };

  const renderWelcome = () => (
    <View style={styles.welcomeContainer}>
      <Text style={styles.welcomeTitle}>Welcome to Tonality</Text>
      <Text style={styles.welcomeSubtitle}>Your music sharing journey starts here.</Text>
      <Pressable style={styles.primaryButton} onPress={() => setStep(1)}>
        <Ionicons name="arrow-forward" size={20} color="white" />
        <Text style={styles.primaryButtonText}>Get Started</Text>
      </Pressable>
    </View>
  );

  const renderTonalityAuth = () => (
    <View style={styles.authBox}>
      <Text style={styles.authTitle}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>
      <Text style={styles.authSubtitle}>{isSignUp ? 'Sign up to start sharing' : 'Log in to continue'}</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#B3B3B3"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#B3B3B3"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable style={styles.primaryButton} onPress={handleTonalityAuth}>
        <Text style={styles.primaryButtonText}>{isSignUp ? 'Sign Up' : 'Log In'}</Text>
      </Pressable>

      <Pressable style={styles.switchAuthButton} onPress={() => setIsSignUp(!isSignUp)}>
        <Text style={styles.switchAuthText}>
          {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
        </Text>
      </Pressable>
    </View>
  );

  const renderSpotifyConnect = () => (
    <View style={styles.authBox}>
      <Text style={styles.authTitle}>Connect Music</Text>
      <Text style={styles.authSubtitle}>Link your Spotify account to share tracks</Text>

      {!token ? (
        !request ? (
          <ActivityIndicator size="large" color="#a8C3A0" style={{ marginTop: 20 }} />
        ) : (
          <Pressable style={styles.spotifyButton} onPress={() => promptAsync()}>
            <Ionicons name="musical-notes" size={20} color="white" />
            <Text style={styles.spotifyButtonText}>Connect Spotify</Text>
          </Pressable>
        )
      ) : (
        <View style={styles.connectedContainer}>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark-circle" size={24} color="#1DB954" />
            <Text style={styles.successText}>Spotify Connected!</Text>
          </View>
          <Pressable style={styles.enterButton} onPress={handleEnterApp}>
            <Text style={styles.enterButtonText}>Enter App</Text>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
        <View style={styles.header}>
          <Text style={styles.title}>Tonality</Text>
        </View>

        <View style={styles.content}>
          {step === 0 && renderWelcome()}
          {step === 1 && renderTonalityAuth()}
          {step === 2 && renderSpotifyConnect()}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', // Dark mode background
  },
  keyboardView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    position: 'absolute',
    top: 80,
    alignItems: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#1DB954', // Spotify Green
    letterSpacing: 1,
  },
  content: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: '#B3B3B3',
    marginBottom: 40,
    textAlign: 'center',
    lineHeight: 24,
  },
  authBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#282828',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 14,
    color: '#B3B3B3',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    backgroundColor: '#404040',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#404040',
  },
  primaryButton: {
    backgroundColor: '#1DB954',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 32,
    marginTop: 16,
    width: '100%',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  switchAuthButton: {
    marginTop: 24,
    padding: 8,
  },
  switchAuthText: {
    color: '#B3B3B3',
    fontSize: 14,
    fontWeight: '500',
  },
  spotifyButton: {
    backgroundColor: '#1DB954',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 32,
    width: '100%',
    justifyContent: 'center',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  spotifyButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 12,
  },
  connectedContainer: {
    alignItems: 'center',
    width: '100%',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.3)',
  },
  successText: {
    marginLeft: 8,
    color: '#1DB954',
    fontWeight: '600',
    fontSize: 16,
  },
  enterButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 32,
    width: '100%',
  },
  enterButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
});