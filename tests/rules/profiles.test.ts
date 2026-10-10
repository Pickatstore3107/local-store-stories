import {
  assertFails,
  assertSucceeds,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { CONSENT_VERSION, startRulesEnv } from "./setup";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await startRulesEnv();
});
afterAll(async () => {
  await env?.cleanup();
});

type TestDb = ReturnType<RulesTestContext["firestore"]>;
const asDb = (testDb: TestDb) => testDb as unknown as Firestore;
const as = (uid: string) => asDb(env.authenticatedContext(uid).firestore());

const PENDING = "lss/avatars/ravi/AbCdEfGhIjKlMnOpQrSt";
const OLD = "lss/avatars/asha/ZyXwVuTsRqPoNmLkJiHg";
// As src/lib/server/avatars.ts makes them.
const link = (id: string, size: number) =>
  `https://res.cloudinary.com/lsstest/image/authenticated/s--Ab12Cd34--/c_fill,f_auto,h_${size},q_auto,w_${size}/v1/${id}.jpg`;
const photo = (id: string) => ({ id, small: link(id, 96), large: link(id, 320) });

// Ravi, Asha and Mallory have profiles, and KO is a moderator. Asha's profile
// has a bio and an approved photo; Ravi has a photo waiting for review. Neha
// has signed in but not finished joining.
async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = asDb(ctx.firestore());
    const at = new Date(2026, 9, 2);
    for (const uid of ["ravi", "asha", "mallory", "mod"]) {
      await setDoc(doc(db, "usersPrivate", uid), {
        consentVersion: CONSENT_VERSION,
        consentAt: at,
        ageConfirmed: true,
      });
      await setDoc(doc(db, "users", uid), {
        displayName: uid,
        nameLower: uid,
        city: "Hyderabad",
        createdAt: at,
        updatedAt: at,
      });
    }
    await updateDoc(doc(db, "users", "asha"), { bio: "Chai first, then everything else.", photo: photo(OLD) });
    await setDoc(doc(db, "moderators", "mod"), { name: "KO" });
    await setDoc(doc(db, "photoReviews", "ravi"), { photoId: PENDING, at, status: "waiting" });
  });
}

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

describe("bios", () => {
  it("lets people add, change and remove their bio, which shows at once", async () => {
    const db = as("ravi");
    await assertSucceeds(updateDoc(doc(db, "users/ravi"), { bio: "Samosas at Ramu's, 1998 to 2004.", updatedAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(as("mallory"), "users/ravi")));
    await assertSucceeds(updateDoc(doc(db, "users/ravi"), { bio: deleteField(), updatedAt: serverTimestamp() }));
  });

  it("keeps bios short, and without links", async () => {
    const db = as("ravi");
    const set = (bio: string) => updateDoc(doc(db, "users/ravi"), { bio, updatedAt: serverTimestamp() });
    await assertSucceeds(set("x".repeat(150)));
    await assertFails(set("x".repeat(151)));
    await assertFails(set(""));
    await assertFails(set("Follow me at https://example.com"));
    await assertFails(set("Visit WWW.example.com"));
  });

  it("lets nobody else change someone's bio", async () => {
    await assertFails(updateDoc(doc(as("mallory"), "users/asha"), { bio: "Not me.", updatedAt: serverTimestamp() }));
  });
});

describe("profile photos", () => {
  it("never lets people put up their own photo", async () => {
    const db = as("ravi");
    await assertFails(updateDoc(doc(db, "users/ravi"), { photo: photo(PENDING), updatedAt: serverTimestamp() }));
    await assertFails(
      updateDoc(doc(as("asha"), "users/asha"), { photo: photo("lss/avatars/asha/AAAAAAAAAAAAAAAAAAAA"), updatedAt: serverTimestamp() }),
    );
  });

  it("lets people take their photo down", async () => {
    await assertSucceeds(updateDoc(doc(as("asha"), "users/asha"), { photo: deleteField(), updatedAt: serverTimestamp() }));
  });

  it("lets people ask for their own photo to be checked", async () => {
    const db = as("asha");
    const ask = (data: object) => setDoc(doc(db, "photoReviews/asha"), data);
    const id = "lss/avatars/asha/BbBbBbBbBbBbBbBbBbBb";
    await assertFails(ask({ photoId: "lss/avatars/ravi/BbBbBbBbBbBbBbBbBbBb", at: serverTimestamp(), status: "waiting" }));
    await assertFails(ask({ photoId: "lss/stories/asha/BbBbBbBbBbBbBbBbBbBb", at: serverTimestamp(), status: "waiting" }));
    await assertFails(ask({ photoId: id, at: serverTimestamp(), status: "declined" }));
    await assertFails(ask({ photoId: id, at: serverTimestamp(), status: "waiting", note: "hi" }));
    await assertSucceeds(ask({ photoId: id, at: serverTimestamp(), status: "waiting" }));
    await assertFails(setDoc(doc(as("mallory"), "photoReviews/asha"), { photoId: id, at: serverTimestamp(), status: "waiting" }));
  });

  it("needs the person to have finished joining", async () => {
    await assertFails(
      setDoc(doc(as("neha"), "photoReviews/neha"), {
        photoId: "lss/avatars/neha/BbBbBbBbBbBbBbBbBbBb",
        at: serverTimestamp(),
        status: "waiting",
      }),
    );
  });

  it("shows a waiting photo only to its owner and moderators", async () => {
    await assertSucceeds(getDoc(doc(as("ravi"), "photoReviews/ravi")));
    await assertSucceeds(getDoc(doc(as("mod"), "photoReviews/ravi")));
    await assertFails(getDoc(doc(as("asha"), "photoReviews/ravi")));
    await assertSucceeds(getDocs(query(collection(as("mod"), "photoReviews"), where("status", "==", "waiting"))));
    await assertFails(getDocs(query(collection(as("asha"), "photoReviews"), where("status", "==", "waiting"))));
  });

  it("lets a moderator put up the waiting photo, removing its review in the same write", async () => {
    const db = as("mod");
    const batch = writeBatch(db);
    batch.update(doc(db, "users/ravi"), { photo: photo(PENDING) });
    batch.delete(doc(db, "photoReviews/ravi"));
    await assertSucceeds(batch.commit());
  });

  it("puts up only the photo that was checked, through our own links", async () => {
    const db = as("mod");
    const approve = (value: object, removeReview = true) => {
      const batch = writeBatch(db);
      batch.update(doc(db, "users/ravi"), { photo: value });
      if (removeReview) batch.delete(doc(db, "photoReviews/ravi"));
      return batch.commit();
    };
    await assertFails(approve(photo(PENDING), false));
    await assertFails(approve(photo("lss/avatars/ravi/QqQqQqQqQqQqQqQqQqQq")));
    await assertFails(approve({ ...photo(PENDING), small: "https://example.com/me.jpg" }));
    await assertFails(approve({ ...photo(PENDING), large: link(OLD, 320) }));
    await assertFails(approve({ ...photo(PENDING), extra: "x" }));
    const asha = as("asha");
    const notModerator = writeBatch(asha);
    notModerator.update(doc(asha, "users/ravi"), { photo: photo(PENDING) });
    notModerator.delete(doc(asha, "photoReviews/ravi"));
    await assertFails(notModerator.commit());
  });

  it("lets a moderator turn a photo down with a note, which its owner sees", async () => {
    const db = as("mod");
    const decline = (note: string) =>
      updateDoc(doc(db, "photoReviews/ravi"), { status: "declined", note, decidedAt: serverTimestamp() });
    await assertFails(decline("no"));
    await assertFails(updateDoc(doc(as("ravi"), "photoReviews/ravi"), { status: "declined", note: "Looks fine to me", decidedAt: serverTimestamp() }));
    await assertSucceeds(decline("Please use a photo of yourself."));
    await assertSucceeds(getDoc(doc(as("ravi"), "photoReviews/ravi")));
    // A declined photo can't then be put up.
    const batch = writeBatch(db);
    batch.update(doc(db, "users/ravi"), { photo: photo(PENDING) });
    batch.delete(doc(db, "photoReviews/ravi"));
    await assertFails(batch.commit());
    // Its owner can try another.
    await assertSucceeds(
      setDoc(doc(as("ravi"), "photoReviews/ravi"), {
        photoId: "lss/avatars/ravi/CcCcCcCcCcCcCcCcCcCc",
        at: serverTimestamp(),
        status: "waiting",
      }),
    );
  });

  it("lets owners and moderators remove a review", async () => {
    await assertFails(deleteDoc(doc(as("asha"), "photoReviews/ravi")));
    await assertSucceeds(deleteDoc(doc(as("ravi"), "photoReviews/ravi")));
    await assertSucceeds(deleteDoc(doc(as("mod"), "photoReviews/ravi")));
  });
});

describe("a moderator dealing with a reported profile", () => {
  it("may remove the bio or the photo, or change the name to Member", async () => {
    const db = as("mod");
    await assertSucceeds(updateDoc(doc(db, "users/asha"), { bio: deleteField() }));
    await assertSucceeds(updateDoc(doc(db, "users/asha"), { photo: deleteField() }));
    await assertSucceeds(updateDoc(doc(db, "users/asha"), { displayName: "Member", nameLower: "member" }));
  });

  it("may change nothing else", async () => {
    const db = as("mod");
    await assertFails(updateDoc(doc(db, "users/asha"), { bio: "Something else." }));
    await assertFails(updateDoc(doc(db, "users/asha"), { displayName: "Someone" }));
    await assertFails(updateDoc(doc(db, "users/asha"), { displayName: "Member", nameLower: "someone" }));
    await assertFails(updateDoc(doc(db, "users/asha"), { nameLower: "someone" }));
    await assertFails(updateDoc(doc(db, "users/asha"), { city: "Pune" }));
    await assertFails(updateDoc(doc(db, "users/asha"), { photo: photo(PENDING) }));
  });

  it("is the only one who may", async () => {
    await assertFails(updateDoc(doc(as("mallory"), "users/asha"), { bio: deleteField() }));
    await assertFails(updateDoc(doc(as("mallory"), "users/asha"), { displayName: "Member", nameLower: "member" }));
  });
});

describe("profile reports", () => {
  const report = (by: string, uid: string, extra: object = {}) =>
    setDoc(doc(as(by), "profileReports", `${uid}_${by}`), {
      uid,
      reason: "unkind",
      by,
      at: serverTimestamp(),
      status: "open",
      ...extra,
    });

  it("lets members report someone else's profile, once", async () => {
    await assertSucceeds(report("mallory", "asha"));
    await assertSucceeds(report("ravi", "asha", { reason: "other", details: "Pretends to run the stall." }));
  });

  it("refuses odd reports", async () => {
    await assertFails(report("asha", "asha"));
    await assertFails(report("mallory", "asha", { reason: "boring" }));
    await assertFails(report("mallory", "asha", { reason: "other" }));
    await assertFails(report("mallory", "asha", { status: "closed" }));
    await assertFails(report("mallory", "nobody"));
    await assertFails(report("neha", "asha"));
    await assertFails(
      setDoc(doc(as("mallory"), "profileReports/asha_ravi"), {
        uid: "asha",
        reason: "unkind",
        by: "mallory",
        at: serverTimestamp(),
        status: "open",
      }),
    );
  });

  it("are read by moderators, never by the person reported", async () => {
    await report("mallory", "asha");
    await assertSucceeds(getDoc(doc(as("mod"), "profileReports/asha_mallory")));
    await assertSucceeds(getDocs(query(collection(as("mod"), "profileReports"), where("status", "==", "open"))));
    await assertFails(getDoc(doc(as("asha"), "profileReports/asha_mallory")));
    await assertFails(getDocs(query(collection(as("asha"), "profileReports"), where("uid", "==", "asha"))));
    await assertSucceeds(getDocs(query(collection(as("mallory"), "profileReports"), where("by", "==", "mallory"))));
  });

  it("are closed by moderators", async () => {
    await report("mallory", "asha");
    await report("ravi", "asha");
    const close = (id: string, outcome: string, uid = "mod") =>
      updateDoc(doc(as(uid), "profileReports", id), {
        status: "closed",
        outcome,
        closedBy: uid,
        closedAt: serverTimestamp(),
      });
    await assertFails(close("asha_mallory", "kept", "ravi"));
    await assertFails(close("asha_mallory", "gone"));
    await assertFails(close("asha_mallory", "deleted"));
    await assertSucceeds(close("asha_mallory", "kept"));
    await assertSucceeds(close("asha_ravi", "changed"));
  });

  it("about a deleted account close as gone", async () => {
    await report("mallory", "asha");
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(asDb(ctx.firestore()), "users/asha")));
    await assertSucceeds(
      updateDoc(doc(as("mod"), "profileReports/asha_mallory"), {
        status: "closed",
        outcome: "gone",
        closedBy: "mod",
        closedAt: serverTimestamp(),
      }),
    );
  });

  it("can be taken back by the person who sent them", async () => {
    await report("mallory", "asha");
    await assertFails(deleteDoc(doc(as("asha"), "profileReports/asha_mallory")));
    await assertSucceeds(deleteDoc(doc(as("mallory"), "profileReports/asha_mallory")));
  });
});
