import { Image } from "expo-image";
import { Redirect, router } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/components/auth-provider";
import { openMemory } from "@/components/feed-post";
import { useMySaved } from "@/components/use-saved";
import { SAVE, Walker } from "@/components/walker";
import { PAS, font } from "@/lib/pas";
import { useWall } from "@/lib/wall";

// Saved, as the website's src/app/saved/saved-places.tsx: posts saved with
// the bookmark, newest saved first, two to a row. Only you can see it.

const note = [font("500 13px", "Plus Jakarta Sans"), { color: PAS.soft, marginTop: 14 }];

export default function Saved() {
  const { user, consent } = useAuth();
  const saved = useMySaved();
  const { wall, error, loading, reload } = useWall();
  const insets = useSafeAreaInsets();

  if (!user) return <Redirect href="/signin" />;
  if (!consent) return <Redirect href="/welcome" />;
  if (!saved.ready || (!wall && !error)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator color={PAS.red} accessibilityLabel="Loading" />
      </View>
    );
  }

  const byId = new Map((wall?.memories ?? []).map((m) => [m.id, m]));
  const shown = saved.storyIds.flatMap((id) => {
    const memory = byId.get(id);
    return memory ? [memory] : [];
  });
  // Posts since deleted, hidden or shared by link only.
  const gone = saved.storyIds.length - shown.length;

  return (
    <FlatList
      data={shown}
      keyExtractor={(s) => s.id}
      numColumns={2}
      columnWrapperStyle={{ gap: 10 }}
      style={{ backgroundColor: "#fff" }}
      contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 18, paddingBottom: insets.bottom + 90, gap: 14 }}
      refreshControl={<RefreshControl refreshing={loading && !!wall} onRefresh={reload} tintColor={PAS.red} colors={[PAS.red]} />}
      ListHeaderComponent={
        <View style={{ gap: 6 }}>
          <Text accessibilityRole="header" style={[font("600 30px", "Playfair Display"), { color: PAS.ink }]}>Saved</Text>
          <Text style={[font("500 13px", "Plus Jakarta Sans"), { color: PAS.soft }]}>Only you can see this.</Text>
          {!wall && (
            <Text accessibilityRole="alert" style={note}>Your saved posts couldn&apos;t be loaded just now. Pull down to try again.</Text>
          )}
          {wall && shown.length === 0 && (
            <View style={{ marginTop: 28, alignItems: "flex-start", gap: 14 }}>
              <View style={{ width: "100%", height: 316, borderRadius: 20, backgroundColor: PAS.savedCard, overflow: "hidden" }}>
                <Walker width={200} spec={SAVE} />
              </View>
              <Text style={[font("500 15px", "Plus Jakarta Sans"), { color: PAS.ink }]}>Tap the bookmark on any post to keep it here.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.navigate("/")} style={{ height: 42, paddingHorizontal: 20, borderRadius: 999, backgroundColor: PAS.red, justifyContent: "center" }}>
                <Text style={[font("700 13.5px", "Plus Jakarta Sans"), { color: "#fff" }]}>Browse posts</Text>
              </Pressable>
            </View>
          )}
        </View>
      }
      ListFooterComponent={
        gone > 0 && wall ? (
          <Text style={note}>
            {gone === 1
              ? "1 saved post isn't shown because it's no longer public."
              : `${gone} saved posts aren't shown because they're no longer public.`}
          </Text>
        ) : null
      }
      renderItem={({ item: s }) => (
        <Pressable accessibilityRole="link" onPress={() => openMemory(s.id)} style={{ flex: 1, maxWidth: "50%", gap: 6 }}>
          <View style={{ aspectRatio: 4 / 5, borderRadius: 16, overflow: "hidden", backgroundColor: PAS.inputFill }}>
            {s.photoUrl && <Image source={{ uri: s.photoUrl }} contentFit="cover" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
            {s.year !== null && <Text style={[font("400 30px/1", "Anton"), { position: "absolute", left: 10, bottom: 6, color: "#fff", textShadowColor: "rgba(0,0,0,0.25)", textShadowRadius: 8 }]}>{s.year}</Text>}
          </View>
          <Text numberOfLines={2} style={[font("600 16px/1.15", "Playfair Display"), { color: PAS.ink }]}>{s.storeName}</Text>
          <Text numberOfLines={1} style={[font("600 11.5px", "Plus Jakarta Sans"), { color: PAS.soft }]}>{s.neighbourhood ?? s.city}</Text>
        </Pressable>
      )}
    />
  );
}
