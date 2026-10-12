import MaskedView from "@react-native-masked-view/masked-view";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { HEART } from "@/components/actions";
import { useAuth } from "@/components/auth-provider";
import { FeedPost, areaOf, openMemory } from "@/components/feed-post";
import { Walker } from "@/components/walker";
import { firstName, pasGreeting } from "@/lib/greeting";
import type { WallMemory } from "@/lib/memories";
import { PAS, font } from "@/lib/pas";
import { useWall } from "@/lib/wall";

// Home, as the website's src/components/home/pas-home.tsx: the hello, the
// title whose last word follows the kind picked, a search that narrows the
// page as you type, the kinds, "Most loved" on a yellow band with the
// walking woman, and every post under "Just shared".

const RED = PAS.red, INK = PAS.ink, SOFT = PAS.soft;
const KINDS = ["All", "Cafes", "Tea Stalls", "Bakeries", "Restaurants", "Kirana Stores", "Bookstores"] as const;
type Kind = (typeof KINDS)[number];
const WORD: Record<Kind, string> = { All: "places", Cafes: "cafes", "Tea Stalls": "tea stalls", Bakeries: "bakeries", Restaurants: "restaurants", "Kirana Stores": "kirana stores", Bookstores: "bookstores" };

/** The hour, checked once a minute. */
function useHour() {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const timer = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return hour;
}

export default function Home() {
  const { user, profile } = useAuth();
  const { wall, error, loading, reload } = useWall();
  const insets = useSafeAreaInsets();
  const hour = useHour();
  const greeting = pasGreeting(user ? firstName(profile?.displayName ?? user.displayName) : null, hour);
  const [kind, setKind] = useState<Kind>("All");
  const [q, setQ] = useState("");
  // Likes shown on the page, so the ranking follows a like at once.
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  const memories = wall?.memories ?? [];
  const query = q.trim().toLowerCase();
  const feed = memories.filter(
    (p) =>
      (kind === "All" || p.category === kind) &&
      (!query || (p.storeName + areaOf(p) + (p.authorName ?? "")).toLowerCase().includes(query)),
  );
  const count = (p: WallMemory) => likeCounts[p.id] ?? p.likes.count;
  const trending = [...feed]
    .filter((p) => count(p) > 0)
    .sort((a, b) => count(b) - count(a))
    .slice(0, 5);
  const emptyText = query ? 'Nothing matches "' + q + '".' : "No " + WORD[kind] + " posts yet.";

  const header = (
    <View>
      <View style={{ paddingTop: 14, paddingHorizontal: 18, gap: 2 }}>
        <Text style={[font("italic 500 15px", "Playfair Display"), { color: SOFT }]}>{greeting}</Text>
        <View accessible accessibilityRole="header" accessibilityLabel={`Discover local ${WORD[kind]}`} style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" }}>
          <Text style={[font("500 33px/1.08", "Playfair Display"), { color: INK, letterSpacing: -0.33 }]}>Discover local </Text>
          {/* The prototype's marker stroke: yellow from 62% to 92% of the line. */}
          <View>
            <View style={{ position: "absolute", left: 0, right: 0, top: "62%", bottom: "8%", backgroundColor: PAS.yellow }} />
            <Text style={[font("italic 600 33px/1.08", "Playfair Display"), { color: RED, letterSpacing: -0.33 }]}>{WORD[kind]}</Text>
          </View>
        </View>
      </View>

      <View style={{ paddingTop: 14, paddingHorizontal: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 44, paddingHorizontal: 14, borderRadius: 999, backgroundColor: PAS.inputFill }}>
          <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={SOFT} strokeWidth={1.9} strokeLinecap="round">
            <Circle cx={11} cy={11} r={6.5} />
            <Path d="m16 16 4 4" />
          </Svg>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Stores, areas, people"
            placeholderTextColor={PAS.placeholder}
            accessibilityLabel="Search stores, areas and people"
            returnKeyType="search"
            autoCorrect={false}
            style={[font("500 14px", "Plus Jakarta Sans"), { flex: 1, color: INK, paddingVertical: 0 }]}
          />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 20, paddingTop: 16, paddingHorizontal: 18 }}
        style={{ borderBottomWidth: 1, borderBottomColor: PAS.hairline, flexGrow: 0 }}
      >
        {KINDS.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityState={{ selected: k === kind }}
            onPress={() => setKind(k)}
            style={{ paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: k === kind ? RED : "transparent", marginBottom: -1 }}
          >
            <Text style={[font(`${k === kind ? 700 : 600} 13.5px`, "Plus Jakarta Sans"), { color: k === kind ? RED : SOFT }]}>{k}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {trending.length > 0 && (
        <View style={{ backgroundColor: PAS.yellow, marginTop: 16, paddingTop: 18, paddingBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginHorizontal: 18, paddingBottom: 4, borderBottomWidth: 2, borderBottomColor: INK }}>
            <View style={{ gap: 2, paddingBottom: 8 }}>
              <Text style={[font("700 10.5px", "Plus Jakarta Sans"), { letterSpacing: 1.68, textTransform: "uppercase", color: PAS.deepRed }]}>This week</Text>
              <Text accessibilityRole="header" style={[font("italic 600 30px/1", "Playfair Display"), { color: INK }]}>Most loved</Text>
            </View>
            <View style={{ width: 74, height: 116, marginBottom: -2 }}>
              <Walker width={74} />
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={178 + 14}
            decelerationRate="fast"
            contentContainerStyle={{ gap: 14, paddingTop: 26, paddingHorizontal: 18, paddingBottom: 4 }}
          >
            {trending.map((t, i) => (
              <Pressable
                key={t.id}
                accessibilityRole="link"
                accessibilityLabel={`${i + 1}. ${t.storeName}, ${areaOf(t)}, ${count(t)} likes`}
                onPress={() => openMemory(t.id)}
                style={{ width: 178, gap: 10 }}
              >
                <View>
                  <Image source={require("../../../assets/bag-handle.png")} style={{ width: 178, height: (178 * 169) / 750, marginBottom: -1 }} />
                  <MaskedView
                    style={{ width: 178, aspectRatio: 750 / 625 }}
                    maskElement={<Image source={require("../../../assets/bag-body-mask.png")} contentFit="fill" style={{ width: "100%", height: "100%" }} />}
                  >
                    <View style={{ flex: 1, backgroundColor: PAS.inputFill }}>
                      {t.photoUrl && <Image source={{ uri: t.photoUrl }} contentFit="cover" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
                      <LinearGradient colors={["transparent", "rgba(30,15,12,0.6)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "50%" }} />
                      {t.year !== null && <Text style={[font("400 30px/1", "Anton"), { position: "absolute", left: 16, bottom: 10, color: "#fff" }]}>{t.year}</Text>}
                    </View>
                  </MaskedView>
                  <View style={{ position: "absolute", top: -14, right: 4, width: 46, height: 62 }}>
                    <View style={{ position: "absolute", left: 8, top: 7, width: 30, height: 30, borderRadius: 15, backgroundColor: RED, alignItems: "center", justifyContent: "center" }}>
                      <Text style={[font("400 16px/1", "Anton"), { color: "#fff" }]}>{String(i + 1)}</Text>
                    </View>
                    <Image source={require("../../../assets/pas-pin.png")} style={{ position: "absolute", top: 0, left: 0, width: 46, height: 62 }} />
                  </View>
                </View>
                <View style={{ gap: 3 }}>
                  <Text numberOfLines={2} style={[font("600 18px/1.1", "Playfair Display"), { color: INK }]}>{t.storeName}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text numberOfLines={1} style={[font("700 10.5px", "Plus Jakarta Sans"), { flexShrink: 1, letterSpacing: 1.05, textTransform: "uppercase", color: PAS.deepRed }]}>{areaOf(t)}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Svg viewBox="0 0 24 24" width={11} height={11} fill={PAS.deepRed}><Path d={HEART} /></Svg>
                      <Text style={[font("700 10.5px", "Plus Jakarta Sans"), { color: PAS.deepRed }]}>{count(t)}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 22, paddingHorizontal: 18, paddingBottom: 4 }}>
        <Image source={require("../../../assets/pas-pin.png")} style={{ width: 14, height: (14 * 405) / 300 }} />
        <Text accessibilityRole="header" style={[font("600 21px", "Playfair Display"), { color: INK }]}>Just shared</Text>
      </View>
    </View>
  );

  const empty = !wall ? (
    <View style={{ paddingVertical: 36, paddingHorizontal: 18, gap: 14, alignItems: "flex-start" }}>
      <Text style={[font("500 15px", "Plus Jakarta Sans"), { color: SOFT }]}>
        {error ? "We couldn't load the posts. Please check your connection." : "Loading posts…"}
      </Text>
      {error && <PillButton label="Try again" onPress={reload} />}
    </View>
  ) : (
    <View style={{ paddingVertical: 36, paddingHorizontal: 18, gap: 14, alignItems: "flex-start" }}>
      <Text style={[font("500 15px", "Plus Jakarta Sans"), { color: SOFT }]}>{emptyText}</Text>
      <PillButton label="Add the first post" onPress={() => router.push("/add")} />
    </View>
  );

  return (
    <FlatList
      data={feed}
      keyExtractor={(p) => p.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      renderItem={({ item }) => (
        <FeedPost
          p={item}
          builtAt={wall?.builtAt ?? 0}
          onCount={(n) => setLikeCounts((c) => (c[item.id] === n ? c : { ...c, [item.id]: n }))}
        />
      )}
      refreshControl={<RefreshControl refreshing={loading && !!wall} onRefresh={reload} tintColor={RED} colors={[RED]} />}
      contentContainerStyle={{ paddingBottom: insets.bottom + 84 }}
      style={{ backgroundColor: "#fff" }}
    />
  );
}

function PillButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ height: 42, paddingHorizontal: 20, borderRadius: 999, backgroundColor: RED, justifyContent: "center" }}
    >
      <Text style={[font("700 13.5px", "Plus Jakarta Sans"), { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}
