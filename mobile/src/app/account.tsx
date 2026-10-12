import { signOut } from "firebase/auth";
import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFollowAuthor } from "@/components/actions";
import { useAuth } from "@/components/auth-provider";
import { Avatar, FollowPill } from "@/components/feed-post";
import { ErrorNote, Field, Label, RedButton } from "@/components/form";
import { PhoneHeader } from "@/components/phone-header";
import { useMyFollows } from "@/components/use-my-follows";
import { CITY_MAX, CITY_MIN, NAME_MAX, deleteAccount, signedInRecently, updateProfile } from "@/lib/account";
import { friendlyError } from "@/lib/auth-errors";
import { firebase } from "@/lib/firebase";
import { refreshPeople } from "@/lib/follows";
import { nameOf } from "@/lib/invites";
import { AVATAR_FRAME, pickPhotos } from "@/lib/media";
import { PAS, font } from "@/lib/pas";
import { photoOf } from "@/lib/people";
import { BIO_MAX, askForPhotoCheck, bioProblem, cancelPhotoCheck, loadMyPhotoReview, removeMyPhoto, type PhotoReview } from "@/lib/profiles";
import { SITE } from "@/lib/site";
import { refreshWall } from "@/lib/wall";

// Profile and settings, as the website's src/app/account/: what's shown
// publicly (photo, name, city, bio), how you're signed in, the people you
// blocked, and deleting your account.

const INK = PAS.ink, SOFT = PAS.soft, RED = PAS.red;
const card = { borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: PAS.hairline, padding: 18, gap: 10 };
const h2 = [font("600 13px", "Plus Jakarta Sans"), { color: SOFT }];
const link = [font("700 13.5px", "Plus Jakarta Sans"), { color: RED, textDecorationLine: "underline" as const }];
const body = [font("400 13.5px/1.45", "Plus Jakarta Sans"), { color: SOFT }];

// Set before asking someone to sign in again, so the delete step reopens after.
let pendingDelete = false;

function Secondary({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={{ height: 46, borderRadius: 999, borderWidth: 1.5, borderColor: PAS.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, opacity: disabled ? 0.5 : 1 }}>
      <Text style={[font("700 14px", "Plus Jakarta Sans"), { color: INK }]}>{label}</Text>
    </Pressable>
  );
}

export default function Account() {
  const { user, profile, consent, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(pendingDelete);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pendingDelete = false;
  }, []);

  if (!user) return <Redirect href="/signin" />;
  if (!consent || !profile) return <Redirect href="/welcome" />;

  async function save() {
    if (!user) return;
    const name = displayName.trim();
    const place = city.trim();
    if (!name || name.length > NAME_MAX || place.length < CITY_MIN || place.length > CITY_MAX) {
      setError("Please enter a name and a city.");
      return;
    }
    const problem = bioProblem(bio);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await updateProfile(user.uid, { displayName: name, city: place, bio });
      await refreshPeople(user, [user.uid]);
      await refresh();
      setEditing(false);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function signOutNow() {
    await signOut(firebase.auth);
    router.replace("/signin");
  }

  async function signInAgainToDelete() {
    pendingDelete = true;
    await signOut(firebase.auth);
    router.replace("/signin");
  }

  async function deleteEverything() {
    if (!user) return;
    setError(null);
    setBusy(true);
    try {
      await deleteAccount(user);
      void refreshWall(true);
      router.replace("/signin");
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: PAS.backdrop }}>
      <PhoneHeader back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30, gap: 16 }}>
          <Text accessibilityRole="header" style={[font("600 28px", "Playfair Display"), { color: INK }]}>Profile and settings</Text>

          <View style={card}>
            <Text style={h2}>Shown publicly</Text>
            <ProfilePhoto />
            {editing ? (
              <View style={{ gap: 4, marginTop: 6 }}>
                <Label>Name</Label>
                <Field value={displayName} maxLength={NAME_MAX} onChangeText={setDisplayName} accessibilityLabel="Name" />
                <View style={{ height: 10 }} />
                <Label>City</Label>
                <Field value={city} maxLength={CITY_MAX} onChangeText={setCity} accessibilityLabel="City" />
                <View style={{ height: 10 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Label>Bio (if you like)</Label>
                  <Text accessibilityLiveRegion="polite" style={[font(`${bio.trim().length > BIO_MAX ? 700 : 400} 12.5px`, "Plus Jakarta Sans"), { color: bio.trim().length > BIO_MAX ? RED : SOFT }]}>
                    {bio.trim().length}/{BIO_MAX}
                  </Text>
                </View>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  maxLength={BIO_MAX + 20}
                  accessibilityLabel="Bio"
                  placeholder="A line about you, like the shops you grew up with"
                  placeholderTextColor={PAS.placeholder}
                  style={[font("500 14px", "Plus Jakarta Sans"), { minHeight: 80, borderRadius: 16, backgroundColor: PAS.inputFill, padding: 14, color: INK, textAlignVertical: "top" }]}
                />
                <Text style={[font("400 12.5px", "Plus Jakarta Sans"), { color: SOFT, marginTop: 4 }]}>Anyone can see it. No links, please.</Text>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <RedButton label={busy ? "Saving…" : "Save"} onPress={save} disabled={busy} />
                  </View>
                  <Secondary
                    label="Cancel"
                    onPress={() => {
                      setEditing(false);
                      setDisplayName(profile.displayName);
                      setCity(profile.city);
                      setBio(profile.bio ?? "");
                      setError(null);
                    }}
                  />
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginTop: 6 }}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={[font("700 18px", "Plus Jakarta Sans"), { color: INK }]}>{profile.displayName}</Text>
                  <Text style={[font("400 14px", "Plus Jakarta Sans"), { color: SOFT }]}>{profile.city}</Text>
                  <Text style={[font("400 14px", "Plus Jakarta Sans"), { color: profile.bio ? INK : SOFT, marginTop: 6 }]}>{profile.bio ?? "No bio yet."}</Text>
                </View>
                <Text accessibilityRole="button" onPress={() => setEditing(true)} style={link}>Edit</Text>
              </View>
            )}
            <Text style={[h2, { marginTop: 14 }]}>Private, only you can see this</Text>
            <Text style={[font("400 14px", "Plus Jakarta Sans"), { color: INK }]}>Signed in with {user.email ?? "your Google account"}</Text>
            <View style={{ marginTop: 8 }}>
              <Secondary label="Sign out" onPress={signOutNow} />
            </View>
          </View>

          <BlockedPeople />

          <View style={card}>
            <Text style={[font("700 16px", "Plus Jakarta Sans"), { color: INK }]}>Delete my account</Text>
            <Text style={body}>
              This permanently removes your profile and profile photo, your posts and photos, your likes and comments, your invite links, who you follow and who follows you, the people you blocked, the posts you loved, the reports you sent, your consent record and your sign-in. It cannot be undone.
            </Text>
            {!confirmingDelete ? (
              <Text accessibilityRole="button" onPress={() => setConfirmingDelete(true)} style={[link, { marginTop: 4 }]}>I want to delete my account</Text>
            ) : signedInRecently(user) ? (
              <View style={{ gap: 10, marginTop: 4 }}>
                <RedButton label={busy ? "Deleting…" : "Yes, delete everything"} onPress={deleteEverything} disabled={busy} />
                <Secondary label="Keep my account" onPress={() => setConfirmingDelete(false)} disabled={busy} />
              </View>
            ) : (
              <View style={{ gap: 10, marginTop: 4 }}>
                <Text style={[font("400 14px", "Plus Jakarta Sans"), { color: INK }]}>
                  For your safety, please sign in again to confirm it&apos;s you. Then come back here to finish.
                </Text>
                <RedButton label="Sign in again" onPress={signInAgainToDelete} />
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 20, justifyContent: "center", paddingTop: 4 }}>
            <Text accessibilityRole="link" onPress={() => Linking.openURL(`${SITE}/privacy`)} style={[font("600 13px", "Plus Jakarta Sans"), { color: SOFT, textDecorationLine: "underline" }]}>Privacy Policy</Text>
            <Text accessibilityRole="link" onPress={() => Linking.openURL(`${SITE}/terms`)} style={[font("600 13px", "Plus Jakarta Sans"), { color: SOFT, textDecorationLine: "underline" }]}>Terms and Conditions</Text>
          </View>

          {error && <ErrorNote>{error}</ErrorNote>}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * The profile photo, as the website's profile-photo.tsx. A new photo is
 * cropped square here, then waits for a moderator; the old one stays until
 * they approve it.
 */
function ProfilePhoto() {
  const { user, profile, refresh } = useAuth();
  const [review, setReview] = useState<PhotoReview | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let current = true;
    loadMyPhotoReview(user.uid)
      .then((found) => current && setReview(found))
      .catch(() => current && setReview(null));
    return () => {
      current = false;
    };
  }, [user]);

  if (!user || !profile) return null;
  const photo = photoOf(profile);
  const waiting = review?.status === "waiting";

  async function choose() {
    if (!user) return;
    setError(null);
    setBusy("Sending…");
    try {
      const result = await pickPhotos(1, AVATAR_FRAME);
      if (!result) return;
      if ("denied" in result) {
        setError("Photos are off for this app. Allow them in your phone's Settings, then try again.");
        return;
      }
      const [jpeg] = result.photos;
      if (!jpeg) return;
      await askForPhotoCheck(user, jpeg);
      setReview(await loadMyPhotoReview(user.uid));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  async function act(label: string, run: () => Promise<void>) {
    setError(null);
    setBusy(label);
    try {
      await run();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <Avatar name={profile.displayName} photo={photo?.large ?? null} size={72} />
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="button" onPress={busy ? undefined : choose} style={link}>
            {busy === "Sending…" ? busy : photo ? "Change photo" : "Add a photo"}
          </Text>
          {photo && (
            <Text
              accessibilityRole="button"
              onPress={busy ? undefined : () => act("Removing…", async () => {
                await removeMyPhoto(user);
                await refresh();
              })}
              style={[link, { color: SOFT }]}
            >
              {busy === "Removing…" ? busy : "Remove photo"}
            </Text>
          )}
        </View>
      </View>
      <Text style={[font("400 12.5px/1.45", "Plus Jakarta Sans"), { color: SOFT }]}>
        A moderator checks every profile photo before anyone sees it. Please use a photo of you, or of something that stands for you, like your shop.
      </Text>
      {waiting && (
        <Text style={[font("400 13px/1.45", "Plus Jakarta Sans"), { color: INK, backgroundColor: PAS.butterLight, padding: 12, borderRadius: 12, overflow: "hidden" }]}>
          Your new photo is waiting for a moderator. It shows on your profile once they approve it.{" "}
          <Text accessibilityRole="button" onPress={busy ? undefined : () => act("Cancelling…", async () => {
            await cancelPhotoCheck(user);
            setReview(null);
          })} style={link}>
            {busy === "Cancelling…" ? busy : "Cancel"}
          </Text>
        </Text>
      )}
      {review?.status === "declined" && (
        <View style={{ backgroundColor: "#FBE9E9", padding: 12, borderRadius: 12, gap: 6 }}>
          <Text style={[font("400 13px/1.45", "Plus Jakarta Sans"), { color: INK }]}>
            A moderator didn&apos;t approve your last photo.{review.note ? ` "${review.note}"` : ""} You can choose another one.
          </Text>
          <Text accessibilityRole="button" onPress={() => act("Clearing…", async () => {
            await cancelPhotoCheck(user);
            setReview(null);
          })} style={link}>Got it</Text>
        </View>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
    </View>
  );
}

/** The people you've blocked, to unblock. Shown only when there are some. */
function BlockedPeople() {
  const { ready, blocked } = useMyFollows();
  const uids = useMemo(() => [...blocked].sort(), [blocked]);
  const [names, setNames] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const unknown = uids.filter((uid) => !(uid in names));
    if (!unknown.length) return;
    let current = true;
    Promise.all(unknown.map(async (uid) => [uid, await nameOf(uid)] as const)).then(
      (found) => current && setNames((known) => ({ ...known, ...Object.fromEntries(found) })),
    );
    return () => {
      current = false;
    };
  }, [uids, names]);

  if (!ready || !uids.length) return null;
  return (
    <View style={card}>
      <Text style={[font("800 16px", "Plus Jakarta Sans"), { color: INK }]}>People you&apos;ve blocked</Text>
      <Text style={body}>They can&apos;t follow you. Only you can see this list, and they weren&apos;t told.</Text>
      {uids.map((uid) => (
        <BlockedRow key={uid} uid={uid} name={names[uid]} known={uid in names} />
      ))}
    </View>
  );
}

function BlockedRow({ uid, name, known }: { uid: string; name: string | null | undefined; known: boolean }) {
  const fol = useFollowAuthor(uid, name ?? "them");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: PAS.hairline }}>
      {name ? (
        <Text accessibilityRole="link" numberOfLines={1} onPress={() => router.push(`/people/${uid}`)} style={[font("700 14px", "Plus Jakarta Sans"), { color: INK, flex: 1 }]}>{name}</Text>
      ) : (
        <Text style={[font("400 14px", "Plus Jakarta Sans"), { color: SOFT, flex: 1 }]}>{known ? "Someone who has left" : "…"}</Text>
      )}
      <FollowPill text={fol.text} quiet={fol.following} busy={fol.busy} onPress={fol.toggle} />
    </View>
  );
}
