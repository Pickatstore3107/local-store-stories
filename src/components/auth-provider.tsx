"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { loadAccount, type ConsentRecord, type Profile } from "@/lib/account";
import { getFirebase } from "@/lib/firebase";
import { keepSearchable } from "@/lib/people-search";

type AuthState = {
  /** True until Firebase has told us whether someone is signed in. */
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  consent: ConsentRecord | null;
  /** Re-reads the profile and consent after they change. */
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);

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
    const { auth } = getFirebase();
    return onAuthStateChanged(auth, async (next) => {
      setLoading(true);
      setUser(next);
      try {
        await load(next);
      } catch (error) {
        console.error("Could not load account", error);
      } finally {
        setLoading(false);
      }
    });
  }, [load]);

  const refresh = useCallback(() => load(user), [load, user]);

  return (
    <AuthContext value={{ loading, user, profile, consent, refresh }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth must be used inside <AuthProvider>");
  return state;
}
