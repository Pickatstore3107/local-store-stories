import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { memo, useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { memoryPath, type WallMemory } from "@/lib/memories";
import { PAS, font } from "@/lib/pas";
import { DOUBLE_TAP_MS, HEART, sharePost, useAskToJoin, useFollowAuthor } from "./actions";
import { flash } from "./toast";
import { useLike } from "./use-likes";
import { useSave } from "./use-saved";

// A post under "Just shared" on Home, as the website's FeedPost in
// src/components/home/pas-home.tsx: who shared it and Follow, the photo (one
// tap opens the post, two like it), like, comment, share and save, then the
// store, where and when, and the memory in handwriting.

const RED = PAS.red, INK = PAS.ink, SOFT = PAS.soft;

export const areaOf = (m: Pick<WallMemory, "neighbourhood" | "city">) => m.neighbourhood ?? m.city;

export function openMemory(id: string) {
  router.push(memoryPath(id) as `/memories/${string}`);
}

export function IconButton({ label, pressed, onPress, children }: { label: string; pressed?: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={pressed === undefined ? undefined : { selected: pressed }}
      onPress={onPress}
      hitSlop={4}
      style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center" }}
    >
      {children}
    </Pressable>
  );
}

export function FollowPill({ text, quiet, busy, onPress }: { text: string; quiet: boolean; busy: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy}
      style={{
        height: 30,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: quiet ? PAS.border : RED,
        backgroundColor: quiet ? "transparent" : RED,
        justifyContent: "center",
      }}
    >
      <Text style={[font("700 12px", "Plus Jakarta Sans"), { color: quiet ? SOFT : "#fff" }]}>{text}</Text>
    </Pressable>
  );
}

/** The red circle with someone's first letter, or their approved photo. */
export function Avatar({ name, photo, size }: { name: string; photo: string | null; size: number }) {
  if (photo) {
    return <Image source={{ uri: photo }} accessibilityIgnoresInvertColors style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: RED, alignItems: "center", justifyContent: "center" }}>
      <Text style={[font(`700 ${Math.round(size * 0.41)}px`, "Plus Jakarta Sans"), { color: "#fff" }]}>{Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "?"}</Text>
    </View>
  );
}

export const FeedPost = memo(function FeedPost({ p, builtAt, onCount }: { p: WallMemory; builtAt: number; onCount: (id: string, n: number) => void }) {
  const { member, ask } = useAskToJoin();
  const like = useLike(p.id, p.likes, builtAt);
  const save = useSave(p.id);
  const lastTap = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onOpen = () => openMemory(p.id);

  const likes = like.count;
  // Tells Home the count shown, so "Most loved" follows a like at once.
  const report = useRef(onCount);
  useEffect(() => {
    report.current = onCount;
  });
  useEffect(() => {
    if (likes !== p.likes.count) report.current(p.id, likes);
  }, [p.id, p.likes.count, likes]);
  useEffect(() => () => clearTimeout(pending.current), []);
  useEffect(() => {
    if (like.error) flash(like.error);
  }, [like.error]);

  const liked = like.liked === true, saved = save.saved === true;
  const author = p.authorName ?? "A member";
  const fol = useFollowAuthor(p.authorId, author);
  const year = p.year;

  const onLike = () => {
    if (!member) return ask();
    void like.toggle();
  };
  const onSave = async () => {
    if (!member) return ask();
    if (save.saved === null || save.busy) return;
    const was = saved;
    await save.toggle();
    flash(was ? "Removed from Saved" : "Saved. Only you can see it.");
  };
  const onShare = () => sharePost(memoryPath(p.id), `A post about ${p.storeName}, ${p.city}`);
  // One tap opens the post; two taps like it.
  const onPhoto = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      clearTimeout(pending.current);
      lastTap.current = 0;
      if (!member) return ask();
      like.likeOnce();
      return;
    }
    lastTap.current = now;
    pending.current = setTimeout(onOpen, DOUBLE_TAP_MS);
  };

  const quiet = fol.mine || fol.following;
  return (
    <View style={{ paddingTop: 14, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: PAS.hairline }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingBottom: 10 }}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${author}'s profile`}
          onPress={() => router.push(`/people/${p.authorId}`)}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 }}
        >
          <Avatar name={author} photo={p.authorPhoto} size={34} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[font("700 13.5px", "Plus Jakarta Sans"), { color: INK }]}>{author}</Text>
            <Text numberOfLines={1} style={[font("500 11.5px", "Plus Jakarta Sans"), { color: SOFT }]}>{p.category}</Text>
          </View>
        </Pressable>
        <FollowPill text={fol.text} quiet={quiet} busy={fol.busy} onPress={fol.toggle} />
      </View>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={`${p.storeName}, ${areaOf(p)}. Opens the post; tap twice to like.`}
        onPress={onPhoto}
        style={{ marginHorizontal: 12, aspectRatio: 4 / 5, borderRadius: 16, overflow: "hidden", backgroundColor: PAS.inputFill }}
      >
        {p.postPhotoUrl && (
          <Image source={{ uri: p.postPhotoUrl }} contentFit="cover" transition={150} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        )}
        <LinearGradient
          colors={["transparent", "rgba(30,15,12,0.55)"]}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "45%" }}
        />
        {year !== null && (
          <Text style={[font("400 54px/0.9", "Anton"), { position: "absolute", left: 14, bottom: 10, color: "#fff" }]}>{year}</Text>
        )}
        {p.hasVideo && (
          <View style={{ position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(30,15,12,0.55)", alignItems: "center", justifyContent: "center" }}>
            <Svg viewBox="0 0 24 24" width={13} height={13} fill="#fff"><Path d="M8 5v14l11-7z" /></Svg>
          </View>
        )}
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 8, paddingHorizontal: 10 }}>
        <IconButton label="Like" pressed={liked} onPress={onLike}>
          <Svg viewBox="0 0 24 24" width={25} height={25} fill={liked ? RED : "none"} stroke={liked ? RED : INK} strokeWidth={1.8} strokeLinejoin="round"><Path d={HEART} /></Svg>
        </IconButton>
        <IconButton label="Comment" onPress={onOpen}>
          <Svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={INK} strokeWidth={1.8} strokeLinejoin="round"><Path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4.5 19.5l1.4-4.2A7.5 7.5 0 1 1 20 11.5Z" /></Svg>
        </IconButton>
        <IconButton label="Share" onPress={onShare}>
          <Svg viewBox="0 0 24 24" width={23} height={23} fill="none" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round"><Path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z" /></Svg>
        </IconButton>
        <View style={{ flex: 1 }} />
        <IconButton label="Save" pressed={saved} onPress={onSave}>
          <Svg viewBox="0 0 24 24" width={24} height={24} fill={saved ? INK : "none"} stroke={INK} strokeWidth={1.8} strokeLinejoin="round"><Path d="M6.5 4.5h11v15.5L12 16.2 6.5 20V4.5Z" /></Svg>
        </IconButton>
      </View>
      <View style={{ paddingHorizontal: 18, gap: 4 }}>
        <Text style={[font("700 12.5px", "Plus Jakarta Sans"), { color: INK }]}>
          {likes === 0 ? "Be the first to like this" : likes === 1 ? "1 like" : likes + " likes"}
        </Text>
        <Text accessibilityRole="link" onPress={onOpen} style={[font("600 22px/1.1", "Playfair Display"), { color: INK, marginTop: 2 }]}>
          {p.storeName}
        </Text>
        <Text style={[font("700 10.5px", "Plus Jakarta Sans"), { letterSpacing: 1.26, textTransform: "uppercase", color: RED }]}>
          {year ? areaOf(p) + " · " + year : areaOf(p)}
        </Text>
        <Text style={[font("400 18px/1.35", "Kalam"), { color: INK, marginTop: 4 }]}>{p.caption}</Text>
      </View>
    </View>
  );
});
