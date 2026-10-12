# Local Store Stories phone app

The phone app (Expo, iPhone and Android), built screen by screen from the
design handoff in `docs/design_handoff_pas_redesign/`, like the website. It
uses the same Firebase project as the website (pas-prod-c8190), so both show
the same posts.

## Try it in Expo Go

1. Install **Expo Go** from the App Store or Play Store.
2. On the computer, in this folder: `npm install`, then `npx expo start`.
3. Scan the QR code: with the iPhone Camera app, or inside Expo Go on Android.
   Phone and computer must be on the same Wi-Fi (or run `npx expo start --tunnel`).

## Signing in

Google sign-in can't open inside Expo Go. The sign-in screen has a test
login (an email and password made in Firebase > Authentication > Users,
with the Email/Password provider switched on) and **Continue as guest**,
which only looks around: Add Place and Me ask to sign in.

## Checks

`npm run typecheck`
