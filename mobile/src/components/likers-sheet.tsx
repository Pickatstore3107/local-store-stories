import { router } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { friendlyError } from "@/lib/auth-errors";
import { loadLikers } from "@/lib/likes";
import { PAS, font } from "@/lib/pas";
import type { ListedPerson } from "@/lib/people";
import { useFollowAuthor } from "./actions";
import { Avatar, FollowPill } from "./feed-post";

/**
 * Who liked a post, as the website's likers dialog: the newest first.
 * Private loves from before likes were public are counted, never named.
 */
export function LikersSheet({ storyId, privateLoves, onClose }: { storyId: string; privateLoves: number; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [people, setPeople] = useState<ListedPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    loadLikers(storyId)
      .then((found) => current && setPeople(found))
      .catch((e) => current && setError(friendlyError(e)));
    return () => {
      current = false;
    };
  }, [storyId]);

  const note = (text: string, role?: "alert") => (
    <Text accessibilityRole={role} style={[font("500 14px", "Plus Jakarta Sans"), { color: role ? PAS.deepRed : PAS.soft, textAlign: "center", paddingVertical: 24 }]}>{text}</Text>
  );

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#fff", paddingBottom: insets.bottom }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: PAS.hairline }}>
          <Text accessibilityRole="header" style={[font("800 16px", "Plus Jakarta Sans"), { color: PAS.ink }]}>Likes</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8} style={{ padding: 6 }}>
            <Svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke={PAS.soft} strokeWidth={2} strokeLinecap="round"><Path d="M6 6l12 12M18 6 6 18" /></Svg>
          </Pressable>
        </View>
        {error ? (
          note(error, "alert")
        ) : people === null ? (
          note("Loading…")
        ) : (
          <FlatList
            data={people}
            keyExtractor={(p) => p.uid}
            contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 8 }}
            ListEmptyComponent={privateLoves === 0 ? note("No likes yet.") : null}
            renderItem={({ item }) => <Liker person={item} onOpen={onClose} />}
            ListFooterComponent={
              <View style={{ gap: 8, paddingTop: 12 }}>
                {privateLoves > 0 && (
                  <Text style={[font("400 13.5px", "Plus Jakarta Sans"), { color: PAS.soft }]}>
                    {privateLoves === 1
                      ? "1 person loved this post before likes showed names. That stays private."
                      : `${privateLoves} people loved this post before likes showed names. That stays private.`}
                  </Text>
                )}
                <Text style={[font("400 12px", "Plus Jakarta Sans"), { color: PAS.soft }]}>Likes are public: anyone can see who liked a post.</Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}

function Liker({ person, onOpen }: { person: ListedPerson; onOpen: () => void }) {
  const fol = useFollowAuthor(person.uid, person.name);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: PAS.hairline }}>
      <Pressable
        accessibilityRole="link"
        onPress={() => {
          onOpen();
          router.push(`/people/${person.uid}`);
        }}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 }}
      >
        <Avatar name={person.name} photo={person.photo} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[font("700 14px", "Plus Jakarta Sans"), { color: PAS.ink }]}>{person.name}</Text>
          {person.city && <Text numberOfLines={1} style={[font("400 13px", "Plus Jakarta Sans"), { color: PAS.soft }]}>{person.city}</Text>}
        </View>
      </Pressable>
      {!fol.mine && <FollowPill text={fol.text} quiet={fol.following} busy={fol.busy} onPress={fol.toggle} />}
    </View>
  );
}
