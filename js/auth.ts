import { CLIENT_ID } from './config.js';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
let tokenClient: google.accounts.oauth2.TokenClient;

export function initGoogleAuth(callback: (resp: google.accounts.oauth2.TokenResponse) => void) {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    prompt: '',
    callback: callback, // A function to call after the token is received
  });
}

export function signIn() {
  // Prompt the user to select a Google Account and grant access
  tokenClient.requestAccessToken();
}
