import { Image } from "expo-image";
import { Redirect, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Keyboard, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useAuth } from "@/components/auth-provider";
import { PinPicker } from "@/components/pin-picker";
import { flash } from "@/components/toast";
import { Walker } from "@/components/walker";
import { friendlyError } from "@/lib/auth-errors";
import { MAX_PHOTOS, pickPhotos, type ReadyPhoto } from "@/lib/media";
import { memoryPath } from "@/lib/memories";
import { PAS, font } from "@/lib/pas";
import { pinAt, type Pin } from "@/lib/pins";
import { searchPlaces, type Place } from "@/lib/place-search";
import { SITE } from "@/lib/site";
import {
  CAPTION_MAX,
  CAPTION_MIN,
  ORDERED_MAX,
  PLACE_MAX,
  PLACE_MIN,
  STORE_NAME_MAX,
  STORE_NAME_MIN,
  YEAR_MIN,
  shareStory,
  type Category,
  type Visibility,
} from "@/lib/stories";
import { refreshWall } from "@/lib/wall";

// Add Place, as the website's src/app/share/: the prototype's New post in
// three steps (photos, which store, your words), with Back and Next above
// the bottom bar. A video can be shared from the website.

const RED = PAS.red, INK = PAS.ink, SOFT = PAS.soft;
const FORM_KINDS = ["Cafes", "Tea Stalls", "Bakeries", "Restaurants", "Kirana Stores", "Bookstores"] as const satisfies readonly Category[];
const isFormKind = (c: string): c is Category => (FORM_KINDS as readonly string[]).includes(c);
const caps = [font("700 10.5px", "Plus Jakarta Sans"), { letterSpacing: 1.47, textTransform: "uppercase" as const, color: SOFT }];
const field = [font("500 14px", "Plus Jakarta Sans"), { height: 44, borderRadius: 14, backgroundColor: PAS.inputFill, paddingHorizontal: 14, color: INK }];
const note = [font("500 12px/1.5", "Plus Jakarta Sans"), { color: SOFT }];
const problemText = [font("500 12.5px/1.5", "Plus Jakarta Sans"), { color: PAS.deepRed }];
const BAR = 60;

type StoreDetails = { storeName: string; neighbourhood: string; city: string; pin: Pin | null };
type StoreMode = "search" | "picked" | "manual";

function storeProblem({ storeName, neighbourhood, city }: StoreDetails) {
  if (storeName.trim().length < STORE_NAME_MIN) return "Add the store's name.";
  if (city.trim().length < PLACE_MIN) return "Add the city.";
  if (neighbourhood.trim().length === 1) return "Write the neighbourhood in full, or leave it empty.";
  return null;
}

/** A fresh, empty form each time a post is shared. */
export default function AddPlace() {
  const { user, consent } = useAuth();
  const [round, setRound] = useState(0);
  if (!user) return <Redirect href="/signin" />;
  if (!consent) return <Redirect href="/welcome" />;
  return <StoryForm key={round} onShared={() => setRound((r) => r + 1)} />;
}

function StoryForm({ onShared }: { onShared: () => void }) {
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const typing = useKeyboardUp();
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<ReadyPhoto[]>([]);
  const [preparing, setPreparing] = useState<string | null>(null);
  const [store, setStore] = useState<StoreDetails>({ storeName: "", neighbourhood: "", city: profile?.city ?? "Hyderabad", pin: null });
  const [storeMode, setStoreMode] = useState<StoreMode>("search");
  const [category, setCategory] = useState<Category | "">("");
  const [caption, setCaption] = useState("");
  const [year, setYear] = useState("");
  const [ordered, setOrdered] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  if (!user) return null;

  const thisYear = new Date().getFullYear();
  const yearNumber = year.trim() ? Number(year) : null;
  const problems = (
    step === 1
      ? [preparing, !photos.length && "Add a photo."]
      : step === 2
        ? [storeProblem(store)]
        : [
            caption.trim().length < CAPTION_MIN && `Write your post (at least ${CAPTION_MIN} letters).`,
            !category && "Choose what kind of place it is.",
            yearNumber !== null &&
              !(Number.isInteger(yearNumber) && yearNumber >= YEAR_MIN && yearNumber <= thisYear) &&
              `The year should be between ${YEAR_MIN} and ${thisYear}.`,
            !rights && "Confirm you may share these photos.",
          ]
  ).filter(Boolean) as string[];
  const canNext = !problems.length && !busy;
  const shownError = tried && problems.length && !preparing ? problems[0] : error;

  function go(next: number) {
    setError(null);
    setTried(false);
    setStep(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  async function next() {
    if (busy) return;
    if (problems.length) return setTried(true);
    if (step < 3) return go(step + 1);
    if (!user || !photos.length || !category) return;
    Keyboard.dismiss();
    setError(null);
    setProgress(0);
    setBusy(true);
    try {
      const storyId = await shareStory(
        user,
        { ...store, category, caption, year: yearNumber, ordered, visibility },
        { photos },
        setProgress,
      );
      void refreshWall(true);
      onShared();
      if (visibility === "public") router.navigate("/");
      else router.push(memoryPath(storyId) as `/memories/${string}`);
      flash("Posted. It is live now.");
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  const nextLabel = !busy ? (step === 3 ? "Post" : "Next") : progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : "Posting…";
  const footerBottom = typing ? 0 : BAR + insets.bottom;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#fff" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 18, paddingBottom: footerBottom + 90, gap: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
            <View style={{ width: 46, height: 72 }}>
              <Walker width={46} />
            </View>
            <Text accessibilityRole="header" style={[font("600 28px", "Playfair Display"), { color: INK }]}>New post</Text>
          </View>
          <Text style={[font("700 11px", "Plus Jakarta Sans"), { letterSpacing: 1.32, textTransform: "uppercase", color: SOFT, paddingBottom: 6 }]}>Step {step} of 3</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[1, 2, 3].map((n) => (
            <View key={n} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: n <= step ? RED : PAS.barTrack }} />
          ))}
        </View>

        {step === 1 && <PhotoStep photos={photos} setPhotos={setPhotos} busy={preparing} setBusy={setPreparing} />}

        {step === 2 && (
          <StoreStep
            store={store}
            setStore={setStore}
            mode={storeMode}
            setMode={setStoreMode}
            onCategory={(found) => setCategory((now) => now || (isFormKind(found) ? found : ""))}
          />
        )}

        {step === 3 && (
          <View style={{ gap: 16 }}>
            <Text accessibilityRole="header" style={[font("600 20px", "Playfair Display"), { color: INK }]}>Your words</Text>
            <TextInput
              accessibilityLabel="Your post"
              value={caption}
              maxLength={CAPTION_MAX}
              onChangeText={setCaption}
              placeholder="What do you remember?"
              placeholderTextColor={PAS.placeholder}
              multiline
              style={[font("400 19px/1.35", "Kalam"), { minHeight: 96, borderRadius: 18, backgroundColor: PAS.butter, paddingVertical: 14, paddingHorizontal: 16, color: INK, textAlignVertical: "top" }]}
            />
            <View style={{ gap: 8 }}>
              <Text style={caps}>Kind</Text>
              <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {FORM_KINDS.map((k) => (
                  <Pressable
                    key={k}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: category === k }}
                    onPress={() => setCategory(k)}
                    style={{ height: 34, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: category === k ? RED : PAS.border, backgroundColor: category === k ? RED : "#fff", justifyContent: "center" }}
                  >
                    <Text style={[font("700 12.5px", "Plus Jakarta Sans"), { color: category === k ? "#fff" : INK }]}>{k}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ width: 110, gap: 6 }}>
                <Text style={caps}>Year</Text>
                <TextInput
                  accessibilityLabel="Year"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={year}
                  onChangeText={(t) => setYear(t.replace(/\D/g, ""))}
                  placeholder="2009"
                  placeholderTextColor={PAS.placeholder}
                  style={[field, font("400 22px", "Anton"), { color: RED }]}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={caps}>I always ordered</Text>
                <TextInput accessibilityLabel="I always ordered" value={ordered} maxLength={ORDERED_MAX} onChangeText={setOrdered} placeholder="Optional" placeholderTextColor={PAS.placeholder} style={field} />
              </View>
            </View>
            <View accessibilityRole="radiogroup" accessibilityLabel="Who can see it" style={{ flexDirection: "row", padding: 4, borderRadius: 999, backgroundColor: PAS.inputFill }}>
              {(
                [
                  ["public", "Everyone"],
                  ["link", "Only with link"],
                ] as const
              ).map(([value, label]) => {
                const on = visibility === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => setVisibility(value)}
                    style={{ flex: 1, height: 36, borderRadius: 999, backgroundColor: on ? "#fff" : "transparent", alignItems: "center", justifyContent: "center", ...(on && { shadowColor: "#78461E", shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }) }}
                  >
                    <Text style={[font("700 12.5px", "Plus Jakarta Sans"), { color: on ? INK : SOFT }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: rights }} onPress={() => setRights(!rights)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: RED, backgroundColor: rights ? RED : "#fff", alignItems: "center", justifyContent: "center" }}>
                <Svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><Path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
              </View>
              <Text style={[font("500 13px/1.45", "Plus Jakarta Sans"), { color: INK, flex: 1 }]}>I took these photos or have the right to share them.</Text>
            </Pressable>
          </View>
        )}

        {shownError && <Text accessibilityRole="alert" style={problemText}>{shownError}</Text>}
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: footerBottom, flexDirection: "row", gap: 10, paddingVertical: 12, paddingHorizontal: 18, backgroundColor: "rgba(255,255,255,0.97)" }}>
        {step > 1 && (
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => go(step - 1)} style={{ height: 50, paddingHorizontal: 20, borderRadius: 999, backgroundColor: PAS.inputFill, justifyContent: "center" }}>
            <Text style={[font("700 14px", "Plus Jakarta Sans"), { color: INK }]}>Back</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canNext }} onPress={next} style={{ flex: 1, height: 50, borderRadius: 999, backgroundColor: RED, alignItems: "center", justifyContent: "center", opacity: canNext || busy ? 1 : 0.4 }}>
          <Text style={[font("700 15px", "Plus Jakarta Sans"), { color: "#fff" }]}>{nextLabel}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function useKeyboardUp() {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setUp(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return up;
}

/** Step 1: up to five photos, cropped 4:5 in the middle. The dashed tile adds more. */
function PhotoStep({ photos, setPhotos, busy, setBusy }: { photos: ReadyPhoto[]; setPhotos: (p: ReadyPhoto[]) => void; busy: string | null; setBusy: (b: string | null) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [extra, setExtra] = useState<string | null>(null);

  async function add(keep: ReadyPhoto[]) {
    setError(null);
    setExtra(null);
    setBusy("Getting your photos ready…");
    try {
      const result = await pickPhotos(MAX_PHOTOS - keep.length);
      if (!result) return;
      if ("denied" in result) {
        setError("Photos are off for this app. Allow them in your phone's Settings, then try again.");
        return;
      }
      if (result.extra) setExtra(`A post can have up to ${MAX_PHOTOS} photos, so we kept the first ${MAX_PHOTOS}.`);
      if (result.photos.length) setPhotos([...keep, ...result.photos]);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const tile = (on: boolean) => ({ flex: 1, aspectRatio: 1, borderRadius: 20, borderWidth: 2, borderColor: on ? RED : PAS.barTrack, backgroundColor: on ? PAS.pickedFill : "#fff", padding: 16, justifyContent: "space-between" as const });
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={[font("600 20px", "Playfair Display"), { color: INK }]}>Photos</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose photos" disabled={!!busy} onPress={() => add([])} style={tile(photos.length > 0)}>
          <Svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke={RED} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round"><Rect x={3.5} y={5} width={17} height={14} rx={3} /><Circle cx={9} cy={10} r={1.6} /><Path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" /></Svg>
          <View>
            <Text style={[font("700 16px", "Plus Jakarta Sans"), { color: INK }]}>Photos</Text>
            <Text style={[font("500 12px", "Plus Jakarta Sans"), { color: SOFT }]}>Up to 5, cropped 4:5</Text>
          </View>
        </Pressable>
        <View style={[tile(false), { borderStyle: "dashed", borderColor: PAS.dashedBorder }]}>
          <Svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke={SOFT} strokeWidth={1.8} strokeLinejoin="round"><Rect x={3} y={6} width={13} height={12} rx={3} /><Path d="m16 10.5 5-3v9l-5-3z" /></Svg>
          <View>
            <Text style={[font("700 16px", "Plus Jakarta Sans"), { color: SOFT }]}>Video</Text>
            <Text style={[font("500 12px", "Plus Jakarta Sans"), { color: SOFT }]}>
              Share one from the{" "}
              <Text accessibilityRole="link" onPress={() => Linking.openURL(`${SITE}/share`)} style={{ color: RED, textDecorationLine: "underline" }}>website</Text>
            </Text>
          </View>
        </View>
      </View>
      {photos.length > 0 && (
        <View style={{ flexDirection: "row", gap: 6 }}>
          {photos.map((photo, i) => (
            <View key={photo.key} style={{ flex: 1 }}>
              <Image source={{ uri: photo.uri }} accessibilityLabel={`Photo ${i + 1} of ${photos.length}`} contentFit="cover" style={{ aspectRatio: 4 / 5, borderRadius: 10 }} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${i + 1}`}
                hitSlop={6}
                onPress={() => setPhotos(photos.filter((p) => p.key !== photo.key))}
                style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(30,15,12,0.6)", alignItems: "center", justifyContent: "center" }}
              >
                <Svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round"><Path d="M6 6l12 12M18 6 6 18" /></Svg>
              </Pressable>
            </View>
          ))}
          {Array.from({ length: MAX_PHOTOS - photos.length }, (_, i) =>
            i === 0 ? (
              <Pressable key="more" accessibilityRole="button" accessibilityLabel="Add more photos" disabled={!!busy} onPress={() => add(photos)} style={{ flex: 1, aspectRatio: 4 / 5, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: PAS.dashedBorder, alignItems: "center", justifyContent: "center" }}>
                <Text style={[font("600 18px", "Plus Jakarta Sans"), { color: RED }]}>+</Text>
              </Pressable>
            ) : (
              <View key={i} style={{ flex: 1 }} />
            ),
          )}
        </View>
      )}
      {busy && <Text accessibilityLiveRegion="polite" style={note}>{busy}</Text>}
      {extra && <Text style={note}>{extra}</Text>}
      {error && <Text accessibilityRole="alert" style={problemText}>{error}</Text>}
      <Text style={note}>Location data is removed on your phone before upload.</Text>
    </View>
  );
}

/**
 * Step 2: a search of Hyderabad's stores and areas, with the results as a
 * list. "Not listed?" types it in and drops a pin on the map instead.
 */
function StoreStep({
  store,
  setStore,
  mode,
  setMode,
  onCategory,
}: {
  store: StoreDetails;
  setStore: (store: StoreDetails) => void;
  mode: StoreMode;
  setMode: (mode: StoreMode) => void;
  onCategory: (category: Category) => void;
}) {
  const [areaPicked, setAreaPicked] = useState<string | null>(null);
  const nameField = useRef<TextInput>(null);

  function pick(place: Place) {
    const pin = pinAt(place.spot);
    const city = (place.city ?? "Hyderabad").slice(0, PLACE_MAX);
    if (place.store) {
      setStore({ storeName: place.name.slice(0, STORE_NAME_MAX), neighbourhood: (place.area ?? "").slice(0, PLACE_MAX), city, pin });
      if (place.category) onCategory(place.category);
      setAreaPicked(null);
      setMode("picked");
    } else {
      setStore({ ...store, neighbourhood: place.name.slice(0, PLACE_MAX), city, pin });
      setAreaPicked(place.name);
      setMode("manual");
      setTimeout(() => nameField.current?.focus(), 100);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={[font("600 20px", "Playfair Display"), { color: INK }]}>Which store?</Text>
      {mode !== "manual" ? (
        <StoreSearch onPick={pick} picked={mode === "picked" ? store : null} />
      ) : (
        <View style={{ gap: 10 }}>
          {areaPicked && <Text style={note}>The pin is on {areaPicked}. Now type the store&apos;s name.</Text>}
          <View style={{ gap: 6 }}>
            <Text style={caps}>Store name</Text>
            <TextInput ref={nameField} accessibilityLabel="Store name" value={store.storeName} maxLength={STORE_NAME_MAX} onChangeText={(t) => setStore({ ...store, storeName: t })} placeholder="Sharma Tea Point" placeholderTextColor={PAS.placeholder} style={field} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={caps}>Area</Text>
              <TextInput accessibilityLabel="Area" value={store.neighbourhood} maxLength={PLACE_MAX} onChangeText={(t) => setStore({ ...store, neighbourhood: t })} placeholder="Optional" placeholderTextColor={PAS.placeholder} style={field} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={caps}>City</Text>
              <TextInput accessibilityLabel="City" value={store.city} maxLength={PLACE_MAX} onChangeText={(t) => setStore({ ...store, city: t })} style={field} />
            </View>
          </View>
          <Text style={caps}>Drop a pin</Text>
          <PinPicker value={store.pin} onChange={(pin) => setStore({ ...store, pin })} neighbourhood={store.neighbourhood} />
          <Text style={note}>The map shows the area, never the exact spot, and only posts shared with everyone.</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (mode === "manual") return setMode("search");
          setAreaPicked(null);
          setMode("manual");
        }}
        style={{ alignSelf: "flex-start", paddingVertical: 4 }}
      >
        <Text style={[font("700 13px", "Plus Jakarta Sans"), { color: RED }]}>{mode === "manual" ? "Search instead" : "Not listed? Type it and drop a pin"}</Text>
      </Pressable>
    </View>
  );
}

type Results = { query: string; places: Place[]; failed: boolean };

function StoreSearch({ onPick, picked }: { onPick: (place: Place) => void; picked: StoreDetails | null }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>({ query: "", places: [], failed: false });
  const asked = query.trim();

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
    }, 250);
    return () => {
      clearTimeout(wait);
      stop.abort();
    };
  }, [asked]);

  const fresh = results.query === asked;
  const places = asked.length >= 2 && fresh ? [...results.places].sort((a, b) => Number(b.store) - Number(a.store)) : [];
  const status =
    asked.length < 2
      ? null
      : !fresh
        ? "Searching…"
        : results.failed
          ? "Search isn't working just now. Type the store in instead."
          : places.length === 0
            ? "Nothing in Hyderabad matches that. You can type it in."
            : null;
  const pickedPlace = picked ? [picked.neighbourhood.trim(), picked.city.trim()].filter(Boolean).join(", ") : "";
  const rows = [
    ...(picked && !places.some((p) => p.store && p.name === picked.storeName)
      ? [{ key: "picked", name: picked.storeName, area: pickedPlace, on: true, place: null }]
      : []),
    ...places.map((place) => ({ key: place.key, name: place.name, area: place.detail ?? "", on: !!picked && place.store && place.name === picked.storeName, place })),
  ];

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 46, paddingHorizontal: 16, borderRadius: 999, backgroundColor: PAS.inputFill }}>
        <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={SOFT} strokeWidth={1.9} strokeLinecap="round"><Circle cx={11} cy={11} r={6.5} /><Path d="m16 16 4 4" /></Svg>
        <TextInput
          accessibilityLabel="Search for the store in Hyderabad"
          value={query}
          onChangeText={setQuery}
          placeholder="Store name or area"
          placeholderTextColor={PAS.placeholder}
          returnKeyType="search"
          autoCorrect={false}
          style={[font("500 14px", "Plus Jakarta Sans"), { flex: 1, minWidth: 0, color: INK, paddingVertical: 0 }]}
        />
      </View>
      {rows.length > 0 && (
        <View style={{ borderTopWidth: 1, borderTopColor: PAS.hairline }}>
          {rows.map((s) => (
            <Pressable key={s.key} accessibilityRole="button" accessibilityState={{ selected: s.on }} onPress={() => s.place && onPick(s.place)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: PAS.hairline }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: s.on ? RED : PAS.butterLight, alignItems: "center", justifyContent: "center" }}>
                <Svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke={s.on ? "#fff" : RED} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z" /></Svg>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={[font("700 14px", "Plus Jakarta Sans"), { color: INK }]}>{s.name}</Text>
                {s.area !== "" && <Text numberOfLines={1} style={[font("500 12px", "Plus Jakarta Sans"), { color: SOFT }]}>{s.area}</Text>}
              </View>
            </Pressable>
          ))}
        </View>
      )}
      {status && <Text accessibilityLiveRegion="polite" style={note}>{status}</Text>}
    </>
  );
}
