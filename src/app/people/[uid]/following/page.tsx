import type { Metadata } from "next";
import { FollowListPage, followListMetadata } from "../follow-list";

// Built on its first visit and then stored, like the profile itself.
export function generateStaticParams() {
  return [{ uid: "example" }];
}

export async function generateMetadata({
  params,
}: PageProps<"/people/[uid]/following">): Promise<Metadata> {
  return followListMetadata((await params).uid, "following");
}

export default function FollowingPage({ params }: PageProps<"/people/[uid]/following">) {
  return <FollowListPage params={params} kind="following" />;
}
