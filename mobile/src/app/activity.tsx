import { Image } from "expo-image";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/components/auth-provider";
import { PhoneHeader } from "@/components/phone-header";
import { friendlyError } from "@/lib/auth-errors";
import { loadActivity, markBellSeen, type Activity as Item } from "@/lib/follows";
import { PAS, font } from "@/lib/pas";
import { initial } from "@/lib/people";

// Activity, as the website's src/app/activity/activity-list.tsx: who
// followed you, and who joined through your invite links, newest first.

const note = [font("500 13px", "Plus Jakarta Sans"), { color: PAS.soft }];
type Loaded = { uid: string; items: Item[]; seenAt: number };

export default function Activity() {
  const { user, consent } = useAuth();
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !consent) return;
    let current = true;
    loadActivity(user)
      .then((result) => current && setLoaded({ uid: user.uid, ...result }))
      .catch((e) => current && setError(friendlyError(e)));
    return () => {
      current = false;
    };
  }, [user, consent]);

  // Once they've seen it, the dot on the bell goes.
  useEffect(() => {
    if (!user || loaded?.uid !== user.uid) return;
    markBellSeen(user).catch((e) => console.error("Could not mark the activity seen", e));
  }, [user, loaded]);

  if (!user) return <Redirect href="/signin" />;
  if (!consent) return <Redirect href="/welcome" />;

  const shown = loaded && loaded.uid === user.uid ? loaded.items.filter((item): item is Item & { name: string } => !!item.name) : null;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <PhoneHeader back />
      <FlatList
        data={shown ?? []}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 18, paddingBottom: insets.bottom + 26 }}
        ListHeaderComponent={<Text accessibilityRole="header" style={[font("600 30px", "Playfair Display"), { color: PAS.ink, marginBottom: 10 }]}>Activity</Text>}
        ListEmptyComponent={
          error ? (
            <Text accessibilityRole="alert" style={[note, { color: PAS.deepRed }]}>{error}</Text>
          ) : !shown ? (
            <Text style={note}>Loading…</Text>
          ) : (
            <Text style={note}>When someone follows you, or a friend joins through your invite link, it shows here.</Text>
          )
        }
        renderItem={({ item }) => <ActivityRow item={item} />}
      />
    </View>
  );
}

function ActivityRow({ item }: { item: Item & { name: string } }) {
  const what = item.joined
    ? item.followsYou
      ? "joined through your invite link and follows you."
      : "joined through your invite link."
    : "started following you.";
  return (
    <Pressable accessibilityRole="link" onPress={() => router.push(`/people/${item.uid}`)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: PAS.hairline }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: PAS.yellow, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <Text style={[font("700 15px", "Plus Jakarta Sans"), { color: PAS.ink }]}>{initial(item.name)}</Text>
        {item.photo && <Image source={{ uri: item.photo }} contentFit="cover" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
      </View>
      <Text style={[font("500 13.5px/1.4", "Plus Jakarta Sans"), { flex: 1, color: PAS.ink }]}>
        <Text style={{ fontFamily: "PlusJakartaSans_700Bold" }}>{item.name}</Text> {what}
      </Text>
    </Pressable>
  );
}
