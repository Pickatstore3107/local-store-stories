import Slider from "@react-native-community/slider";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Linking, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { HYDERABAD, type LatLng } from "@/lib/pins";
import { PAS, font } from "@/lib/pas";
import { useWall } from "@/lib/wall";
import { useAskToJoin } from "./actions";
import { openMemory } from "./feed-post";
import { MapSearch, type Found, type PinnedMemory } from "./map-search";
import { flash } from "./toast";
import { useMyFollows } from "./use-my-follows";
import { useMyLocation } from "./use-my-location";
import { Walker } from "./walker";

// The map, as the website's src/components/map/map-screen.tsx: search and
// kinds at the top, Near me and the story trail on the right, and along the
// bottom the "Since" year slider with the walking woman and a card for
// every story, synced with the pins.

const RED = PAS.red, INK = PAS.ink;
const MAP_KINDS = ["All", "Following", "Cafes", "Tea Stalls", "Bakeries", "Bookstores"] as const;
type MapKind = (typeof MAP_KINDS)[number];
const CARD_W = 318, CARD_GAP = 10;
/** The bottom bar's height, which the cards sit above. */
const BAR = 60;
const shadow = { shadowColor: "#78461E", shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 6 }, elevation: 4 };

/** Posts at the same spot are spread in a small circle, as on the website. */
function pinSpots(memories: PinnedMemory[]) {
  const bySpot = new Map<string, PinnedMemory[]>();
  for (const m of memories) {
    const key = `${m.pin.lat},${m.pin.lng}`;
    bySpot.set(key, [...(bySpot.get(key) ?? []), m]);
  }
  const spots = new Map<string, LatLng>();
  for (const group of bySpot.values()) {
    group.forEach((m, i) => {
      if (group.length === 1) return spots.set(m.id, m.pin);
      const a = (i / group.length) * Math.PI * 2;
      spots.set(m.id, { lat: m.pin.lat + Math.sin(a) * 0.0007, lng: m.pin.lng + Math.cos(a) * 0.0007 });
    });
  }
  return spots;
}

const coord = ({ lat, lng }: LatLng) => ({ latitude: lat, longitude: lng });

function directions({ lat, lng }: LatLng) {
  return Platform.OS === "ios"
    ? `https://maps.apple.com/?daddr=${lat.toFixed(6)},${lng.toFixed(6)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function MapScreen() {
  const { memory: openId } = useLocalSearchParams<{ memory?: string }>();
  const { wall, error } = useWall();
  const { member, ask } = useAskToJoin();
  const myFollows = useMyFollows();
  const { location, locate } = useMyLocation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const map = useRef<MapView>(null);
  const cards = useRef<FlatList<PinnedMemory>>(null);
  const [ready, setReady] = useState(false);
  const [mapKind, setMapKind] = useState<MapKind>("All");
  const [activePin, setActivePin] = useState<string | null>(null);
  const [trail, setTrail] = useState(true);

  const memories = useMemo(
    () => (wall?.memories ?? []).filter((m): m is PinnedMemory => m.pin !== null),
    [wall],
  );
  const yearMax = wall ? new Date(wall.builtAt).getFullYear() : new Date().getFullYear();
  const yearFloor = Math.min(1970, ...memories.flatMap((m) => (m.year ? [m.year] : [])));
  const [yearMin, setYearMin] = useState<number | null>(null);
  const since = yearMin ?? yearFloor;

  const mapPosts = useMemo(
    () =>
      memories.filter((p) =>
        mapKind === "All" ? true : mapKind === "Following" ? myFollows.following.has(p.authorId) : p.category === mapKind,
      ),
    [memories, mapKind, myFollows.following],
  );
  const spots = useMemo(() => pinSpots(memories), [memories]);
  const shows = (p: PinnedMemory) => !p.year || p.year >= since;
  const visible = mapPosts.filter(shows);
  const activeId = visible.some((p) => p.id === activePin) ? activePin : (visible[0]?.id ?? null);

  // Moves the map so a story sits in the upper part, above the cards.
  const panTo = (spot: LatLng, delta = 0.02) => {
    map.current?.animateToRegion(
      { latitude: spot.lat - delta * 0.18, longitude: spot.lng, latitudeDelta: delta, longitudeDelta: delta },
      600,
    );
  };

  const scrollCardTo = (i: number) => {
    if (i < 0) return;
    cards.current?.scrollToOffset({ offset: i * (CARD_W + CARD_GAP), animated: true });
  };
  const pick = (id: string) => {
    setActivePin(id);
    const spot = spots.get(id);
    if (spot) panTo(spot);
    scrollCardTo(visible.findIndex((p) => p.id === id));
  };

  // Once the map and the posts are in: everything in view, or the post a
  // post's page opened the map at.
  const placed = useRef(false);
  useEffect(() => {
    if (!ready || !wall || placed.current) return;
    placed.current = true;
    const memory = openId ? memories.find((p) => p.id === openId) : null;
    if (memory) {
      if (memory.year && memory.year < since) setYearMin(memory.year);
      setActivePin(memory.id);
      panTo(spots.get(memory.id) ?? memory.pin, 0.012);
      setTimeout(() => scrollCardTo(memories.filter((p) => !p.year || p.year >= Math.min(since, memory.year ?? since)).findIndex((p) => p.id === memory.id)), 300);
    } else if (memories.length) {
      map.current?.fitToCoordinates([...spots.values()].map(coord), {
        edgePadding: { top: 140, bottom: 300, left: 40, right: 60 },
        animated: false,
      });
    }
    // Runs once, when both are ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, wall]);

  // A post's page can open the map at another post later on.
  useEffect(() => {
    if (!placed.current || !openId) return;
    const memory = memories.find((p) => p.id === openId);
    if (!memory) return;
    if (memory.year && memory.year < since) setYearMin(memory.year);
    setMapKind("All");
    setActivePin(memory.id);
    panTo(spots.get(memory.id) ?? memory.pin, 0.012);
    // Only when the address changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const me = location.status === "on" ? location.spot : null;
  const nearMe = () => {
    if (me) {
      panTo(me, 0.03);
      flash("Showing stories near you");
      return;
    }
    found.current = true;
    locate();
  };
  // The first time you're found, the map goes to you.
  const found = useRef(false);
  useEffect(() => {
    if (!found.current) return;
    if (location.status === "on") {
      found.current = false;
      panTo(location.spot, 0.03);
      flash("Showing stories near you");
    } else if (location.status !== "finding" && location.status !== "off") {
      found.current = false;
      flash(
        {
          outside: "You're outside Hyderabad. The map covers Hyderabad only for now.",
          denied: "Location is off for this app. Allow it in your phone's Settings, then try again.",
          unavailable: "We couldn't find where you are. Check that location is on, then try again.",
        }[location.status],
      );
    }
    // panTo only moves the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const toggleTrail = () => {
    setTrail(!trail);
    flash(trail ? "Story trail hidden" : "Story trail: oldest to newest");
  };
  const pickKind = (k: MapKind) => {
    if (k === "Following" && !member) return ask();
    setMapKind(k);
  };

  function onFound(result: Found) {
    if (result.type === "memory") {
      const m = result.memory;
      if (!mapPosts.some((p) => p.id === m.id)) setMapKind("All");
      if (m.year && m.year < since) setYearMin(m.year);
      setActivePin(m.id);
      panTo(spots.get(m.id) ?? m.pin, 0.012);
      return;
    }
    const { place } = result;
    if (place.extent) {
      const [west, south, east, north] = place.extent;
      map.current?.fitToCoordinates(
        [coord({ lat: south, lng: west }), coord({ lat: north, lng: east })],
        { edgePadding: { top: 140, bottom: 300, left: 40, right: 60 }, animated: true },
      );
    } else {
      panTo(place.spot, 0.012);
    }
  }

  const trailCoords = trail
    ? [...visible]
        .filter((p) => p.year)
        .sort((a, b) => a.year! - b.year!)
        .map((p) => coord(spots.get(p.id)!))
    : [];
  const start: Region = {
    latitude: HYDERABAD.center.lat,
    longitude: HYDERABAD.center.lng,
    latitudeDelta: 0.25,
    longitudeDelta: 0.25,
  };
  const failed = !!error && !wall;

  return (
    <View style={{ flex: 1, backgroundColor: PAS.mapPaper }}>
      <MapView
        ref={map}
        style={{ flex: 1 }}
        initialRegion={start}
        onMapReady={() => setReady(true)}
        showsUserLocation={false}
        toolbarEnabled={false}
        accessibilityLabel="Map of Hyderabad with stories as pins"
        mapPadding={{ top: 0, right: 0, left: 0, bottom: BAR + insets.bottom + 220 }}
      >
        {trailCoords.length > 1 && (
          <Polyline coordinates={trailCoords} strokeColor={RED} strokeWidth={2.5} lineDashPattern={[2, 9]} lineCap="round" lineJoin="round" />
        )}
        {mapPosts.filter(shows).map((p) => (
          <PhotoPin key={p.id} memory={p} spot={spots.get(p.id)!} on={p.id === activeId} onPress={() => pick(p.id)} />
        ))}
        {me && (
          <Marker coordinate={coord(me)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} accessibilityLabel="You are here">
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(163,23,27,0.25)", alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: RED, borderWidth: 3, borderColor: "#fff" }} />
            </View>
          </Marker>
        )}
      </MapView>

      <View style={{ position: "absolute", top: 6, left: 12, right: 12, gap: 10, zIndex: 4 }}>
        <MapSearch memories={memories} onFound={onFound} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -12, flexGrow: 0, zIndex: -1 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingBottom: 8 }}>
          {MAP_KINDS.map((k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: k === mapKind }}
              onPress={() => pickKind(k)}
              style={{ height: 32, paddingHorizontal: 14, borderRadius: 999, backgroundColor: k === mapKind ? RED : "#fff", justifyContent: "center", ...shadow, shadowOpacity: 0.12 }}
            >
              <Text style={[font("700 12px", "Plus Jakarta Sans"), { color: k === mapKind ? "#fff" : INK }]}>{k}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={{ position: "absolute", right: 12, top: 118, gap: 8, zIndex: 3 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Near me" onPress={nearMe} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow }}>
          <Svg viewBox="0 0 24 24" width={19} height={19} fill="none" stroke={RED} strokeWidth={2} strokeLinecap="round"><Circle cx={12} cy={12} r={6.5} /><Circle cx={12} cy={12} r={2.2} fill={RED} stroke="none" /><Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></Svg>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Story trail" accessibilityState={{ selected: trail }} onPress={toggleTrail} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: trail ? RED : "#fff", alignItems: "center", justifyContent: "center", ...shadow }}>
          <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={trail ? "#fff" : RED} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2.5 3"><Path d="M5 19c3-6 2-9 6-10s5 2 8-4" /></Svg>
        </Pressable>
      </View>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: BAR + insets.bottom + 6, gap: 10, zIndex: 3, maxHeight: height * 0.5 }}>
        <View style={{ marginHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingLeft: 8, paddingRight: 14, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.96)", ...shadow, shadowOpacity: 0.14 }}>
          <View style={{ width: 30, height: 46 }}>
            <Walker width={30} />
          </View>
          <View style={{ width: 74 }}>
            <Text style={[font("700 9.5px", "Plus Jakarta Sans"), { letterSpacing: 1.33, textTransform: "uppercase", color: PAS.soft }]}>Since</Text>
            <Text style={[font("400 26px/1.1", "Anton"), { color: RED }]}>{since}</Text>
          </View>
          <Slider
            style={{ flex: 1, minWidth: 0, height: 40 }}
            minimumValue={yearFloor}
            maximumValue={yearMax}
            step={1}
            value={since}
            onValueChange={(v) => setYearMin(Math.round(v))}
            minimumTrackTintColor={RED}
            maximumTrackTintColor={PAS.barTrack}
            thumbTintColor={RED}
            accessibilityLabel="Show stories since year"
          />
          <Text style={[font("700 11px", "Plus Jakarta Sans"), { color: INK }]}>{visible.length === 1 ? "1 story" : visible.length + " stories"}</Text>
        </View>
        <FlatList
          ref={cards}
          horizontal
          data={visible}
          keyExtractor={(p) => p.id}
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_W + CARD_GAP}
          decelerationRate="fast"
          contentContainerStyle={{ gap: CARD_GAP, paddingHorizontal: 16, paddingBottom: 4 }}
          onScrollToIndexFailed={() => {}}
          onMomentumScrollEnd={(e) => {
            const v = visible[Math.round(e.nativeEvent.contentOffset.x / (CARD_W + CARD_GAP))];
            if (v && v.id !== activeId) {
              setActivePin(v.id);
              const spot = spots.get(v.id);
              if (spot) panTo(spot);
            }
          }}
          ListEmptyComponent={
            <View accessibilityRole={failed ? "alert" : undefined} style={{ width: CARD_W, padding: 18, borderRadius: 22, backgroundColor: "#fff", gap: 6, ...shadow, shadowOpacity: 0.18 }}>
              {failed ? (
                <Text style={[font("400 15px", "Kalam"), { color: PAS.soft }]}>The stories couldn&apos;t be loaded just now. Please try again in a minute.</Text>
              ) : !wall ? (
                <Text style={[font("400 15px", "Kalam"), { color: PAS.soft }]}>Loading stories…</Text>
              ) : (
                <>
                  <Text style={[font("600 18px", "Playfair Display"), { color: INK }]}>No stories from here yet</Text>
                  <Text style={[font("400 15px", "Kalam"), { color: PAS.soft }]}>Slide back in time, or pick another kind.</Text>
                </>
              )}
            </View>
          }
          renderItem={({ item: cd }) => (
            <Pressable
              onPress={() => pick(cd.id)}
              accessibilityLabel={`${cd.storeName}, ${cd.neighbourhood ?? cd.city}`}
              style={{ width: CARD_W, flexDirection: "row", gap: 12, padding: 10, borderRadius: 22, backgroundColor: "#fff", borderWidth: 2, borderColor: cd.id === activeId ? RED : "transparent", ...shadow, shadowOpacity: 0.18 }}
            >
              <View style={{ width: 84, aspectRatio: 4 / 5, borderRadius: 14, overflow: "hidden", backgroundColor: PAS.inputFill }}>
                {cd.postPhotoUrl && <Image source={{ uri: cd.postPhotoUrl }} contentFit="cover" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
                {cd.year !== null && <Text style={[font("400 20px/1", "Anton"), { position: "absolute", left: 6, bottom: 3, color: "#fff", textShadowColor: "rgba(0,0,0,0.25)", textShadowRadius: 6 }]}>{cd.year}</Text>}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text numberOfLines={1} style={[font("700 9.5px", "Plus Jakarta Sans"), { letterSpacing: 1.33, textTransform: "uppercase", color: RED }]}>{cd.category + " · " + (cd.neighbourhood ?? cd.city)}</Text>
                <Text numberOfLines={1} style={[font("600 18px/1.1", "Playfair Display"), { color: INK }]}>{cd.storeName}</Text>
                <Text numberOfLines={2} style={[font("400 15px/1.25", "Kalam"), { color: PAS.soft }]}>{cd.caption}</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: "auto" }}>
                  <Pressable accessibilityRole="button" onPress={() => openMemory(cd.id)} style={{ height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: RED, justifyContent: "center" }}>
                    <Text style={[font("700 11.5px", "Plus Jakarta Sans"), { color: "#fff" }]}>Open story</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      flash("Opening directions to " + cd.storeName);
                      void Linking.openURL(directions(cd.pin));
                    }}
                    style={{ height: 30, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: PAS.border, backgroundColor: "#fff", justifyContent: "center" }}
                  >
                    <Text style={[font("700 11.5px", "Plus Jakarta Sans"), { color: INK }]}>Directions</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          )}
        />
      </View>
    </View>
  );
}

/** A story's photo in a round frame with its year, as the website's map pins. */
function PhotoPin({ memory, spot, on, onPress }: { memory: PinnedMemory; spot: LatLng; on: boolean; onPress: () => void }) {
  // Android draws a marker once; it's redrawn while its photo arrives and when it's picked.
  const [redraw, setRedraw] = useState(true);
  useEffect(() => {
    setRedraw(true);
    const t = setTimeout(() => setRedraw(false), 1500);
    return () => clearTimeout(t);
  }, [on, memory.photoUrl]);
  const size = on ? 62 : 44;
  const ring = on ? RED : "#fff";
  return (
    <Marker
      coordinate={coord(spot)}
      anchor={{ x: 0.5, y: 1 }}
      onPress={onPress}
      tracksViewChanges={redraw}
      zIndex={on ? 5 : 2}
      accessibilityLabel={memory.storeName}
    >
      <View style={{ alignItems: "center", paddingTop: 12, paddingHorizontal: 20 }}>
        <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: ring, backgroundColor: PAS.inputFill, overflow: "hidden" }}>
          {memory.photoUrl && <Image source={{ uri: memory.photoUrl }} contentFit="cover" style={{ width: "100%", height: "100%" }} onLoad={() => setRedraw(true)} />}
        </View>
        {memory.year !== null && (
          <View style={{ position: "absolute", top: 2, right: 2, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: on ? PAS.yellow : "#fff" }}>
            <Text style={[font("400 12px/1.25", "Anton"), { color: on ? INK : RED }]}>{memory.year}</Text>
          </View>
        )}
        <View style={{ width: 0, height: 0, marginTop: -2, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: ring }} />
      </View>
    </Marker>
  );
}
