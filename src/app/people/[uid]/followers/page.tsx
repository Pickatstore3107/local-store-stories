import type { Metadata } from "next";
import { FollowListPage, followListMetadata } from "../follow-list";

// Built on its first visit and then stored, like the profile itself.
export function generateStaticParams() {
  return [{ uid: "example" }];
}

export async function generateMetadata({
  params,
}: PageProps<"/people/[uid]/followers">): Promise<Metadata> {
  return followListMetadata((await params).uid, "followers");
}

export default function FollowersPage({ params }: PageProps<"/people/[uid]/followers">) {
  return <FollowListPage params={params} kind="followers" />;
}
