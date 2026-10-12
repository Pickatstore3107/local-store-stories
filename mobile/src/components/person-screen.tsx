import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PAS, font } from "@/lib/pas";
import type { PersonResult } from "@/lib/people";
import { loadPerson } from "@/lib/wall";
import { ProfileView } from "./profile-view";

type Loaded = PersonResult | { status: "loading" };

/** Someone's profile, read from the website's stored copy, pulled down to read again. */
export function PersonScreen({ uid }: { uid: string }) {
  const insets = useSafeAreaInsets();
  const [result, setResult] = useState<Loaded>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setResult(await loadPerson(uid));
    } catch {
      setResult({ status: "error" });
    }
  }, [uid]);

  useEffect(() => {
    setResult({ status: "loading" });
    void load();
  }, [load]);

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
