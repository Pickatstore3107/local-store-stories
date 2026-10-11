import Link from "next/link";
import { StreakBadge } from "@/components/streak";
import { memoryPath, textLang } from "@/lib/memories";
import { followListPath, initial, type PublicPerson } from "@/lib/people";
import { OwnerSection } from "./owner-section";
import { ProfileActions } from "./profile-actions";

const caps = { font: "700 10px 'Plus Jakarta Sans'", letterSpacing: ".14em", textTransform: "uppercase", color: "#6E5A55" } as const;
const stat = { padding: "12px 0 12px 14px", borderLeft: "1px solid #E7D9D4", display: "flex", flexDirection: "column", gap: 2 } as const;

/** The prototype's Me screen, for anyone's profile. */
export function ProfileView({ uid, person }: { uid: string; person: PublicPerson }) {
  const photo = person.photo?.large;

  return (
    <article style={{ padding: "14px 0 26px" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "0 18px" }}>
        <div aria-hidden="true" style={{ width: 84, height: 84, borderRadius: "50%", background: "#A3171B", color: "#fff", display: "grid", placeItems: "center", font: "600 34px 'Playfair Display'", boxShadow: "0 0 0 3px #fff,0 0 0 6px #FFC000", flex: "none", position: "relative", overflow: "hidden" }}>
          {initial(person.name)}
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
            <img src={photo} alt="" width={320} height={320} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <h1 lang={textLang(person.name)} style={{ margin: 0, font: "600 25px/1.05 'Playfair Display'", overflowWrap: "anywhere" }}>{person.name}</h1>
          {person.city && <span style={{ font: "500 13px 'Plus Jakarta Sans'", color: "#6E5A55" }}>{person.city}</span>}
          <StreakBadge sharedAt={person.memories.map((m) => m.sharedAt)} />
        </div>
      </div>
      {person.bio && (
        <p lang={textLang(person.bio)} style={{ margin: "14px 18px 0", font: "400 14px/1.45 'Plus Jakarta Sans'", whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{person.bio}</p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", margin: "16px 18px 0", borderTop: "2px solid #2B1D1A", borderBottom: "2px solid #2B1D1A" }}>
        <div style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 2 }}><span style={{ font: "400 32px/1 'Anton'", color: "#A3171B" }}>{person.memories.length}</span><span style={caps}>Posts</span></div>
        <Link href={followListPath(uid, "followers")} style={stat}><span style={{ font: "400 32px/1 'Anton'" }}>{person.followers}</span><span style={caps}>Followers</span></Link>
        <Link href={followListPath(uid, "following")} style={stat}><span style={{ font: "400 32px/1 'Anton'" }}>{person.following}</span><span style={caps}>Following</span></Link>
      </div>
      <ProfileActions uid={uid} name={person.name} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginTop: 18, borderBottom: "1px solid #F1E6E2" }}>
        <span style={{ height: 44, display: "grid", placeItems: "center", borderBottom: "2px solid #2B1D1A", marginBottom: -1, font: "700 13px 'Plus Jakarta Sans'", color: "#2B1D1A" }}>Posts</span>
        <Link href="/map" style={{ height: 44, display: "grid", placeItems: "center", font: "600 13px 'Plus Jakarta Sans'", color: "#6E5A55" }}>On the map</Link>
      </div>
      <MemoryGrid person={person} />
      <OwnerSection uid={uid} />
    </article>
  );
}

/** Their posts shared with everyone, newest first, three to a row. */
function MemoryGrid({ person }: { person: PublicPerson }) {
  if (person.memories.length === 0) {
    return <p style={{ margin: 0, padding: "20px 18px 0", font: "500 13px 'Plus Jakarta Sans'", color: "#6E5A55" }}>No posts shared with everyone yet.</p>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2, paddingTop: 2 }}>
      {person.memories.map((memory, i) => (
        <Link key={memory.id} href={memoryPath(memory.id)} title={memory.storeName} style={{ aspectRatio: "4/5", cursor: "pointer", background: "#F7F2EF", position: "relative", overflow: "hidden" }}>
          {memory.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
            <img src={memory.photoUrl} alt="" loading={i < 6 ? "eager" : "lazy"} decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          )}
          <span className="sr-only" lang={textLang(memory.storeName)}>{memory.storeName}</span>
        </Link>
      ))}
    </div>
  );
}

