import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from "firebase/auth";
import { FriendlyError } from "./auth-errors";
import { getFirebase } from "./firebase";

// Google won't sign anyone in inside another app's own browser (a "web
// view"): Instagram's, Facebook's and LINE's, Android web views, which say
// "; wv)", and iPhone web views, which leave "Safari" out.
const APP_BROWSER = /Instagram|FBAN|FBAV|Line\/|; wv\)|(iPhone|iPad|iPod)(?!.*Safari)/;

// The Pick at Store app adds this to its web view's user agent, and signs in
// with Google itself (see docs/pick-at-store-app.md).
const PICK_AT_STORE_APP = /PickAtStoreApp/;

type Channel = { postMessage(message: string): void };

type Bridge = {
  googleIdToken(idToken: unknown): void;
  signInFailed(): void;
};

type AppWindow = Window & {
  ReactNativeWebView?: Channel;
  webkit?: { messageHandlers?: { pickAtStore?: Channel } };
  PickAtStore?: Channel;
  flutter_inappwebview?: { callHandler(name: string, ...args: unknown[]): Promise<unknown> };
  localStoreStories?: Bridge;
};

/** How the page can send a message to the Pick at Store app, when it's open inside it. */
function appChannel(): ((message: string) => void) | null {
  if (typeof window === "undefined" || !PICK_AT_STORE_APP.test(navigator.userAgent)) return null;
  const w = window as AppWindow;
  const channel = w.ReactNativeWebView ?? w.webkit?.messageHandlers?.pickAtStore ?? w.PickAtStore;
  if (channel) return (message) => channel.postMessage(message);
  const flutter = w.flutter_inappwebview;
  if (flutter) return (message) => void flutter.callHandler("pickAtStore", message);
  return null;
}

/** Whether the site was added to the home screen and opened from there. */
function homeScreenApp() {
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true
  );
}

/**
 * True inside another app's browser, where Google sign-in won't open and
 * the Pick at Store app isn't there to sign in for the page.
 */
export function signInBlockedHere() {
  if (typeof window === "undefined") return false;
  return APP_BROWSER.test(navigator.userAgent) && !homeScreenApp() && !appChannel();
}

// Long enough to pick an account and pass any two-step check.
const APP_WAIT_MS = 5 * 60 * 1000;

/**
 * Asks the Pick at Store app to sign in with Google. The app answers by
 * calling window.localStoreStories.googleIdToken(idToken), or signInFailed().
 */
function idTokenFromApp(send: (message: string) => void) {
  const w = window as AppWindow;
  return new Promise<string>((resolve, reject) => {
    const bridge: Bridge = {
      googleIdToken: (idToken) => finish(typeof idToken === "string" ? idToken : ""),
      signInFailed: () => finish(""),
    };
    const timer = setTimeout(() => finish(""), APP_WAIT_MS);
    function finish(idToken: string) {
      clearTimeout(timer);
      if (w.localStoreStories === bridge) delete w.localStoreStories;
      if (idToken) resolve(idToken);
      else reject(new FriendlyError("Google sign-in didn't finish. Please try again."));
    }
    w.localStoreStories = bridge;
    send(JSON.stringify({ type: "googleSignIn" }));
  });
}

/**
 * Signs in with Google: in a pop-up in a browser, or through the Pick at
 * Store app's own Google sign-in when the page is open inside it.
 */
export async function signInWithGoogle() {
  const { auth } = getFirebase();
  const send = appChannel();
  if (send) {
    const idToken = await idTokenFromApp(send);
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return;
  }
  await signInWithPopup(auth, new GoogleAuthProvider());
}
