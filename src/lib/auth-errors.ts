import { FirebaseError } from "firebase/app";

const messages: Record<string, string> = {
  "auth/invalid-phone-number": "That phone number doesn't look right. Please check it.",
  "auth/missing-phone-number": "Please enter your phone number.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/quota-exceeded": "We can't send codes right now. Please try again later.",
  "auth/invalid-verification-code": "That code is not correct. Please check the SMS and try again.",
  "auth/code-expired": "That code has expired. Please ask for a new one.",
  "auth/captcha-check-failed": "We couldn't confirm you're not a robot. Please try again.",
  "auth/invalid-app-credential": "We couldn't confirm you're not a robot. Please try again.",
  "auth/popup-closed-by-user": "The Google window was closed before you finished.",
  "auth/cancelled-popup-request": "The Google window was closed before you finished.",
  "auth/popup-blocked": "Your browser blocked the Google window. Please allow pop-ups and try again.",
  "auth/operation-not-allowed": "This way of signing in isn't switched on yet. Please try the other option.",
  "auth/unauthorized-domain": "Sign-in isn't enabled for this web address yet.",
  "auth/web-storage-unsupported": "Please allow cookies for this site, then try again.",
  "auth/network-request-failed": "No connection. Please check your internet and try again.",
  "auth/requires-recent-login": "For your safety, please sign in again and then retry.",
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
