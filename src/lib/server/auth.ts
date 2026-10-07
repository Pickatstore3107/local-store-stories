import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";

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
 * Only people who have given consent may upload. Reads their consent record
 * with their own token, so the Firestore security rules decide.
 */
export async function requireConsent(uid: string, token: string) {
  const host = useEmulators ? "http://127.0.0.1:8080" : "https://firestore.googleapis.com";
  const response = await fetch(
    `${host}/v1/projects/${projectId}/databases/(default)/documents/usersPrivate/${uid}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (response.status === 404) {
    throw new HttpError(403, "Please finish setting up your account first.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(401, "Please sign in again.");
  }
  if (!response.ok) throw new HttpError(502, "We couldn't check your account. Please try again.");
}

/** Turns an error into a JSON response the browser can show. */
export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Something went wrong with the photo. Please try again." }, { status: 500 });
}
