import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadPerson } from "@/lib/server/people";
import { ProfileView } from "./profile-view";

const SITE = "Local Stores & Their Stories";

// Like a memory's page, each profile is built on its first visit and then
// stored. The build needs one example address to check the page with; it
// isn't a real person, so it shows "This person isn't here".
export function generateStaticParams() {
  return [{ uid: "example" }];
}

export async function generateMetadata({ params }: PageProps<"/people/[uid]">): Promise<Metadata> {
  const { uid } = await params;
  const result = await loadPerson(uid);
  const name = result.status === "found" ? result.person.name : null;
  return {
    title: name ? `${name} · ${SITE}` : `A member · ${SITE}`,
    // People's own pages stay out of search engines.
    robots: { index: false, follow: false },
  };
}

export default function PersonPage({ params }: PageProps<"/people/[uid]">) {
  return (
    <main style={{ flex: 1, width: "100%", maxWidth: 560, margin: "0 auto" }}>
      <Suspense fallback={<ProfileSkeleton />}>
        {params.then(({ uid }) => (
          <Profile uid={uid} />
        ))}
      </Suspense>
    </main>
  );
}

async function Profile({ uid }: { uid: string }) {
  const result = await loadPerson(uid);
  if (result.status === "missing") notFound();
  if (result.status === "error") {
    return (
      <p role="alert" style={{ padding: "36px 18px", margin: 0, font: "500 15px 'Plus Jakarta Sans'", color: "#6E5A55" }}>
        This profile couldn&apos;t be loaded just now. Please try again in a minute.
      </p>
    );
  }
  const { person } = result;
  return <ProfileView uid={uid} person={person} />;
}

function ProfileSkeleton() {
  return (
    <div role="status" style={{ padding: "14px 18px 0" }}>
      <span className="sr-only">Loading the profile…</span>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ width: 84, height: 84, borderRadius: "50%", background: "#F7F2EF", flex: "none" }} />
        <div style={{ width: 160, height: 26, borderRadius: 8, background: "#F7F2EF" }} />
      </div>
    </div>
  );
}
