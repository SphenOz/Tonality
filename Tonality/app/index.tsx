import { Button } from "@react-navigation/elements";
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

WebBrowser.maybeCompleteAuthSession();

export default function Index() {

  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

const REDIRECT_URI = "https://sphenoz.github.io/callback"; //Redirect Page, do not change.
const CLIENT_ID = "dada8bee46da49d68928a05c68828cc4"; //Client ID from my Spotify Dev App
const CV_KEY = "spotify_pkce_cv"; //Storage location of the code verifier (Randomly generated string)
const STATE_KEY = "spotify_oauth_state"; //Security state key

//Destructed array from useAuthRequest
const [request, , promptAsync] = AuthSession.useAuthRequest(
  { clientId: CLIENT_ID, usePKCE: true, responseType: AuthSession.ResponseType.Code,
    scopes: ['user-read-email','playlist-modify-public','playlist-modify-private','user-library-read'],
    redirectUri: REDIRECT_URI, state: Math.random().toString(36).slice(2) },
  { authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token' }
);

// save verifier/state before opening browser (survives cold start)
useEffect(() => {
  if (request?.codeVerifier) SecureStore.setItemAsync(CV_KEY, request.codeVerifier);
  if (request?.state) SecureStore.setItemAsync(STATE_KEY, request.state);
}, [request]);

useEffect(() => {
  const onUrl = async ({ url }: { url: string }) => {
    const u = new URL(url);
    const code = u.searchParams.get('code');
    const returnedState = u.searchParams.get('state');
    if (!code) return;

    const expectedState = await SecureStore.getItemAsync(STATE_KEY);
    if (expectedState && returnedState && returnedState !== expectedState) return;

    const cv = await SecureStore.getItemAsync(CV_KEY);
    if (!cv) return;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code, redirect_uri: REDIRECT_URI, client_id: CLIENT_ID, code_verifier: cv
    }).toString();

    console.log("Body:", body);

    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
    });
    const json = await r.json();
    console.log(json);
    setToken(json.access_token);
  };

  const sub = Linking.addEventListener('url', onUrl);
  Linking.getInitialURL().then((u) => {
  if (u) {
    return onUrl({ url: u }); // returns Promise<void> or void
  }
});
  return () => sub.remove();
}, []);
  
async function fetchProfile(): Promise<any> {
    const result = await fetch("https://api.spotify.com/v1/me", {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });

    const profile = await result.json();
    console.log(profile);
    setProfile(profile);
    return profile;
}

  return (
    <SafeAreaView
      style={{flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#DDEEE0ff",}}>
      {/*header*/}
      <View 
        style={{flex: .5, alignItems: "center", justifyContent: "flex-start"}}> 
        <Text
          style={{fontSize: 24, marginTop: 50, color: "#3E3E3Eff"}}>
            Welcome to Tonality
            {profile ? `, ${profile.display_name}` : ""}
        </Text>
      </View>
      <View style={{ flex: 3, alignItems: "center", justifyContent: "flex-start" }}>
        <View
          style={styles["login-box"]}>
            <Text
              style={{fontSize: 24, marginTop: 10, marginBottom: 20, color: "#3E3E3Eff", alignSelf: "center"}}>
                Login
            </Text>
            <Button style={{marginTop: 50, backgroundColor: "#a8C3A0ff"}} onPress={() => promptAsync()}> Login with Spotify </Button>
            {/*Utilize Spotify API*/}
            <Button style={{marginTop: 50, backgroundColor: "#a8C3A0ff"}} onPress={() => fetchProfile()}> Get My Profile </Button>
        </View>
       </View>
    </SafeAreaView>
  );
}

const styles = {
  "login-box":
  {
    "marginTop": 40,
    "width": 300,
    "height": 450,
    "backgroundColor": "#CFE3CFFF",
    "borderRadius": 10,
    "padding": 15,
    "shadowColor": "#000000",
    "shadowOffset": { width: 0, height: 2 },
    "shadowOpacity": 0.25,
    "shadowRadius": 3.84,
    "elevation": 5,
  }
};