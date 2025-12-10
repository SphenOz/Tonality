# Tonality 🎵

Tonality is a mobile music sharing prototype built with React Native and Expo. It integrates with the Spotify Web API to:

- Let users **connect their Spotify account**
- Show a personalized **Song of the Day** based on their recent listening
- Provide **Weekly Polls** where users can vote on tracks (currently backed by a mock in-memory backend)

This project is intended as a semester project prototype and a foundation for a fuller social music app.

---

## Features implemented for the prototype

- **Spotify Authentication** using `expo-auth-session` and PKCE
   - Connect/disconnect from Spotify
   - Fetch basic profile information (display name)
- **Home tab** (`app/(tabs)/index.tsx`)
   - Shows app title and tagline
   - "Connect with Spotify" call-to-action when logged out
   - Displays "Connected as &lt;Spotify name&gt;" when logged in
   - Quick navigation cards for **Song of the Day** and **Weekly Polls**
   - A small, **mocked friend activity feed** to illustrate the social concept
- **Song of the Day tab** (`app/(tabs)/song-of-day.tsx`)
   - When logged out: explains the feature and shows a "Connect with Spotify" button
   - When logged in: fetches your top tracks from Spotify and picks a random one as your Song of the Day
   - Shows album art, track title, artists, album name
   - "Play on Spotify" button opens the track in the Spotify app / web
- **Weekly Polls tab** (`app/(tabs)/polls.tsx`)
   - Uses a **mock backend** (`api/mockBackend.ts`) with in-memory poll data
   - Users can vote for a song; vote counts and percentages update immediately
   - Highlights your selected song and shows total votes
   - Header includes small badges (e.g., "Closes in 3 days", "Community pick") for context

Backend behavior for polls and friend activity is currently mocked in-memory. In the full project this will be replaced by a **FastAPI** backend with a **MySQL** database.

---

## Tech stack

- **Frameworks**
   - React Native (via Expo)
   - Expo Router for file-based navigation and tabs
- **Auth & APIs**
   - `expo-auth-session` for Spotify OAuth with PKCE
   - Spotify Web API (`/me`, `/me/top/tracks`)
- **Storage**
   - `expo-secure-store` for storing the Spotify access token on device
- **UI**
   - `react-native` core components
   - `@expo/vector-icons` (Ionicons)

Planned backend technologies (not yet implemented in this repo):

- **FastAPI** for the REST backend
- **MySQL** for persistent storage of users, polls, votes, and activity

---

## Getting started

1. Install dependencies

    ```bash
    npm install
    ```

2. Start the app (development server)

    ```bash
    npm run start
    ```

3. Open the app using one of:

- A development build
- Android emulator
- iOS simulator
- Expo Go

> This project uses Expo Router, so screens live under the `app/` directory.

---

### Spotify developer settings

To prevent `INVALID_CLIENT: Invalid redirect URL` from Spotify, make sure both of the following callback URLs are added to your app configuration at <https://developer.spotify.com/dashboard/>:

- `https://auth.expo.io/@spheno/Tonality` *(required while running in Expo Go / dev client)*
- `tonality://spotify-auth` *(used by standalone builds and the production scheme defined in `app.json`)*

After saving the changes, re-run the Expo dev server so the new redirect URIs take effect.



## Future work

- Implement a real FastAPI backend and connect the app to it
- Persist polls, votes, and user relationships in MySQL
- Build a real social feed of shared songs and votes
- Add user profiles and the ability to follow friends

---

## Scripts

Useful `package.json` scripts:

- `npm run start` – start the Expo dev server
- `npm run android` – run the app on Android
- `npm run ios` – run the app on iOS
- `npm run web` – run the app in a web browser
- `npm run lint` – run ESLint via Expo's config
