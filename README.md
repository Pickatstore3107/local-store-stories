# Local Stores & Their Stories

A people-first campaign by Pick at Store: share a memory of a neighbourhood
store, pin it to the map of India, and pass the memory on.

Product and build plan: https://claude.ai/code/artifact/d75832d4-2701-4e44-9837-514ab263cf98

## Stack

- Next.js (App Router, TypeScript, Tailwind CSS), deployed on Vercel while we build
- Firebase: Authentication (Google) and Cloud Firestore, on the free Spark plan
- Cloudinary (free plan) for story photos, private until approved, through `src/app/api/photos`
- Firebase projects: `pas-dev-7786f` (dev, default) and `pas-prod-c8190` (prod)

## Run it locally

Requires Node 22+ and Java 21+ (for the Firebase emulators).

```bash
npm install
cp .env.example .env.local   # fill in the dev web app config
npm run dev                  # http://localhost:3000
```

To work fully offline against local Firebase, set
`NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` in `.env.local` and run
`npm run emulators` in a second terminal (UI at http://localhost:4000).

## Checks

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, with Next.js route types |
| `npm run test:rules` | Firestore and Storage security rules tests on the emulators |
| `npm run build` | Production build |

All four run in GitHub Actions on every pull request.

## Moderators

Every story waits for a moderator at `/moderate` before anyone else can see it.
The app can't make anyone a moderator; that is done by hand in the Firebase
console:

1. The new moderator signs in, opens `/moderate` and copies the code it shows.
2. In the Firebase console, open **Firestore Database**, then the `moderators`
   collection (choose **Start collection** the first time).
3. Add a document whose **Document ID** is that code, with one string field
   `name` holding their name.

Every decision is written to `moderationLog`, which nobody can edit or delete.

## Security rules

`firestore.rules` and `storage.rules` deny everything by default (Firebase
Storage is not used). Each build
step opens only what its screens need, and adds tests under `tests/rules`
proving the rest stays closed. Deploy rules with:

```bash
npx firebase deploy --only firestore:rules,storage --project dev
```
