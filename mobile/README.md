# Numpang mobile (React Native CLI)

Android and iOS app for Numpang. Same backend and accounts as the web app
(`https://nebeng-api.onrender.com`, set in `src/config.js`).

This folder holds the app source (`App.js`, `src/`). The native projects
(`android/`, `ios/`) are generated on a Mac by `setup.sh`:

```bash
git clone https://github.com/fao30/nebeng.git && cd numpang
bash mobile/setup.sh ~/Desktop/NebengMobile            # add an Android Maps key as 2nd arg if you have one
cd ~/Desktop/NebengMobile
npx react-native run-ios          # Xcode + iOS Simulator
npx react-native run-android      # Android Studio emulator or a phone with USB debugging
```

After pulling new code, run `setup.sh` again; it re-copies `src/` and keeps the native folders.

What's in the app (MVP): sign in / sign up with Terms, KYC (face selfie, KTP/SIM,
selfie with ID; car front + STNK for car owners), search with radius and remembered routes,
trip details with map, booking at the owner's points, price negotiation, real-time chat,
boarding code, drop-off, ratings, reports, live location, notifications (in-app, live),
and for car owners: my trips, create trip, manage passengers. Admin stays on the web.

Notes
- iOS maps use Apple Maps (no key). Android maps need a Google Maps key restricted to the Android app.
- Place search uses OpenStreetMap Nominatim (free, rate-limited); swap for Google Places with an app key later.
- Push notifications (app closed) need Firebase + an Apple Developer account; not set up yet.
