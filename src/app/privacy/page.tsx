import type { Metadata } from "next";
import { GRIEVANCE_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy · Local Stores & Their Stories",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-5 sm:py-12 text-ink">
      <h1 className="text-3xl font-extrabold text-brand-red">Privacy notice</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Draft for the pilot. Last updated 8 October 2026.
      </p>

      <div className="mt-8 space-y-6 leading-relaxed">
        <section>
          <h2 className="text-lg font-bold">Who we are</h2>
          <p className="mt-2">
            Local Stores &amp; Their Stories is a campaign run by Pick at Store. We collect
            only what we need to let you share memories of local stores.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Your Google email address, to sign you in. Never shown publicly.</li>
            <li>The name and city you choose. Shown publicly with your stories.</li>
            <li>Stories, photos and videos you choose to share, once they are approved.</li>
            <li>Photos are resized on your phone and the location hidden inside them is removed before upload. They are stored privately with our image provider, Cloudinary, until they are approved.</li>
            <li>If you put a memory on the Hyderabad map, the 500-metre square of the city you tapped, never the exact spot.</li>
            <li>Which memories you love. Only you can see this; the person who shared a memory sees only how many people loved it.</li>
            <li>Reports you send about a memory. Only moderators can read them.</li>
            <li>The invite links you make, and who joined through them. If you joined through a friend&apos;s invite link, who invited you and through which link.</li>
            <li>Who you follow and who follows you. Anyone can see this, as on Instagram.</li>
            <li>The people you block. Only you can see this, and they aren&apos;t told.</li>
            <li>When someone last followed you and when you last opened your activity, to show the dot on the bell. Only you can see this.</li>
            <li>When you agreed to this notice, and that you confirmed you are 18 or older.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold">Who sees your stories</h2>
          <p className="mt-2">
            A moderator reads every story, with its photo and your public name and city,
            before anyone else can see it. Moderators never see your email address. Once
            approved, a story is shown to everyone, or only to people you share its link with
            if you chose that. If a moderator doesn&apos;t approve a story or hides it later,
            you&apos;ll see why on your profile. We keep a short record of each
            decision (the store&apos;s name, what was decided and why, but not your name) so we
            can answer questions about it later.
          </p>
          <p className="mt-2">
            Once a story is approved, its photo is shown through a web link. If a moderator
            hides the story later, anyone who saved that link can still open the photo until
            you delete the story.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">The Hyderabad map</h2>
          <p className="mt-2">
            Putting a memory on the map is optional. When you tap where the store was, we keep
            only which 500-metre square of the city you tapped, and the map shows the pin in the
            middle of that square, so it&apos;s within about 500 metres of the store and never
            marks a door or a home. We never use the location from your phone or your photo.
            Only approved memories shared with everyone appear on the map. You can move the pin
            or take it off from your profile at any time. The map itself comes from
            OpenStreetMap, through a free service called OpenFreeMap. When a map opens, your
            phone or computer asks OpenFreeMap for the streets to draw, so it sees your
            internet address, as any website would. It never sees who you are or your memories.
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
            their own cookies. They never see who you are on this site or your memories.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Invite links</h2>
          <p className="mt-2">
            Each memory comes with an invite link for you to send to friends, and they can pass
            it on. Anyone with the link can join through it and, once the memory is approved,
            see it, even if you shared it only by link. When friends join through yours, you see
            their names under that memory and on your activity page. Which link someone joined
            through is visible only to them and to the friend who sent it. Your public profile
            record also notes who invited you, if anyone did. If you delete your account, your
            invite links stop working.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Profiles and following</h2>
          <p className="mt-2">
            Everyone who joins has a profile page with the name and city they chose, the
            memories they shared with everyone, and how many people they follow and are followed
            by. Anyone, even without an account, can open a profile and see who that person
            follows and who follows them. A memory you shared only by link never appears on
            your profile. We ask search engines not to list profiles.
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
          <h2 className="text-lg font-bold">Reporting a memory</h2>
          <p className="mt-2">
            If a memory is unkind, shows private details, or uses your photo or your store
            without your agreement, report it from the memory&apos;s page. A moderator reads
            every report and decides whether to hide the memory; it stays up until they do.
            Moderators can see who sent a report, but the memory&apos;s author can&apos;t. You
            can also email us without an account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">What we never do</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>We never sell your personal data.</li>
            <li>We never show your email address or home location.</li>
            <li>We never use your stories to target ads at you.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold">Your choices</h2>
          <p className="mt-2">
            You can see and edit your public details, and delete your account and everything
            linked to it (your memories and photos, your invite links, who you follow and who
            follows you, the people you blocked, the list of memories you loved and the reports
            you sent), from <strong>Profile and settings</strong> on your profile at any time. You can also write to us to
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
