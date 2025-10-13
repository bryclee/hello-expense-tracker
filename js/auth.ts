import { CLIENT_ID } from './config.js';

const SCOPES = 'openid email https://www.googleapis.com/auth/spreadsheets';
let tokenClient: google.accounts.oauth2.TokenClient;

export function initGoogleAuth(callback: (resp: google.accounts.oauth2.TokenResponse) => void, login_hint?: string) {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    prompt: '',
    login_hint: login_hint,
    callback: callback, // A function to call after the token is received
  });
}

export function signIn() {
  // Prompt the user to select a Google Account and grant access
  tokenClient.requestAccessToken();
}

export async function getUserInfo(accessToken: string): Promise<{ email: string }> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.statusText}`);
  }
  const userInfo = await response.json();
  return { email: userInfo.email };
}
