import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";
import { loadAccount, type ConsentRecord, type Profile } from "@/lib/account";
import { firebase } from "@/lib/firebase";
import { keepSearchable } from "@/lib/people-search";

const GUEST_KEY = "guest";

type AuthState = {
  /** True until we know whether someone is signed in or browsing as a guest. */
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  consent: ConsentRecord | null;
  /** Looking around without signing in. Remembered until they sign in. */
  guest: boolean;
  setGuest: (guest: boolean) => void;
  /** Re-reads the profile and consent after they change. */
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authLoading, setAuthLoading] = useState(true);
  const [guestLoading, setGuestLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [guest, setGuestState] = useState(false);

  const load = useCallback(async (next: User | null) => {
    if (!next) {
      setProfile(null);
      setConsent(null);
      return;
    }
    const account = await loadAccount(next.uid);
    setProfile(account.profile);
    setConsent(account.consent);
    // Profiles made before people could be found by name become findable.
    if (account.profile && account.consent) void keepSearchable(next, account.profile);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(GUEST_KEY)
      .then((value) => setGuestState(value === "yes"))
      .catch(() => {})
      .finally(() => setGuestLoading(false));
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(firebase.auth, async (next) => {
        setAuthLoading(true);
        setUser(next);
        try {
          await load(next);
        } catch (error) {
          console.error("Could not load account", error);
        } finally {
          setAuthLoading(false);
        }
      }),
    [load],
  );

  const setGuest = useCallback((next: boolean) => {
    setGuestState(next);
    AsyncStorage.setItem(GUEST_KEY, next ? "yes" : "no").catch(() => {});
  }, []);

  const refresh = useCallback(() => load(user), [load, user]);

  return (
    <AuthContext
      value={{ loading: authLoading || guestLoading, user, profile, consent, guest, setGuest, refresh }}
    >
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const state = use(AuthContext);
  if (!state) throw new Error("useAuth must be used inside <AuthProvider>");
  return state;
}
