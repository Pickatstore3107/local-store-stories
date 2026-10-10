import type { Metadata } from "next";
import Link from "next/link";
import { pageTitle } from "@/components/ui";
import { GRIEVANCE_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy · Local Stores & Their Stories",
  description:
    "What Local Stores & Their Stories collects, who sees it, the cookies we use and how to delete your data.",
  alternates: { canonical: "/privacy" },
  openGraph: { title: "Privacy notice" },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-5 sm:py-12 text-ink">
      <h1 className={pageTitle}>Privacy notice</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Draft for the pilot. Last updated 10 October 2026.
      </p>

      <div className="mt-8 space-y-6 leading-relaxed">
        <section>
          <h2 className="text-lg font-bold">Who we are</h2>
          <p className="mt-2">
            Local Stores &amp; Their Stories is a campaign run by Pick at Store. We collect
            only what we need to let you share posts about local stores. The rules for using
            the site are in our{" "}
            <Link href="/terms" className="font-bold text-brand-red underline underline-offset-4">
              terms and conditions
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Your Google email address, to sign you in. Never shown publicly.</li>
            <li>The name and city you choose, and if you like, a short bio and a profile photo. Shown publicly on your profile, and your name and photo with your posts and comments.</li>
            <li>A profile photo is cropped on your phone, which removes any location saved in it, and stored privately with Cloudinary. A moderator checks it first: it shows only once they approve it. Photos that aren&apos;t approved, or that you change or remove, are deleted.</li>
            <li>Posts, photos and videos you choose to share.</li>
            <li>Photos are cropped and resized on your phone, and the location hidden inside photos and videos is removed before upload. They are stored privately with our image provider, Cloudinary, and shown only through links our site makes for posts people can see.</li>
            <li>If you put a post on the Hyderabad map, the 500-metre square of the city you tapped, never the exact spot.</li>
            <li>Which posts you like. Anyone can see who liked a post, as on Instagram. Loves from before 9 October 2026, when likes started showing names, stay private: they count, but nobody can see who.</li>
            <li>The places you save with the bookmark. Only you can see this.</li>
            <li>Comments you write under posts. Anyone who can see the post can read them, with your name.</li>
            <li>Reports you send about a post, a comment or a profile. Only moderators can read them.</li>
            <li>The invite links you make, and who joined through them. If you joined through a friend&apos;s invite link, who invited you and through which link.</li>
            <li>Who you follow and who follows you. Anyone can see this, as on Instagram.</li>
            <li>The people you block. Only you can see this, and they aren&apos;t told.</li>
            <li>When someone last followed you and when you last opened your activity, to show the dot on the bell. Only you can see this.</li>
            <li>When you last shared a post or wrote a comment, and how many that day, to stop bots and scripts from flooding the site. Only you can see this.</li>
            <li>When you agreed to this notice, and that you confirmed you are 18 or older.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold">Who sees your posts</h2>
          <p className="mt-2">
            A post goes up as soon as you share it, shown to everyone, or only to people you
            share its link with if you chose that. Anyone can report a post. Moderators read
            the reports and can see the post, with its photos or video and your public name and
            city, but never your email address. When three people report a post, it comes off
            the site until a moderator has looked at it. If a moderator hides a post, you&apos;ll
            see why on your profile. We keep a short record of each decision (the store&apos;s
            name, what was decided and why, but not your name) so we can answer questions about
            it later.
          </p>
          <p className="mt-2">
            A post&apos;s photos and video are shown through web links. If a moderator hides
            the post later, anyone who saved those links can still open them until you delete
            the post.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">The Hyderabad map</h2>
          <p className="mt-2">
            Putting a post on the map is optional. When you tap where the store was, we keep
            only which 500-metre square of the city you tapped, and the map shows the pin in the
            middle of that square, so it&apos;s within about 500 metres of the store and never
            marks a door or a home. Pins never come from your phone&apos;s location or your
            photo. Only posts shared with everyone appear on the map. You can move
            the pin or take it off from your profile at any time. The map itself comes from
            OpenStreetMap, through a free service called OpenFreeMap. When a map opens,
            including the one at the top of Home, your phone or computer asks OpenFreeMap for
            the streets to draw, so it sees your internet address, as any website would. It
            never sees who you are or your posts.
          </p>
          <p className="mt-2">
            The map can show where you are as a blue dot, with the posts and shops near you,
            but only after you tap the locate button and allow it when your phone asks. Your
            location stays in the page: we never save it, never send it to us, and never use it
            for a pin. You can turn it off in your browser&apos;s site settings at any time.
          </p>
          <p className="mt-2">
            When you search the map, the words you type go to Photon, a free search of
            OpenStreetMap run by Komoot, to find places in Hyderabad. Photon sees what you typed
            and your internet address, as any website would, but never who you are or where
            you are. Shop names on the map also come from OpenStreetMap. Directions opens Google
            Maps, and only if you tap it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Instagram posts on Home</h2>
          <p className="mt-2">
            At the bottom of Home we show public Instagram posts about local stores, through a
            service called Curator. New posts appear on their own, without our team checking
            each one first, and we take down any that don&apos;t belong. They load only when you
            scroll down to them. Your phone or computer then gets them from Curator and
            Instagram, which see your internet address, as any website would, and may use
            their own cookies. They never see who you are on this site or your posts.
          </p>
        </section>

        <section id="cookies" className="scroll-mt-20">
          <h2 className="text-lg font-bold">Cookies and visit counts</h2>
          <p className="mt-2">
            We don&apos;t use advertising or tracking cookies. To keep you signed in, Google
            sign-in saves a small record in your browser&apos;s storage; the site can&apos;t work
            without it. Your browser also remembers your cookie choice. The Instagram posts on
            Home are the only part that may bring cookies of its own, from Curator and Instagram,
            so they load only if you allow them. You can change your choice at any time with{" "}
            <strong>Cookie choices</strong> at the bottom of each page.
          </p>
          <p className="mt-2">
            To see how many people visit and which pages they open, we use Vercel Web Analytics,
            from the company that hosts this site. It sets no cookies and doesn&apos;t record who
            you are: it counts page visits, with the kind of device and browser and the country
            they come from, and forgets the rest within a day.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Invite links</h2>
          <p className="mt-2">
            Each post comes with an invite link for you to send to friends, and they can pass
            it on. Anyone with the link can join through it and see the post, even if you
            shared it only by link. When friends join through yours, you see
            their names under that post and on your activity page. Which link someone joined
            through is visible only to them and to the friend who sent it. Your public profile
            record also notes who invited you, if anyone did. If you delete your account, your
            invite links stop working.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Profiles and following</h2>
          <p className="mt-2">
            Everyone who joins has a profile page with the name and city they chose, their bio
            and photo if they added them, the posts they shared with everyone, and how many people they follow and are followed
            by. Anyone, even without an account, can open a profile and see who that person
            follows and who follows them. A post you shared only by link never appears on
            your profile. We ask search engines not to list profiles.
          </p>
          <p className="mt-2">
            Members can find each other by name in Explore. To make that work, your profile
            also keeps your name in small letters without accents. Nothing else about you can be
            searched.
          </p>
          <p className="mt-2">
            You can follow anyone who has joined, unfollow them at any time, remove someone who
            follows you, or block someone. Blocking ends any follow between you and stops them
            following you; it&apos;s private, and they aren&apos;t told. If you join through a
            friend&apos;s invite link, you follow that friend, and you can unfollow them. Your
            activity page, with who followed you and who joined through your links, is only for
            you.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Likes and comments</h2>
          <p className="mt-2">
            When you like a post, your name shows in its list of likes, and may show under it
            as the latest person to like it. Unliking takes your name off. Comments show at once,
            with your name, to anyone who can see the post. You can delete your own comments,
            and the person who shared a post can delete comments on it. Comments can&apos;t
            have links, and each person can write a few a minute, to keep out spam.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Reporting a post, a comment or a profile</h2>
          <p className="mt-2">
            If a post is unkind, shows private details, or uses your photo or your store
            without your agreement, report it from the post&apos;s page. A moderator reads
            every report. When three people report a post, it comes off the site until a
            moderator has looked at it. Comments can be reported the same way, and a moderator
            decides whether to delete them. A profile can be reported from its page, and a
            moderator can remove its bio or photo, or change its name to Member. Moderators can
            see who sent a report, but the person reported can&apos;t. You can also email us
            without an account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">What we never do</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>We never sell your personal data.</li>
            <li>We never show your email address or home location.</li>
            <li>We never use your posts to target ads at you.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold">Your choices</h2>
          <p className="mt-2">
            You can see and edit your public details, and delete your account and everything
            linked to it (your profile photo, your posts and photos, your likes and comments, your invite links,
            who you follow and who follows you, the people you blocked, the posts you loved,
            the places you saved and the reports you sent), from <strong>Profile and settings</strong> on your profile at any time. You can also write to us to
            access, correct or erase your data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Questions or complaints</h2>
          <p className="mt-2">
            Contact our grievance officer at{" "}
            <a
              href={`mailto:${GRIEVANCE_EMAIL}`}
              className="font-bold text-brand-red underline underline-offset-4"
            >
              {GRIEVANCE_EMAIL}
            </a>
            . We will reply as quickly as we can and within the time India&apos;s Digital
            Personal Data Protection law requires.
          </p>
        </section>
      </div>
    </main>
  );
}
