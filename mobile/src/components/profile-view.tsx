import * as Clipboard from "expo-clipboard";
import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Share, Text, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { friendlyError } from "@/lib/auth-errors";
import { block } from "@/lib/follows";
import { invitePath } from "@/lib/invite-links";
import { loadInvite, makeInvite, type MemoryInvite } from "@/lib/invites";
import { memoryPath } from "@/lib/memories";
import { PAS, font } from "@/lib/pas";
import { initial, personPath, type PublicPerson } from "@/lib/people";
import { mapPath, type Pin } from "@/lib/pins";
import { PROFILE_REPORT_REASONS, reportProfile } from "@/lib/profiles";
import { SITE } from "@/lib/site";
import { dayOf, streakOf } from "@/lib/streak";
import { deleteStory, loadMyStories, setStoryPin, type MyStory, type StoryStatus, type Visibility } from "@/lib/stories";
import { refreshWall } from "@/lib/wall";
import { sharePost, useFollowAuthor } from "./actions";
import { useAuth } from "./auth-provider";
import { openMemory } from "./feed-post";
import { PinPicker } from "./pin-picker";
import { DoneNote, ReportForm } from "./report-form";
import { useMyFollows } from "./use-my-follows";

// The prototype's Me screen, for anyone's profile, as the website's
// src/app/people/[uid]/: photo, name, city and streak, the bio, posts,
// followers and following, Follow and Share (or Edit profile and Invite
// friends on your own), the posts, and on your own, Manage my posts.

const RED = PAS.red, INK = PAS.ink, SOFT = PAS.soft;
const caps = [font("700 10px", "Plus Jakarta Sans"), { letterSpacing: 1.4, textTransform: "uppercase" as const, color: SOFT }];
const greyButton = { flex: 1, height: 40, borderRadius: 999, backgroundColor: PAS.inputFill, alignItems: "center" as const, justifyContent: "center" as const };
const greyLabel = [font("700 13px", "Plus Jakarta Sans"), { color: INK }];
const note = [font("500 12px/1.5", "Plus Jakarta Sans"), { color: SOFT }];
const quiet = [font("600 11.5px", "Plus Jakarta Sans"), { color: SOFT }];
const link = [font("700 12.5px", "Plus Jakarta Sans"), { color: RED, textDecorationLine: "underline" as const }];

function StreakBadge({ sharedAt }: { sharedAt: number[] }) {
  const { days } = streakOf(sharedAt, dayOf(Date.now()));
  if (days === 0) return null;
  return (
    <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, height: 24, paddingHorizontal: 10, borderRadius: 999, backgroundColor: PAS.yellow }}>
      <Svg viewBox="0 0 24 24" width={13} height={13}><Path d="M12 21c-3.6 0-6.5-2.6-6.5-6.2 0-3.3 2.4-5.3 3.6-7.8.4 1.7 1.3 2.8 2.4 3.4C11.9 7.6 13 5 15.2 3c-.2 2.6.9 4.4 2 6 .9 1.4 1.3 2.7 1.3 4.2 0 4.6-2.9 7.8-6.5 7.8Z" fill={RED} /></Svg>
      <Text style={[font("700 11.5px", "Plus Jakarta Sans"), { color: INK }]}>{days}-day streak</Text>
    </View>
  );
}

export function ProfileView({ uid, person, onChanged }: { uid: string; person: PublicPerson; onChanged: () => void }) {
  const { width } = useWindowDimensions();
  const photo = person.photo?.large;
  const tile = (width - 4) / 3;
  return (
    <View style={{ paddingTop: 14, paddingBottom: 26 }}>
      <View style={{ flexDirection: "row", gap: 16, alignItems: "center", paddingHorizontal: 18 }}>
        <View style={{ padding: 3, borderRadius: 48, borderWidth: 3, borderColor: PAS.yellow }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: RED, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <Text style={[font("600 34px", "Playfair Display"), { color: "#fff" }]}>{initial(person.name)}</Text>
            {photo && <Image source={{ uri: photo }} contentFit="cover" accessibilityIgnoresInvertColors style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
          </View>
        </View>
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <Text accessibilityRole="header" style={[font("600 25px/1.1", "Playfair Display"), { color: INK }]}>{person.name}</Text>
          {person.city && <Text style={[font("500 13px", "Plus Jakarta Sans"), { color: SOFT }]}>{person.city}</Text>}
          <StreakBadge sharedAt={person.memories.map((m) => m.sharedAt)} />
        </View>
      </View>
      {person.bio && <Text style={[font("400 14px/1.45", "Plus Jakarta Sans"), { color: INK, marginTop: 14, marginHorizontal: 18 }]}>{person.bio}</Text>}

      <View style={{ flexDirection: "row", marginTop: 16, marginHorizontal: 18, borderTopWidth: 2, borderBottomWidth: 2, borderColor: INK }}>
        <View style={{ flex: 1, paddingVertical: 12, gap: 2 }}>
          <Text style={[font("400 32px/1.05", "Anton"), { color: RED }]}>{person.memories.length}</Text>
          <Text style={caps}>Posts</Text>
        </View>
        {(["followers", "following"] as const).map((kind) => (
          <Pressable key={kind} accessibilityRole="link" onPress={() => router.push({ pathname: "/people/[uid]/[kind]", params: { uid, kind } })} style={{ flex: 1, paddingVertical: 12, paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: PAS.border, gap: 2 }}>
            <Text style={[font("400 32px/1.05", "Anton"), { color: INK }]}>{person[kind]}</Text>
            <Text style={caps}>{kind === "followers" ? "Followers" : "Following"}</Text>
          </Pressable>
        ))}
      </View>

      <ProfileActions uid={uid} name={person.name} onChanged={onChanged} />

      <View style={{ flexDirection: "row", marginTop: 18, borderBottomWidth: 1, borderBottomColor: PAS.hairline }}>
        <View style={{ flex: 1, height: 44, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: INK, marginBottom: -1 }}>
          <Text style={[font("700 13px", "Plus Jakarta Sans"), { color: INK }]}>Posts</Text>
        </View>
        <Pressable accessibilityRole="link" onPress={() => router.navigate("/map")} style={{ flex: 1, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Text style={[font("600 13px", "Plus Jakarta Sans"), { color: SOFT }]}>On the map</Text>
        </Pressable>
      </View>

      {person.memories.length === 0 ? (
        <Text style={[font("500 13px", "Plus Jakarta Sans"), { color: SOFT, paddingTop: 20, paddingHorizontal: 18 }]}>No posts shared with everyone yet.</Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 2, paddingTop: 2 }}>
          {person.memories.map((memory) => (
            <Pressable key={memory.id} accessibilityRole="link" accessibilityLabel={memory.storeName} onPress={() => openMemory(memory.id)} style={{ width: tile, height: (tile * 5) / 4, backgroundColor: PAS.inputFill }}>
              {memory.photoUrl && <Image source={{ uri: memory.photoUrl }} contentFit="cover" style={{ width: "100%", height: "100%" }} />}
            </Pressable>
          ))}
        </View>
      )}

      <OwnerSection uid={uid} />
    </View>
  );
}

/**
 * The prototype's two buttons: Edit profile and Invite friends on your own
 * profile; Follow and Share on someone else's, with Block and Report under.
 */
function ProfileActions({ uid, name, onChanged }: { uid: string; name: string; onChanged: () => void }) {
  const { loading, user, consent } = useAuth();
  const { blocked } = useMyFollows();
  const fol = useFollowAuthor(uid, name);
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const share = () => sharePost(personPath(uid), `${name} on Local Stores & Their Stories`);
  const row = { flexDirection: "row" as const, gap: 8, paddingTop: 14, paddingHorizontal: 18 };

  if (loading) return <View style={{ height: 54 }} />;
  if (user?.uid === uid) {
    return (
      <View style={{ paddingHorizontal: 18, paddingTop: 14, gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={() => router.push("/account")} style={greyButton}><Text style={greyLabel}>Edit profile</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={share} style={greyButton}><Text style={greyLabel}>Invite friends</Text></Pressable>
        </View>
        <Text style={note}>Anyone can see your profile, your followers and who you follow.</Text>
      </View>
    );
  }

  const member = user && consent ? user : null;
  const isBlocked = blocked.has(uid);
  async function blockThem() {
    if (!member) return;
    setError(null);
    setBusy(true);
    try {
      await block(member, uid);
      setConfirming(false);
      onChanged(); // the follower counts
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={row}>
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            await fol.toggle();
            onChanged();
          }}
          disabled={fol.busy}
          style={[greyButton, !fol.following && { backgroundColor: RED }]}
        >
          <Text style={[greyLabel, !fol.following && { color: "#fff" }]}>{fol.text}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={share} style={greyButton}><Text style={greyLabel}>Share</Text></Pressable>
      </View>
      <View style={{ paddingHorizontal: 18, gap: 10 }}>
        <Text style={note}>{isBlocked ? `You blocked ${name}. They can't follow you, and they weren't told.` : "Anyone can see who you follow."}</Text>
        {member && !confirming && !reporting && !reported && (
          <View style={{ flexDirection: "row", gap: 16 }}>
            {!isBlocked && <Text accessibilityRole="button" onPress={() => setConfirming(true)} style={quiet}>Block</Text>}
            <Text accessibilityRole="button" onPress={() => setReporting(true)} style={quiet}>Report</Text>
          </View>
        )}
        {reported && <DoneNote>{`Thank you. A moderator will look at ${name}'s profile. They won't be told who reported it.`}</DoneNote>}
        {member && reporting && (
          <ReportForm
            title="What's wrong with this profile?"
            note="Only moderators see who reported it."
            reasons={PROFILE_REPORT_REASONS}
            onCancel={() => setReporting(false)}
            onSend={async (reason, details) => {
              try {
                await reportProfile(member, uid, reason, details);
                setReporting(false);
                setReported(true);
              } catch (e) {
                throw new Error(
                  e instanceof FirebaseError && e.code === "permission-denied"
                    ? "You've already reported this profile. A moderator will look at it."
                    : friendlyError(e),
                );
              }
            }}
          />
        )}
        {member && !isBlocked && confirming && (
          <View style={{ gap: 10 }}>
            <Text style={[font("500 13px/1.45", "Plus Jakarta Sans"), { color: INK }]}>
              <Text style={{ fontFamily: "PlusJakartaSans_700Bold" }}>Block {name}?</Text> You&apos;ll stop following each other, and they won&apos;t be able to follow you. They won&apos;t be told.
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable accessibilityRole="button" onPress={blockThem} disabled={busy} style={[greyButton, { backgroundColor: RED }]}>
                <Text style={[greyLabel, { color: "#fff" }]}>{busy ? "Blocking…" : "Block"}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setConfirming(false)} style={greyButton}><Text style={greyLabel}>Cancel</Text></Pressable>
            </View>
          </View>
        )}
        {error && <Text accessibilityRole="alert" style={[note, { color: PAS.deepRed }]}>{error}</Text>}
      </View>
    </View>
  );
}

/** Only on your own profile: Manage my posts, which opens every post you shared. */
function OwnerSection({ uid }: { uid: string }) {
  const { user, consent } = useAuth();
  const [managing, setManaging] = useState(false);
  if (!user || !consent || user.uid !== uid) return null;
  return (
    <View style={{ paddingTop: 20, paddingHorizontal: 18, gap: 2 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: managing }} onPress={() => setManaging(!managing)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: PAS.hairline }}>
        <Text style={[font("700 14px", "Plus Jakarta Sans"), { color: INK }]}>Manage my posts</Text>
        <Text style={[font("600 18px", "Plus Jakarta Sans"), { color: SOFT, transform: [{ rotate: managing ? "90deg" : "0deg" }] }]}>›</Text>
      </Pressable>
      {managing && <MyStories user={user} />}
    </View>
  );
}

const statusLabels: Record<StoryStatus, string> = {
  pending: "Waiting for review",
  approved: "On Home",
  rejected: "Not approved",
  hidden: "Hidden by a moderator",
};

function statusLabel(story: MyStory) {
  if (story.status === "approved" && story.visibility === "link") return "Shared by link";
  if (story.status === "pending" && story.reportCount) return "Held for a moderator to check";
  return statusLabels[story.status];
}

function reactions(story: { likeCount?: number; reactionCount?: number; commentCount?: number }) {
  const likes = (story.likeCount ?? 0) + (story.reactionCount ?? 0);
  const comments = story.commentCount ?? 0;
  const parts = [
    likes ? (likes === 1 ? "1 like" : `${likes} likes`) : null,
    comments ? (comments === 1 ? "1 comment" : `${comments} comments`) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

const samePin = (a: Pin | null, b: Pin | null) => a?.row === b?.row && a?.col === b?.col;

/** Every post you shared, as the website's my-stories.tsx. Only you see this. */
function MyStories({ user }: { user: User }) {
  const [stories, setStories] = useState<MyStory[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [passing, setPassing] = useState<string | null>(null);
  const [pinning, setPinning] = useState<{ id: string; pin: Pin | null } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    loadMyStories(user)
      .then((list) => current && setStories(list))
      .catch((e) => {
        if (!current) return;
        setStories([]);
        setError(friendlyError(e));
      });
    return () => {
      current = false;
    };
  }, [user]);

  async function savePin(story: MyStory, pin: Pin | null) {
    setError(null);
    setBusy(true);
    try {
      await setStoryPin(user, story, pin);
      setStories((list) => list?.map((s) => (s.id === story.id ? { ...s, pin: pin ?? undefined } : s)) ?? null);
      setPinning(null);
      void refreshWall(true);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(story: MyStory) {
    setError(null);
    setBusy(true);
    try {
      await deleteStory(user, story);
      setStories((list) => list?.filter((s) => s.id !== story.id) ?? null);
      setConfirming(null);
      void refreshWall(true);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ paddingVertical: 12, gap: 16 }}>
      <Text style={[font("400 13px", "Plus Jakarta Sans"), { color: SOFT }]}>
        Only you can see this part: posts shared by link, any held for a moderator to check, and everyone&apos;s invite links.
      </Text>
      {stories === null ? (
        <Text style={note}>Loading…</Text>
      ) : stories.length === 0 ? (
        <Text style={note}>You haven&apos;t shared a post yet. Which store do you still think about?</Text>
      ) : (
        stories.map((story) => (
          <View key={story.id} style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 14 }}>
              <View style={{ width: 80, height: 80, borderRadius: 12, overflow: "hidden", backgroundColor: PAS.inputFill }}>
                {story.thumbUrl && <Image source={{ uri: story.thumbUrl }} contentFit="cover" style={{ width: 80, height: 80 }} />}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text numberOfLines={1} style={[font("700 14px", "Plus Jakarta Sans"), { color: INK }]}>{story.storeName}</Text>
                <Text numberOfLines={1} style={[font("400 13px", "Plus Jakarta Sans"), { color: SOFT }]}>
                  {[story.neighbourhood, story.city].filter(Boolean).join(", ")} · {story.category}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <Text style={[font("700 11px", "Plus Jakarta Sans"), { color: story.status === "approved" ? "#14532D" : story.status === "pending" ? INK : PAS.deepRed, backgroundColor: story.status === "approved" ? "#DCFCE7" : story.status === "pending" ? PAS.butterLight : "#FBE9E9", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" }]}>
                    {statusLabel(story)}
                  </Text>
                  {story.pin && (
                    <Text style={[font("700 11px", "Plus Jakarta Sans"), { color: INK, backgroundColor: PAS.inputFill, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" }]}>
                      {story.status === "approved" && story.visibility === "public" ? "On the map" : "Pinned"}
                    </Text>
                  )}
                  {story.status === "approved" && reactions(story) && <Text style={[font("400 11.5px", "Plus Jakarta Sans"), { color: SOFT }]}>{reactions(story)}</Text>}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6, marginTop: 2 }}>
                  {(story.status === "pending" || story.status === "approved") && (
                    <>
                      <Text accessibilityRole="button" onPress={() => setPassing(passing === story.id ? null : story.id)} style={link}>Pass it on</Text>
                      <Text accessibilityRole="button" onPress={() => setPinning(pinning?.id === story.id ? null : { id: story.id, pin: story.pin ?? null })} style={link}>
                        {story.pin ? "Move pin" : "Put on the map"}
                      </Text>
                    </>
                  )}
                  {story.status === "approved" && (
                    <>
                      <Text accessibilityRole="link" onPress={() => openMemory(story.id)} style={link}>Open</Text>
                      <Text
                        accessibilityRole="button"
                        onPress={async () => {
                          await Clipboard.setStringAsync(`${SITE}${memoryPath(story.id)}`);
                          setCopied(story.id);
                        }}
                        style={link}
                      >
                        {copied === story.id ? "Link copied" : "Copy link"}
                      </Text>
                    </>
                  )}
                  {confirming === story.id ? (
                    <>
                      <Text accessibilityRole="button" onPress={busy ? undefined : () => remove(story)} style={link}>{busy ? "Deleting…" : "Yes, delete it"}</Text>
                      <Text accessibilityRole="button" onPress={() => setConfirming(null)} style={[link, { color: SOFT }]}>Keep it</Text>
                    </>
                  ) : (
                    <Text accessibilityRole="button" onPress={() => setConfirming(story.id)} style={[link, { color: SOFT }]}>Delete</Text>
                  )}
                </View>
                {story.reviewNote && story.status !== "approved" && (
                  <Text style={[font("400 13px", "Plus Jakarta Sans"), { color: INK }]}>
                    <Text style={{ fontFamily: "PlusJakartaSans_700Bold" }}>From the moderator:</Text> {story.reviewNote}
                  </Text>
                )}
              </View>
            </View>
            {pinning?.id === story.id && (
              <View style={{ borderRadius: 16, backgroundColor: PAS.mapPaper, padding: 12, gap: 10 }}>
                <PinPicker value={pinning.pin} onChange={(pin) => setPinning({ id: story.id, pin })} neighbourhood={story.neighbourhood} />
                <Text style={note}>
                  {story.visibility === "public"
                    ? "The map shows posts shared with everyone."
                    : "This post is shared by link, so it won't show on the map. The pin is kept in case you share it with everyone later."}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy || samePin(pinning.pin, story.pin ?? null)}
                    onPress={() => savePin(story, pinning.pin)}
                    style={{ height: 38, paddingHorizontal: 16, borderRadius: 999, backgroundColor: RED, justifyContent: "center", opacity: busy || samePin(pinning.pin, story.pin ?? null) ? 0.5 : 1 }}
                  >
                    <Text style={[font("700 13px", "Plus Jakarta Sans"), { color: "#fff" }]}>{busy ? "Saving…" : pinning.pin || !story.pin ? "Save pin" : "Take it off the map"}</Text>
                  </Pressable>
                  <Text accessibilityRole="button" onPress={() => setPinning(null)} style={[link, { color: SOFT }]}>Cancel</Text>
                  {story.pin && story.status === "approved" && story.visibility === "public" && (
                    <Text accessibilityRole="link" onPress={() => router.navigate(mapPath(story.id) as "/map")} style={link}>See it on the map</Text>
                  )}
                </View>
              </View>
            )}
            {passing === story.id && <PassItOn user={user} storyId={story.id} storeName={story.storeName} visibility={story.visibility} />}
          </View>
        ))
      )}
      {error && <Text accessibilityRole="alert" style={[note, { color: PAS.deepRed }]}>{error}</Text>}
    </View>
  );
}

/** "Priya, Asha and 3 more", with "a friend" for anyone whose name can't be read. */
function names(joined: (string | null)[]) {
  const shown = joined.slice(0, 3).map((name) => name ?? "a friend");
  const more = joined.length - shown.length;
  const list =
    more > 0
      ? `${shown.join(", ")} and ${more} more`
      : shown.length > 1
        ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`
        : shown[0];
  return list.charAt(0).toUpperCase() + list.slice(1);
}

/** "Pass the memory", as the website's pass-the-memory.tsx: the post's invite link, to send to friends. */
function PassItOn({ user, storyId, storeName, visibility }: { user: User; storyId: string; storeName: string; visibility: Visibility }) {
  const [invite, setInvite] = useState<MemoryInvite | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let current = true;
    loadInvite(user, storyId)
      .then((found) => current && setInvite(found))
      .catch((e) => {
        if (!current) return;
        setInvite(null);
        setError(friendlyError(e));
      });
    return () => {
      current = false;
    };
  }, [user, storyId]);

  async function getLink() {
    setError(null);
    setBusy(true);
    try {
      setInvite(await makeInvite(user, storyId, visibility));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const url = invite ? `${SITE}${invitePath(invite.code)}` : "";
  const message = `I shared a post about ${storeName} on Local Stores & Their Stories. Which store do you never forget? Share yours here: ${url}`;

  return (
    <View style={{ borderRadius: 16, backgroundColor: PAS.butterLight, padding: 16, gap: 10 }}>
      <Text accessibilityRole="header" style={[font("700 22px", "Kalam"), { color: INK }]}>Pass it on</Text>
      <Text style={[font("400 13px/1.45", "Plus Jakarta Sans"), { color: SOFT }]}>
        Send your invite link to friends so they can share a store they never forgot, and they can pass it on too. You&apos;ll see everyone who joins through it, and they&apos;ll follow you.
        {visibility === "link" && " Anyone with the link can also see this post, even though it isn't on Home."}
      </Text>
      {invite === undefined ? (
        <Text style={note}>Loading…</Text>
      ) : invite === null ? (
        <Pressable accessibilityRole="button" onPress={getLink} disabled={busy} style={{ height: 42, borderRadius: 999, backgroundColor: RED, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}>
          <Text style={[font("700 13.5px", "Plus Jakarta Sans"), { color: "#fff" }]}>{busy ? "Making your link…" : "Get my invite link"}</Text>
        </Pressable>
      ) : (
        <View style={{ borderRadius: 12, backgroundColor: "#fff", padding: 12, gap: 6 }}>
          <Text style={[font("700 13px", "Plus Jakarta Sans"), { color: INK }]}>Your invite link</Text>
          <Text selectable style={[font("400 13px", "Plus Jakarta Sans"), { color: INK }]}>{url}</Text>
          <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
            <Text accessibilityRole="button" onPress={() => Share.share({ message }).catch(() => {})} style={link}>Send</Text>
            <Text
              accessibilityRole="button"
              onPress={async () => {
                await Clipboard.setStringAsync(url);
                setCopied(true);
              }}
              style={link}
            >
              {copied ? "Link copied" : "Copy link"}
            </Text>
          </View>
          {invite.joined && (
            <Text style={[font("400 13px", "Plus Jakarta Sans"), { color: invite.joined.length ? "#14532D" : SOFT, marginTop: 4 }]}>
              {invite.joined.length ? `${names(invite.joined)} joined through your link.` : "No one has joined through it yet."}
            </Text>
          )}
        </View>
      )}
      {error && <Text accessibilityRole="alert" style={[note, { color: PAS.deepRed }]}>{error}</Text>}
    </View>
  );
}
