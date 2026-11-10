// Backend shared with the web app. Change for a local server, e.g.
// 'http://10.0.2.2:8080' (Android emulator) or 'http://localhost:8080' (iOS simulator).
export const API_URL = 'https://nebeng-api.onrender.com';
export const WEB_URL = 'https://nebeng-mocha.vercel.app';

// Android needs a Google Maps key (com.google.android.geo.API_KEY in
// AndroidManifest.xml) before a map can be shown. setup.sh flips this when a
// key is given. iOS uses Apple Maps and needs no key.
export const ANDROID_MAPS = false;

// Must match TermsVersion in the backend (trust.go) and the web app.
export const TERMS_VERSION = '2026-11-10.2';
