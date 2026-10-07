import { FirebaseError } from "firebase/app";

const messages: Record<string, string> = {
  "auth/invalid-phone-number": "That phone number doesn't look right. Please check it.",
  "auth/missing-phone-number": "Please enter your phone number.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/quota-exceeded": "We can't send codes right now. Please try again later.",
  "auth/invalid-verification-code": "That code is not correct. Please check the SMS and try again.",
  "auth/code-expired": "That code has expired. Please ask for a new one.",
  "auth/popup-closed-by-user": "The Google window was closed before you finished.",
  "auth/cancelled-popup-request": "The Google window was closed before you finished.",
  "auth/popup-blocked": "Your browser blocked the Google window. Please allow pop-ups and try again.",
  "auth/network-request-failed": "No connection. Please check your internet and try again.",
  "auth/requires-recent-login": "For your safety, please sign in again and then retry.",
  "permission-denied": "You don't have permission to do that.",
};

export function friendlyError(error: unknown) {
  if (error instanceof FirebaseError && messages[error.code]) {
    return messages[error.code];
  }
  return "Something went wrong. Please try again.";
}
