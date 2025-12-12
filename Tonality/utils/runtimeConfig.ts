import Constants from 'expo-constants';

// Get the Expo dev server host and use it to build the backend URL
const getApiBaseUrl = (): string => {
  // First check for explicit env override
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  
  // In development, derive from Expo's dev server host
  const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (expoHost) {
    return `http://${expoHost}:8000`;
  }
  
  // Fallback for web or production
  return 'http://localhost:8000';
};

export const API_BASE_URL = getApiBaseUrl();

export const SPOTIFY_CLIENT_ID =
  process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? 'YOUR_SPOTIFY_CLIENT_ID';
