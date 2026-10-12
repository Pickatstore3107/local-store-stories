import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { memoryMatches, placeLine, searchWords, type WallMemory } from "@/lib/memories";
import { PAS, font } from "@/lib/pas";
import type { LatLng } from "@/lib/pins";
import { searchPlaces, type Place } from "@/lib/place-search";

export type PinnedMemory = WallMemory & { pin: LatLng };
export type Found = { type: "memory"; memory: PinnedMemory } | { type: "place"; place: Place };

type Results = { query: string; places: Place[]; failed: boolean };

const WAIT_MS = 250;

/**
 * The search bar over the map, as the website's map-search.tsx: posts on the
 * map first, then any area, street or shop in Hyderabad, as you type.
 */
export function MapSearch({ memories, onFound }: { memories: PinnedMemory[]; onFound: (found: Found) => void }) {
  const input = useRef<TextInput>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Results>({ query: "", places: [], failed: false });

  const asked = query.trim();
  const words = useMemo(() => searchWords(asked), [asked]);
  const memoryHits = useMemo(
    () => (words.length ? memories.filter((m) => memoryMatches(m, words)).slice(0, 4) : []),
    [memories, words],
  );

  // Asks Photon once typing pauses; a newer search cancels the one before.
  useEffect(() => {
    if (asked.length < 2) return;
    const stop = new AbortController();
    const wait = setTimeout(() => {
      searchPlaces(asked, stop.signal)
        .then((places) => setResults({ query: asked, places, failed: false }))
        .catch((error) => {
          if (stop.signal.aborted) return;
          console.error("Place search failed", error);
          setResults({ query: asked, places: [], failed: true });
        });
    }, WAIT_MS);
    return () => {
      clearTimeout(wait);
      stop.abort();
    };
  }, [asked]);

  const fresh = results.query === asked;
  const places = asked.length >= 2 && fresh ? results.places : [];
  const searching = asked.length >= 2 && !fresh;
  const options: Found[] = [
    ...memoryHits.map((memory) => ({ type: "memory" as const, memory })),
    ...places.map((place) => ({ type: "place" as const, place })),
  ];
  const showing = open && asked.length > 0;
  const status =
    asked.length < 2
      ? memoryHits.length
        ? ""
        : "Keep typing to search places"
      : searching
        ? "Searching places…"
        : results.failed && fresh
          ? "Places can't be searched just now. Posts still can."
          : options.length === 0
            ? "Nothing in Hyderabad matches that."
            : "";

  function pick(found: Found | undefined) {
    if (!found) return;
    setQuery(found.type === "memory" ? found.memory.storeName : found.place.name);
    setOpen(false);
    Keyboard.dismiss();
    onFound(found);
  }

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 46, paddingHorizontal: 16, borderRadius: 999, backgroundColor: "#fff", shadowColor: "#78461E", shadowOpacity: 0.14, shadowRadius: 11, shadowOffset: { width: 0, height: 8 }, elevation: 4 }}>
        <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={PAS.soft} strokeWidth={1.9} strokeLinecap="round"><Circle cx={11} cy={11} r={6.5} /><Path d="m16 16 4 4" /></Svg>
        <TextInput
          ref={input}
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onSubmitEditing={() => pick(options[0])}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search stores and places in Hyderabad"
          placeholder="Search a store or an area"
          placeholderTextColor={PAS.placeholder}
          style={[font("500 14px", "Plus Jakarta Sans"), { flex: 1, minWidth: 0, color: PAS.ink, paddingVertical: 0 }]}
        />
        {query.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear the search" hitSlop={8} onPress={() => { setQuery(""); setOpen(false); }}>
            <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={PAS.soft} strokeWidth={2} strokeLinecap="round"><Path d="M6 6l12 12M18 6 6 18" /></Svg>
          </Pressable>
        )}
      </View>

      {showing && (
        <View style={{ position: "absolute", left: 0, right: 0, top: 52, maxHeight: 360, borderRadius: 16, backgroundColor: "#fff", paddingVertical: 8, shadowColor: PAS.ink, shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 16 }, elevation: 10 }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {options.map((found) => (
              <Pressable
                key={found.type === "memory" ? `m-${found.memory.id}` : `p-${found.place.key}`}
                accessibilityRole="button"
                onPress={() => pick(found)}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: pressed ? PAS.inputFill : "transparent" })}
              >
                {found.type === "memory" ? <MemoryOption memory={found.memory} /> : <PlaceOption place={found.place} />}
              </Pressable>
            ))}
            {status !== "" && (
              <Text accessibilityLiveRegion="polite" style={[font("400 13.5px", "Plus Jakarta Sans"), { color: PAS.soft, paddingHorizontal: 14, paddingVertical: 8 }]}>{status}</Text>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function MemoryOption({ memory }: { memory: PinnedMemory }) {
  return (
    <>
      <View style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", backgroundColor: PAS.butter, alignItems: "center", justifyContent: "center" }}>
        {memory.photoUrl ? (
          <Image source={{ uri: memory.photoUrl }} contentFit="cover" style={{ width: 36, height: 36 }} />
        ) : (
          <Text style={[font("700 16px", "Kalam"), { color: PAS.red }]}>{memory.storeName.charAt(0)}</Text>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[font("600 15px", "Plus Jakarta Sans"), { color: PAS.ink }]}>{memory.storeName}</Text>
        <Text numberOfLines={1} style={[font("400 12.5px", "Plus Jakarta Sans"), { color: PAS.soft }]}>Post · {placeLine(memory)}</Text>
      </View>
    </>
  );
}

function PlaceOption({ place }: { place: Place }) {
  return (
    <>
      <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: PAS.inputFill, alignItems: "center", justifyContent: "center" }}>
        <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={PAS.soft} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          {place.store ? (
            <Path d="M4 9.5 5.5 4.5h13L20 9.5M4 9.5h16M4 9.5v10h16v-10M9.5 19.5v-5h5v5" />
          ) : (
            <Path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z" />
          )}
        </Svg>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[font("600 15px", "Plus Jakarta Sans"), { color: PAS.ink }]}>{place.name}</Text>
        {place.detail !== "" && <Text numberOfLines={1} style={[font("400 12.5px", "Plus Jakarta Sans"), { color: PAS.soft }]}>{place.detail}</Text>}
      </View>
    </>
  );
}
