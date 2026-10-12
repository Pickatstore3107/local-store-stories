import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import { router } from "expo-router";
import { useState, type RefObject } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { friendlyError } from "@/lib/auth-errors";
import {
  addComment,
  COMMENT_MAX,
  COMMENT_REPORT_REASONS,
  deleteComment,
  hasLink,
  refreshComments,
  reportComment,
} from "@/lib/comments";
import type { PublicComment } from "@/lib/memories";
import { PAS, font } from "@/lib/pas";
import { photoOf } from "@/lib/people";
import { useAuth } from "./auth-provider";
import { DoneNote, ReportForm } from "./report-form";

// The comments under a post, as the website's
// src/app/memories/[id]/comments.tsx: the oldest first, as the prototype's
// bubbles, and a box to add one. People can delete their own, the post's
// author can delete any, and anyone signed in can report one. (Moderators
// use the website.)

const INK = PAS.ink, SOFT = PAS.soft;
const small = [font("600 11.5px", "Plus Jakarta Sans"), { color: SOFT }];
const errorText = [font("500 12.5px", "Plus Jakarta Sans"), { color: PAS.deepRed }];

export function Comments({
  storyId,
  storyAuthorId,
  comments,
  inputRef,
}: {
  storyId: string;
  storyAuthorId: string | null;
  comments: PublicComment[];
  inputRef: RefObject<TextInput | null>;
}) {
  const { user, profile, consent } = useAuth();
  const member = user && consent && profile ? user : null;
  const [added, setAdded] = useState<PublicComment[]>([]);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());

  const shown = [...comments, ...added.filter((a) => !comments.some((c) => c.id === a.id))].filter(
    (c) => !removed.has(c.id),
  );
  const mayDelete = (comment: PublicComment) =>
    !!member && (comment.authorId === member.uid || storyAuthorId === member.uid);

  return (
    <View style={{ borderTopWidth: 2, borderTopColor: INK, paddingTop: 16, gap: 14 }}>
      <Text accessibilityRole="header" style={[font("600 20px", "Playfair Display"), { color: INK }]}>
        Comments <Text style={[font("400 20px", "Anton"), { color: PAS.red }]}>{shown.length || ""}</Text>
      </Text>
      {shown.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          storyId={storyId}
          canDelete={mayDelete(comment)}
          canReport={!!member && comment.authorId !== member.uid}
          onDeleted={() => setRemoved((was) => new Set([...was, comment.id]))}
        />
      ))}
      {shown.length === 0 && (
        <Text style={[font("400 18px", "Kalam"), { color: SOFT }]}>Be the first to remember something here.</Text>
      )}
      <CommentBox
        storyId={storyId}
        inputRef={inputRef}
        member={member}
        onAdded={(comment) => setAdded((was) => [...was, comment])}
        authorName={profile?.displayName ?? null}
        authorPhoto={photoOf(profile)?.small ?? null}
      />
    </View>
  );
}

function CommentItem({
  comment,
  storyId,
  canDelete,
  canReport,
  onDeleted,
}: {
  comment: PublicComment;
  storyId: string;
  canDelete: boolean;
  canReport: boolean;
  onDeleted: () => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = comment.authorName ?? "A former member";

  async function remove() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await deleteComment(user, { id: comment.id, storyId });
      onDeleted();
      await refreshComments(user, storyId);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: PAS.yellow, alignItems: "center", justifyContent: "center" }}>
        <Text style={[font("700 12px", "Plus Jakarta Sans"), { color: INK }]}>{Array.from(name)[0]}</Text>
      </View>
      <View style={{ flex: 1, alignItems: "flex-start", gap: 4, minWidth: 0 }}>
        <View style={{ gap: 2, paddingVertical: 8, paddingHorizontal: 12, borderTopLeftRadius: 4, borderTopRightRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, backgroundColor: PAS.inputFill, maxWidth: "100%" }}>
          <Text
            accessibilityRole={comment.authorName ? "link" : undefined}
            onPress={comment.authorName ? () => router.push(`/people/${comment.authorId}`) : undefined}
            style={[font("700 12.5px", "Plus Jakarta Sans"), { color: INK }]}
          >
            {name}
          </Text>
          <Text style={[font("400 14px/1.4", "Plus Jakarta Sans"), { color: INK }]}>{comment.text}</Text>
        </View>
        {(canDelete || (canReport && !reporting && !reported)) && (
          <View style={{ flexDirection: "row", gap: 16, paddingHorizontal: 12 }}>
            {canDelete &&
              (confirming ? (
                <>
                  <Text accessibilityRole="button" onPress={busy ? undefined : remove} style={[small, { color: PAS.deepRed }]}>
                    {busy ? "Deleting…" : "Yes, delete"}
                  </Text>
                  <Text accessibilityRole="button" onPress={busy ? undefined : () => setConfirming(false)} style={small}>Keep it</Text>
                </>
              ) : (
                <Text accessibilityRole="button" onPress={() => setConfirming(true)} style={small}>Delete</Text>
              ))}
            {canReport && !reporting && !reported && (
              <Text accessibilityRole="button" onPress={() => setReporting(true)} style={small}>Report</Text>
            )}
          </View>
        )}
        {error && <Text accessibilityRole="alert" style={[errorText, { paddingHorizontal: 12 }]}>{error}</Text>}
        {reported && <DoneNote>Thank you. A moderator will look at this comment.</DoneNote>}
        {reporting && user && (
          <View style={{ alignSelf: "stretch" }}>
            <ReportForm
              title="What's wrong with this comment?"
              note="Only moderators see who reported it."
              reasons={COMMENT_REPORT_REASONS}
              onCancel={() => setReporting(false)}
              onSend={async (reason, details) => {
                try {
                  await reportComment(user, { id: comment.id, storyId }, reason, details);
                  setReporting(false);
                  setReported(true);
                } catch (e) {
                  throw new Error(
                    e instanceof FirebaseError && e.code === "permission-denied"
                      ? "You've already reported this comment, or it has been deleted."
                      : friendlyError(e),
                  );
                }
              }}
            />
          </View>
        )}
      </View>
    </View>
  );
}

/** The box for a new comment. Guests who try to post are asked to sign in first. */
function CommentBox({
  storyId,
  inputRef,
  member,
  authorName,
  authorPhoto,
  onAdded,
}: {
  storyId: string;
  inputRef: RefObject<TextInput | null>;
  member: User | null;
  authorName: string | null;
  authorPhoto: string | null;
  onAdded: (comment: PublicComment) => void;
}) {
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typed = !!draft.trim();

  async function send() {
    if (busy) return;
    const clean = draft.trim();
    if (!clean) return;
    if (!member) {
      router.push(user ? "/welcome" : "/signin");
      return;
    }
    if (hasLink(clean)) {
      setError("Comments can't have links in them.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const id = await addComment(member, storyId, clean);
      onAdded({ id, authorId: member.uid, authorName, authorPhoto, text: clean, createdAt: Date.now() });
      setDraft("");
      await refreshComments(member, storyId);
    } catch (e) {
      setError(
        e instanceof FirebaseError && e.code === "permission-denied"
          ? "You can't comment on this post right now."
          : friendlyError(e),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingLeft: 16, paddingRight: 6, borderRadius: 24, backgroundColor: PAS.inputFill, borderWidth: 1.5, borderColor: typed ? PAS.red : "transparent" }}>
        <TextInput
          ref={inputRef}
          value={draft}
          maxLength={COMMENT_MAX}
          accessibilityLabel="Add a memory or a comment"
          placeholder="Add a memory or a comment"
          placeholderTextColor={PAS.placeholder}
          onChangeText={(t) => {
            setDraft(t);
            setError(null);
          }}
          onSubmitEditing={() => void send()}
          returnKeyType="send"
          style={[font("500 14px", "Plus Jakarta Sans"), { flex: 1, minWidth: 0, color: INK, paddingVertical: 10 }]}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => void send()}
          disabled={busy}
          style={{ height: 36, paddingHorizontal: 16, borderRadius: 999, backgroundColor: PAS.red, justifyContent: "center", opacity: typed ? 1 : 0.4 }}
        >
          <Text style={[font("700 12.5px", "Plus Jakarta Sans"), { color: "#fff" }]}>{busy ? "Posting…" : "Post"}</Text>
        </Pressable>
      </View>
      {error && <Text accessibilityRole="alert" style={errorText}>{error}</Text>}
    </>
  );
}
