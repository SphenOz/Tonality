import * as AuthSession from "expo-auth-session";

export async function loginWithSpotify() {
    const redirectUri = AuthSession.makeRedirectUri({
        scheme: "tonality" 
    });

    const authUrl = `https://accounts.spotify.com/authorize?client_id=${process.env.SPOTIFY_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user-read-private%20user-read-email`;
    // This is a filler link i believe we need to replace it with our own
    // This is just whatever link vscode filled in for me

    return AuthSession.startAsync({
        authUrl
    });
}