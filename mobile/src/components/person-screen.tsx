import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PAS, font } from "@/lib/pas";
import { photoOf, type PersonResult, type PublicPerson } from "@/lib/people";
import { getCachedPerson, loadPerson, useWall } from "@/lib/wall";
import { useAuth } from "./auth-provider";
import { ProfileView } from "./profile-view";

type Loaded = PersonResult | { status: "loading" };

/** Someone's profile, read directly from Firestore + local Wall, pulled down to read again. */
export function PersonScreen({ uid }: { uid: string }) {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { wall } = useWall();

  const immediatePerson = useCallback((): PublicPerson | null => {
    const cached = getCachedPerson(uid);
    if (cached) return cached;
    if (user?.uid === uid && profile) {
      const memories = (wall?.memories ?? [])
        .filter((m) => m.authorId === uid)
        .sort((a, b) => b.approvedAt - a.approvedAt);
      return {
        uid,
        name: profile.displayName,
        city: profile.city ?? null,
        bio: profile.bio ?? null,
        photo: photoOf(profile),
        followers: 0,
        following: 0,
        memories,
      };
    }
    return null;
  }, [uid, user?.uid, profile, wall]);

  const [result, setResult] = useState<Loaded>(() => {
    const initial = immediatePerson();
    return initial ? { status: "found", person: initial } : { status: "loading" };
  });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setResult(await loadPerson(uid));
    } catch {
      const fallback = immediatePerson();
      setResult(fallback ? { status: "found", person: fallback } : { status: "error" });
    }
  }, [uid, immediatePerson]);

  useEffect(() => {
    const initial = immediatePerson();
    setResult(initial ? { status: "found", person: initial } : { status: "loading" });
    void load();
  }, [load, immediatePerson]);

  async function pull() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#fff" }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={PAS.red} colors={[PAS.red]} />}
    >
      {result.status === "found" ? (
        <ProfileView uid={uid} person={result.person} onChanged={() => void load()} />
      ) : result.status === "loading" ? (
        <ActivityIndicator color={PAS.red} style={{ marginTop: 40 }} accessibilityLabel="Loading the profile" />
      ) : (
        <View style={{ padding: 18, gap: 14, alignItems: "flex-start" }}>
          <Text accessibilityRole="alert" style={[font("500 15px", "Plus Jakarta Sans"), { color: PAS.soft }]}>
            {result.status === "missing" ? "This person isn't here. Their account may have been deleted." : "This profile couldn't be loaded just now. Please check your connection."}
          </Text>
          {result.status === "error" && (
            <Pressable accessibilityRole="button" onPress={() => void load()} style={{ height: 42, paddingHorizontal: 20, borderRadius: 999, backgroundColor: PAS.red, justifyContent: "center" }}>
              <Text style={[font("700 13.5px", "Plus Jakarta Sans"), { color: "#fff" }]}>Try again</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}
