import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFollowAuthor } from "@/components/actions";
import { Avatar, FollowPill } from "@/components/feed-post";
import { PhoneHeader } from "@/components/phone-header";
import { PAS, font } from "@/lib/pas";
import type { FollowListResult, ListedPerson } from "@/lib/people";
import { loadFollowList } from "@/lib/wall";

/** Someone's followers, or who they follow, the most recent first. */
export default function FollowList() {
  const { uid, kind } = useLocalSearchParams<{ uid: string; kind: string }>();
  const insets = useSafeAreaInsets();
  const which = kind === "following" ? "following" : "followers";
  const [result, setResult] = useState<FollowListResult | { status: "loading" }>({ status: "loading" });

  useEffect(() => {
    let current = true;
    loadFollowList(uid, which)
      .then((r) => current && setResult(r))
      .catch(() => current && setResult({ status: "error" }));
    return () => {
      current = false;
    };
  }, [uid, which]);

  const note = [font("500 14px", "Plus Jakarta Sans"), { color: PAS.soft }];
  const title = result.status === "found" ? (which === "followers" ? `${result.owner.name}'s followers` : `Who ${result.owner.name} follows`) : which === "followers" ? "Followers" : "Following";

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <PhoneHeader back />
      <FlatList
        data={result.status === "found" ? result.people : []}
        keyExtractor={(p) => p.uid}
        contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 18, paddingBottom: insets.bottom + 26 }}
        ListHeaderComponent={<Text accessibilityRole="header" style={[font("600 26px", "Playfair Display"), { color: PAS.ink, marginBottom: 10 }]}>{title}</Text>}
        ListEmptyComponent={
          <Text accessibilityRole={result.status === "error" ? "alert" : undefined} style={note}>
            {result.status === "loading"
              ? "Loading…"
              : result.status === "error"
                ? "This list couldn't be loaded just now. Please try again in a minute."
                : result.status === "missing"
                  ? "This person isn't here."
                  : which === "followers"
                    ? "No followers yet."
                    : "Not following anyone yet."}
          </Text>
        }
        renderItem={({ item }) => <Row person={item} />}
      />
    </View>
  );
}

function Row({ person }: { person: ListedPerson }) {
  const fol = useFollowAuthor(person.uid, person.name);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: PAS.hairline }}>
      <Pressable accessibilityRole="link" onPress={() => router.push(`/people/${person.uid}`)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 }}>
        <Avatar name={person.name} photo={person.photo} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[font("700 14px", "Plus Jakarta Sans"), { color: PAS.ink }]}>{person.name}</Text>
          {person.city && <Text numberOfLines={1} style={[font("400 13px", "Plus Jakarta Sans"), { color: PAS.soft }]}>{person.city}</Text>}
        </View>
      </Pressable>
      {!fol.mine && <FollowPill text={fol.text} quiet={fol.following} busy={fol.busy} onPress={fol.toggle} />}
    </View>
  );
}
