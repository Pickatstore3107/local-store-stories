import { FirebaseError } from "firebase/app";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { DOUBLE_TAP_MS, HEART, sharePost, useAskToJoin, useFollowAuthor } from "@/components/actions";
import { useAuth } from "@/components/auth-provider";
import { Comments } from "@/components/comments";
import { Avatar, FollowPill, IconButton, openMemory } from "@/components/feed-post";
import { LikersSheet } from "@/components/likers-sheet";
import { DoneNote, ReportForm } from "@/components/report-form";
import { flash } from "@/components/toast";
import { useLike } from "@/components/use-likes";
import { useSave } from "@/components/use-saved";
import { friendlyError } from "@/lib/auth-errors";
import { memoryPath, placeName, shortDate, type Memory, type WallMemory } from "@/lib/memories";
import { metresBetween } from "@/lib/nearby";
import { PAS, font } from "@/lib/pas";
import { hasReported, REPORT_REASONS, REPORTS_TO_HOLD, sendReport } from "@/lib/reports";
import { GRIEVANCE_EMAIL } from "@/lib/site";
import { loadMemory, useWall } from "@/lib/wall";

// A post's page, as the website's src/app/memories/[id]/memory-post.tsx:
// its photos full width to swipe through, then a white sheet over them with
// the year and store, how many years ago, who shared it, Like, Comment,
// Share and Save, the words, what they always ordered, a small map, more
// stories nearby, the comments and reporting.

const RED = PAS.red, INK = PAS.ink, SOFT = PAS.soft;

type Loaded = { status: "loading" } | { status: "found"; memory: Memory } | { status: "missing" } | { status: "error" };

export default function MemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [result, setResult] = useState<Loaded>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let current = true;
    setResult({ status: "loading" });
    loadMemory(id)
      .then((r) => current && setResult(r))
      .catch(() => current && setResult({ status: "error" }));
    return () => {
      current = false;
    };
  }, [id, attempt]);

  if (result.status === "found") return <Post memory={result.memory} />;
  return (
    <View style={{ flex: 1, backgroundColor: "#fff", paddingTop: insets.top }}>
      <View style={{ padding: 12 }}>
        <BackButton dark />
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        {result.status === "loading" ? (
          <ActivityIndicator color={RED} accessibilityLabel="Loading the post" />
        ) : (
          <>
            <Text accessibilityRole="alert" style={[font("500 15px", "Plus Jakarta Sans"), { color: SOFT, textAlign: "center" }]}>
              {result.status === "missing"
                ? "This post isn't here. It may have been deleted."
                : "This post couldn't be loaded just now. Please check your connection."}
            </Text>
            {result.status === "error" && (
              <Pressable accessibilityRole="button" onPress={() => setAttempt((n) => n + 1)} style={{ height: 42, paddingHorizontal: 20, borderRadius: 999, backgroundColor: RED, justifyContent: "center" }}>
                <Text style={[font("700 13.5px", "Plus Jakarta Sans"), { color: "#fff" }]}>Try again</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

function BackButton({ dark = false }: { dark?: boolean }) {
  const icon = (
    <Svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke={dark ? INK : "#fff"} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><Path d="M14.5 6 8.5 12l6 6" /></Svg>
  );
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} hitSlop={6} style={{ width: 42, height: 42, borderRadius: 21, overflow: "hidden" }}>
      {dark ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: PAS.inputFill }}>{icon}</View>
      ) : (
        <BlurView intensity={30} tint="light" style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.22)" }}>{icon}</BlurView>
      )}
    </Pressable>
  );
}

function Glass({ children, minWidth }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <BlurView intensity={30} tint="light" style={{ height: 30, minWidth, paddingHorizontal: 12, borderRadius: 999, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.22)" }}>
      {children}
    </BlurView>
  );
}

/** "More stories nearby": the five other posts with pins closest to this one's. */
function nearbyPosts(memory: Memory, all: WallMemory[]) {
  const others = all.filter((m) => m.id !== memory.id);
  const { pin } = memory;
  const ranked = pin
    ? others
        .filter((m) => m.pin)
        .map((m) => ({ m, d: metresBetween(pin, m.pin!) }))
        .sort((a, b) => a.d - b.d)
        .map(({ m }) => m)
    : [
        ...others.filter((m) => memory.neighbourhood && m.neighbourhood === memory.neighbourhood),
        ...others.filter((m) => !memory.neighbourhood || m.neighbourhood !== memory.neighbourhood),
      ];
  return ranked.slice(0, 5);
}

function VideoSlide({ url, poster, label }: { url: string; poster: string | null; label: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  return (
    <View style={{ flex: 1 }}>
      {poster && <Image source={{ uri: poster }} contentFit="cover" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
      <VideoView player={player} accessibilityLabel={label} nativeControls contentFit="cover" style={{ flex: 1 }} />
    </View>
  );
}

function Post({ memory }: { memory: Memory }) {
  const { member, ask } = useAskToJoin();
  const { wall } = useWall();
  const like = useLike(memory.id, memory.likes, memory.builtAt);
  const save = useSave(memory.id);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const authorName = memory.author?.name ?? "A member";
  const fol = useFollowAuthor(memory.author?.uid ?? null, authorName);
  const [slide, setSlide] = useState(0);
  const [likersOpen, setLikersOpen] = useState(false);
  const [burst, setBurst] = useState(false);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTap = useRef(0);
  const commentRef = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => () => clearTimeout(burstTimer.current), []);
  useEffect(() => {
    if (like.error) flash(like.error);
  }, [like.error]);

  const liked = like.liked === true, saved = save.saved === true;
  const likes = like.count;
  const slides: (string | null)[] = memory.videoUrl ? ["video"] : memory.photoUrls.length > 0 ? memory.photoUrls : [null];
  const area = memory.neighbourhood ?? memory.city;
  const yearsAgo = memory.year ? new Date(memory.builtAt).getFullYear() - memory.year : 0;
  const nearby = nearbyPosts(memory, wall?.memories ?? []);
  const photoHeight = (width * 5) / 4;

  const onLike = () => {
    if (!member) return ask();
    void like.toggle();
  };
  // Two taps on the photos like the post, with a big white heart.
  const onPhotos = () => {
    const now = Date.now();
    if (now - lastTap.current >= DOUBLE_TAP_MS) {
      lastTap.current = now;
      return;
    }
    lastTap.current = 0;
    if (!member) return ask();
    if (!liked) like.likeOnce();
    setBurst(true);
    clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBurst(false), 900);
  };
  const onSave = async () => {
    if (!member) return ask();
    if (save.saved === null || save.busy) return;
    const was = saved;
    await save.toggle();
    flash(was ? "Removed from Saved" : "Saved. Only you can see it.");
  };
  const quiet = fol.mine || fol.following;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#fff" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 34 }}>
        <View style={{ height: photoHeight, backgroundColor: INK }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            accessibilityLabel={slides.length > 1 ? `${slides.length} photos of ${memory.storeName}. Swipe to see more.` : `Photo of ${memory.storeName}`}
            onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {slides.map((url, i) =>
              url === "video" && memory.videoUrl ? (
                <View key="video" style={{ width, height: photoHeight }}>
                  <VideoSlide url={memory.videoUrl} poster={memory.photoUrl} label={`Video shared with the post about ${memory.storeName}`} />
                </View>
              ) : (
                <Pressable key={url ?? i} onPress={onPhotos} accessible={false} style={{ width, height: photoHeight }}>
                  {url && (
                    <Image
                      source={{ uri: url }}
                      contentFit="cover"
                      transition={150}
                      accessibilityLabel={slides.length > 1 ? `Photo ${i + 1} of ${slides.length} shared with the post about ${memory.storeName}` : `Photo shared with the post about ${memory.storeName}`}
                      style={{ width, height: photoHeight }}
                    />
                  )}
                </Pressable>
              ),
            )}
          </ScrollView>
          <LinearGradient pointerEvents="none" colors={["rgba(30,15,12,0.5)", "transparent"]} style={{ position: "absolute", left: 0, right: 0, top: 0, height: 150 + insets.top }} />
          <LinearGradient pointerEvents="none" colors={["transparent", "rgba(30,15,12,0.35)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120 }} />
          <View pointerEvents="none" style={{ position: "absolute", top: insets.top + 10, left: 14, right: 14, flexDirection: "row", gap: 4 }}>
            {slides.map((url, i) => (
              <View key={url ?? i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= slide ? "#fff" : "rgba(255,255,255,0.35)" }} />
            ))}
          </View>
          <View style={{ position: "absolute", top: insets.top + 24, left: 12, right: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <BackButton />
            <Glass>
              <Text style={[font("700 10.5px", "Plus Jakarta Sans"), { letterSpacing: 1.47, textTransform: "uppercase", color: "#fff" }]}>{memory.category}</Text>
            </Glass>
            <Glass minWidth={42}>
              <Text style={[font("700 12px", "Plus Jakarta Sans"), { color: "#fff" }]}>{slide + 1 + "/" + slides.length}</Text>
            </Glass>
          </View>
          {burst && (
            <View pointerEvents="none" style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -60, marginTop: -60 }}>
              <Svg viewBox="0 0 24 24" width={120} height={120}><Path fill="#fff" d={HEART} /></Svg>
            </View>
          )}
        </View>

        <View style={{ marginTop: -26, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: "#fff", paddingTop: 22, paddingHorizontal: 18, gap: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
              {memory.year !== null && <Text style={[font("400 76px/0.95", "Anton"), { color: RED }]}>{memory.year}</Text>}
              <Text accessibilityRole="header" style={[font("600 32px/1.05", "Playfair Display"), { textTransform: "uppercase", color: INK, marginTop: 4 }]}>{memory.storeName}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Image source={require("../../../assets/pas-pin.png")} style={{ width: 12, height: (12 * 405) / 300 }} />
                <Text style={[font("600 13px", "Plus Jakarta Sans"), { color: SOFT, flexShrink: 1 }]}>{placeName(memory)}</Text>
              </View>
            </View>
            {yearsAgo > 0 && (
              <View style={{ width: 86, height: 86, marginTop: 2, borderRadius: 43, borderWidth: 2, borderStyle: "dashed", borderColor: RED, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-10deg" }] }}>
                <Text style={[font("400 30px/1", "Anton"), { color: RED }]}>{yearsAgo}</Text>
                <Text style={[font("700 9px", "Plus Jakarta Sans"), { letterSpacing: 1.26, textTransform: "uppercase", color: RED }]}>years ago</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: 2, borderTopColor: INK, borderBottomWidth: 1, borderBottomColor: PAS.hairline }}>
            <Pressable
              accessibilityRole={memory.author ? "link" : undefined}
              disabled={!memory.author}
              onPress={() => memory.author && router.push(`/people/${memory.author.uid}`)}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 }}
            >
              <View style={{ padding: 2, borderRadius: 24, borderWidth: 2, borderColor: PAS.yellow }}>
                <Avatar name={authorName} photo={memory.author?.photo ?? null} size={40} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={[font("700 14px", "Plus Jakarta Sans"), { color: INK }]}>{authorName}</Text>
                <Text style={[font("500 12px", "Plus Jakarta Sans"), { color: SOFT }]}>Shared {shortDate(memory.sharedAt)}</Text>
              </View>
            </Pressable>
            {memory.author && <FollowPill text={fol.text} quiet={quiet} busy={fol.busy} onPress={fol.toggle} />}
          </View>

          <View style={{ gap: 2, marginTop: -8, marginHorizontal: -8 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <IconButton label="Like" pressed={liked} onPress={onLike}>
                <Svg viewBox="0 0 24 24" width={27} height={27} fill={liked ? RED : "none"} stroke={liked ? RED : INK} strokeWidth={1.8} strokeLinejoin="round"><Path d={HEART} /></Svg>
              </IconButton>
              <IconButton label="Comment" onPress={() => commentRef.current?.focus()}>
                <Svg viewBox="0 0 24 24" width={25} height={25} fill="none" stroke={INK} strokeWidth={1.8} strokeLinejoin="round"><Path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4.5 19.5l1.4-4.2A7.5 7.5 0 1 1 20 11.5Z" /></Svg>
              </IconButton>
              <IconButton label="Share" onPress={() => sharePost(memoryPath(memory.id), `A post about ${memory.storeName}, ${memory.city}`)}>
                <Svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round"><Path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z" /></Svg>
              </IconButton>
              <View style={{ flex: 1 }} />
              <IconButton label="Save" pressed={saved} onPress={onSave}>
                <Svg viewBox="0 0 24 24" width={25} height={25} fill={saved ? INK : "none"} stroke={INK} strokeWidth={1.8} strokeLinejoin="round"><Path d="M6.5 4.5h11v15.5L12 16.2 6.5 20V4.5Z" /></Svg>
              </IconButton>
            </View>
            {likes > 0 ? (
              <Text accessibilityRole="button" accessibilityHint="Shows who liked it" onPress={() => setLikersOpen(true)} style={[font("700 13px", "Plus Jakarta Sans"), { color: INK, paddingHorizontal: 10, alignSelf: "flex-start" }]}>
                {likes === 1 ? "1 like" : likes + " likes"}
              </Text>
            ) : (
              <Text style={[font("700 13px", "Plus Jakarta Sans"), { color: INK, paddingHorizontal: 10 }]}>Be the first to like this</Text>
            )}
          </View>

          <Text style={[font("400 23px/1.32", "Kalam"), { color: INK }]}>
            <Text style={{ color: RED }}>“</Text>
            {memory.caption}
            <Text style={{ color: RED }}>”</Text>
          </Text>

          {memory.ordered && (
            <View style={{ paddingVertical: 16, paddingHorizontal: 20, borderRadius: 14, backgroundColor: PAS.butter, gap: 4, transform: [{ rotate: "-1deg" }] }}>
              <View style={{ position: "absolute", left: -9, top: "50%", width: 18, height: 18, marginTop: 7, borderRadius: 9, backgroundColor: "#fff" }} />
              <View style={{ position: "absolute", right: -9, top: "50%", width: 18, height: 18, marginTop: 7, borderRadius: 9, backgroundColor: "#fff" }} />
              <Text style={[font("700 10px", "Plus Jakarta Sans"), { letterSpacing: 1.6, textTransform: "uppercase", color: PAS.deepRed }]}>What I always ordered</Text>
              <Text style={[font("400 20px/1.25", "Kalam"), { color: INK }]}>{memory.ordered}</Text>
            </View>
          )}

          {memory.pin && memory.visibility === "public" && (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`See ${memory.storeName} on the map`}
              onPress={() => router.push({ pathname: "/map", params: { memory: memory.id } })}
              style={{ height: 156, borderRadius: 18, overflow: "hidden", backgroundColor: PAS.miniMapPaper }}
            >
              <View style={{ position: "absolute", left: -30, right: -30, top: 92, height: 9, backgroundColor: PAS.butterRoad, transform: [{ rotate: "-9deg" }] }} />
              <View style={{ position: "absolute", left: 120, top: -20, bottom: -20, width: 9, backgroundColor: PAS.butterRoad, transform: [{ rotate: "12deg" }] }} />
              <View style={{ position: "absolute", right: -30, top: -20, width: 120, height: 80, borderRadius: 60, backgroundColor: PAS.miniMapWater }} />
              <Image source={require("../../../assets/pas-pin.png")} style={{ position: "absolute", left: "50%", top: 22, width: 40, height: (40 * 405) / 300, marginLeft: -20 }} />
              <View style={{ position: "absolute", left: 10, right: 10, bottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 8, paddingRight: 8, paddingLeft: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.94)" }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={[font("700 13px", "Plus Jakarta Sans"), { color: INK }]}>{memory.storeName}</Text>
                  <Text numberOfLines={1} style={[font("500 11.5px", "Plus Jakarta Sans"), { color: SOFT }]}>{area}</Text>
                </View>
                <View style={{ height: 32, paddingHorizontal: 14, borderRadius: 999, backgroundColor: RED, justifyContent: "center" }}>
                  <Text style={[font("700 12px", "Plus Jakarta Sans"), { color: "#fff" }]}>See on map</Text>
                </View>
              </View>
            </Pressable>
          )}

          {nearby.length > 0 && (
            <View style={{ gap: 12 }}>
              <Text accessibilityRole="header" style={[font("600 20px", "Playfair Display"), { color: INK }]}>More stories nearby</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -18 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 18 }}>
                {nearby.map((nb) => (
                  <Pressable key={nb.id} accessibilityRole="link" onPress={() => openMemory(nb.id)} style={{ width: 128, gap: 6 }}>
                    <View style={{ aspectRatio: 4 / 5, borderRadius: 14, overflow: "hidden", backgroundColor: PAS.inputFill }}>
                      {nb.postPhotoUrl && <Image source={{ uri: nb.postPhotoUrl }} contentFit="cover" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
                      {nb.year !== null && <Text style={[font("400 26px/1", "Anton"), { position: "absolute", left: 8, bottom: 4, color: "#fff", textShadowColor: "rgba(0,0,0,0.25)", textShadowRadius: 8 }]}>{nb.year}</Text>}
                    </View>
                    <Text numberOfLines={2} style={[font("600 14px/1.15", "Playfair Display"), { color: INK }]}>{nb.storeName}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <Comments storyId={memory.id} storyAuthorId={memory.author?.uid ?? null} comments={memory.comments} inputRef={commentRef} />

          <ReportPost id={memory.id} onOpen={() => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100)} />
        </View>
      </ScrollView>

      {likersOpen && <LikersSheet storyId={memory.id} privateLoves={memory.likes.privateLoves} onClose={() => setLikersOpen(false)} />}
    </KeyboardAvoidingView>
  );
}

/** Reporting the post, under its comments, as the website's memory-actions.tsx. */
function ReportPost({ id, onOpen }: { id: string; onOpen: () => void }) {
  const { user, consent } = useAuth();
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState<boolean | null>(null);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!open || !user || !consent) return;
    let current = true;
    hasReported(user, id)
      .then((yes) => current && setReported(yes))
      .catch(() => current && setReported(false));
    return () => {
      current = false;
    };
  }, [open, user, consent, id]);

  const email = () =>
    Linking.openURL(`mailto:${GRIEVANCE_EMAIL}?subject=${encodeURIComponent("Report a post")}&body=${encodeURIComponent(`About ${memoryPath(id)}:\n\n`)}`);
  const emailLink = (
    <Text accessibilityRole="link" onPress={email} style={{ color: RED, textDecorationLine: "underline" }}>{GRIEVANCE_EMAIL}</Text>
  );
  const body = [font("400 13.5px/1.45", "Plus Jakarta Sans"), { color: INK }];

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setOpen(true);
          onOpen();
        }}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 6 }}
      >
        <Svg viewBox="0 0 20 20" width={16} height={16} fill="none"><Path d="M4.5 17.5v-14m0 0h9l-2 3.5 2 3.5h-9" stroke={SOFT} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>
        <Text style={[font("600 11.5px", "Plus Jakarta Sans"), { color: SOFT }]}>Report this post</Text>
      </Pressable>
    );
  }
  if (!user || !consent) {
    return (
      <Text style={body}>
        <Text accessibilityRole="link" onPress={() => router.push(user ? "/welcome" : "/signin")} style={{ color: RED, fontFamily: "PlusJakartaSans_700Bold", textDecorationLine: "underline" }}>
          {user ? "Finish joining to report it" : "Sign in to report it"}
        </Text>
        , or email {emailLink} and tell us what&apos;s wrong. You don&apos;t need an account to write to us.
      </Text>
    );
  }
  if (reported === null) return <ActivityIndicator color={RED} />;
  if (reported) {
    return (
      <DoneNote>
        {held
          ? "Thank you. Others reported this post too, so it's off the site until a moderator checks it."
          : `Thank you. A moderator will look at your report. If ${REPORTS_TO_HOLD} people report a post, it comes down until they check it.`}
      </DoneNote>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <ReportForm
        title="Report this post"
        note="A moderator will read your report. Only moderators can see who sent it."
        reasons={REPORT_REASONS}
        onCancel={() => setOpen(false)}
        onSend={async (reason, details) => {
          try {
            setHeld(await sendReport(user, id, reason, details));
            setReported(true);
          } catch (e) {
            throw new Error(
              e instanceof FirebaseError && e.code === "permission-denied"
                ? `This post can't be reported right now. It may already have been taken down. If you can still see it, please email ${GRIEVANCE_EMAIL}.`
                : friendlyError(e),
            );
          }
        }}
      />
      <Text style={[font("400 12px", "Plus Jakarta Sans"), { color: SOFT }]}>Is it about you, your photo or your store? You can also email {emailLink}.</Text>
    </View>
  );
}
