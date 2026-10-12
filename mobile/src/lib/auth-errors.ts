import { FirebaseError } from "firebase/app";

const messages: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match.",
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/user-disabled": "This login has been switched off.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/operation-not-allowed": "Email login isn't switched on in Firebase yet.",
  "auth/network-request-failed": "No connection. Please check your internet and try again.",
  "permission-denied": "You don't have permission to do that.",
};

/**
 * A message people can act on. Unknown errors keep their code visible so
 * a screenshot is enough to diagnose them.
 */
export function friendlyError(error: unknown) {
  console.error(error);
  const code = error instanceof FirebaseError ? error.code : null;
  const message = code && messages[code];
  if (message) return `${message} (${code})`;
  return code
    ? `Something went wrong (${code}). Please try again.`
    : "Something went wrong. Please try again.";
}
