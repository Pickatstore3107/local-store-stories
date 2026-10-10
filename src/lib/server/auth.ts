import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";
import { checkPostLimit, readPostLimit } from "@/lib/post-limits";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

// Local development against the Firebase emulators, whose sign-in tokens are
// unsigned. Never true in a production build.
const useEmulators =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

// Google's public keys for Firebase sign-in tokens.
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Checks the Firebase sign-in token sent by the browser and returns who it belongs to. */
export async function verifyUser(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token || !projectId) throw new HttpError(401, "Please sign in again.");

  let uid: string | undefined;
  try {
    const payload = useEmulators
      ? decodeJwt(token)
      : (
          await jwtVerify(token, googleKeys, {
            issuer: `https://securetoken.google.com/${projectId}`,
            audience: projectId,
          })
        ).payload;
    if (payload.aud !== projectId) throw new Error("Wrong project");
    uid = payload.sub;
  } catch {
    throw new HttpError(401, "Please sign in again.");
  }
  if (!uid) throw new HttpError(401, "Please sign in again.");
  return { uid, token };
}

/**
 * Whether one of the person's own documents exists. Reads it with their own
 * token, so the Firestore security rules decide.
 */
async function ownDocExists(collection: string, uid: string, token: string) {
  const host = useEmulators ? "http://127.0.0.1:8080" : "https://firestore.googleapis.com";
  const response = await fetch(
    `${host}/v1/projects/${projectId}/databases/(default)/documents/${collection}/${uid}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (response.status === 404) return false;
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(401, "Please sign in again.");
  }
  if (!response.ok) throw new HttpError(502, "We couldn't check your account. Please try again.");
  return true;
}

/** Only people who have given consent may upload. */
export async function requireConsent(uid: string, token: string) {
  if (!(await ownDocExists("usersPrivate", uid, token))) {
    throw new HttpError(403, "Please finish setting up your account first.");
  }
}

/**
 * Refuses a photo for a new memory when the person has shared too many too
 * quickly (src/lib/post-limits.ts), so bots can't fill the photo store.
 * Rules from before the limit was added refuse the read; then nothing is checked.
 */
export async function requirePostAllowed(uid: string, token: string) {
  const host = useEmulators ? "http://127.0.0.1:8080" : "https://firestore.googleapis.com";
  const response = await fetch(
    `${host}/v1/projects/${projectId}/databases/(default)/documents/postLimits/${uid}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (response.status === 404 || response.status === 403) return;
  if (!response.ok) throw new HttpError(502, "We couldn't check your account. Please try again.");
  const { fields = {} } = (await response.json()) as {
    fields?: Record<string, { timestampValue?: string; integerValue?: string }>;
  };
  const limit = readPostLimit({
    lastAt: fields.lastAt?.timestampValue && Date.parse(fields.lastAt.timestampValue),
    windowStart: fields.windowStart?.timestampValue && Date.parse(fields.windowStart.timestampValue),
    count: fields.count?.integerValue && Number(fields.count.integerValue),
  });
  const check = checkPostLimit(limit, Date.now());
  if (!check.ok) throw new HttpError(429, check.message);
}

/**
 * A photo can only be uploaded for a memory that hasn't been saved yet.
 * Otherwise someone could swap the photo of a memory a moderator already
 * approved. The memory's ID is checked before this is called.
 */
export async function requireUnsavedStory(storyId: string, token: string) {
  const host = useEmulators ? "http://127.0.0.1:8080" : "https://firestore.googleapis.com";
  const response = await fetch(
    `${host}/v1/projects/${projectId}/databases/(default)/documents/stories/${storyId}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  // Missing, or someone else's memory that isn't public: either way, not one
  // of the person's own saved memories.
  if (response.status === 404 || response.status === 403) return;
  if (!response.ok) throw new HttpError(502, "We couldn't check the post. Please try again.");
  throw new HttpError(409, "This post already has its photo. To change it, share the post again.");
}

/** Only moderators, listed in moderators/{uid}, may see photos waiting for review. */
export async function requireModerator(uid: string, token: string) {
  if (!(await ownDocExists("moderators", uid, token))) {
    throw new HttpError(403, "Only moderators can do that.");
  }
}

/** Turns an error into a JSON response the browser can show. */
export function errorResponse(
  error: unknown,
  fallback = "Something went wrong with the photo. Please try again.",
) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: fallback }, { status: 500 });
}
