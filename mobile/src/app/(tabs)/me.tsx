import { Redirect } from "expo-router";
import { useAuth } from "@/components/auth-provider";
import { PersonScreen } from "@/components/person-screen";

/** Me: your own profile, as everyone sees it, with Edit profile and Manage my posts. */
export default function Me() {
  const { user, consent } = useAuth();
  if (!user) return <Redirect href="/signin" />;
  if (!consent) return <Redirect href="/welcome" />;
  return <PersonScreen uid={user.uid} />;
}
