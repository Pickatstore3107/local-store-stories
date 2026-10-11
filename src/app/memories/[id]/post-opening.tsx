"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef } from "react";
import { BackIcon } from "@/components/icons";
import { openedHere, openingPhoto, useClosePost, useGrowInto } from "@/components/post/grow-photo";

/** Back to where the post was opened from, its photo shrinking into place; Home if it was opened from a link. */
export function PostBackLink() {
  const { id } = useParams<{ id: string }>();
  const close = useClosePost(id);
  return (
    <Link
      href="/"
      transitionTypes={["nav-back"]}
      onClick={close}
      className="inline-flex items-center gap-0.5 text-[0.85rem] font-bold text-brand-red underline-offset-4 hover:underline"
    >
      <BackIcon className="h-4 w-4" />
      {openedHere(id) ? "Back" : "Home"}
    </Link>
  );
}

/**
 * While a post opened from Home loads, the photo that was tapped, where
 * the post's photo will be, so it grows straight into place.
 */
export function OpeningPhoto() {
  const { id } = useParams<{ id: string }>();
  const photo = openingPhoto(id);
  const box = useRef<HTMLDivElement>(null);
  useGrowInto(box, id);
  return (
    <div ref={box} className="relative mx-auto aspect-[4/5] w-[84%] overflow-hidden rounded-[1rem] bg-sand">
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- a signed link from our image host, already sized
        <img src={photo} alt="" width={800} height={1000} decoding="async" className="h-full w-full object-cover" />
      )}
    </div>
  );
}
