import type { Metadata } from "next";
import Link from "next/link";
import { DAILY_MEMORY_LIMIT } from "@/lib/post-limits";
import { pageTitle } from "@/components/ui";
import { GRIEVANCE_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms and conditions · Local Stores & Their Stories",
  description:
    "The rules for sharing posts about local stores on Local Stores & Their Stories, a campaign by Pick at Store.",
  alternates: { canonical: "/terms" },
  openGraph: { title: "Terms and conditions" },
};

const link = "font-bold text-brand-red underline underline-offset-4";

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-5 sm:py-12 text-ink">
      <h1 className={pageTitle}>Terms and conditions</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Draft for the pilot. Last updated 10 October 2026.
      </p>

      <div className="mt-8 space-y-6 leading-relaxed">
        <section>
          <h2 className="text-lg font-bold">About these terms</h2>
          <p className="mt-2">
            Local Stores &amp; Their Stories is a campaign run by Pick at Store, where people
            share posts about the neighbourhood stores they grew up with. These terms explain
            what you can expect from us and what we expect from you. By joining, you agree to
            them. How we handle your personal data is explained in our{" "}
            <Link href="/privacy" className={link}>
              privacy notice
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Who can join</h2>
          <p className="mt-2">
            You need to be 18 or older and sign in with a Google account. Anyone can read the
            posts without joining. One account per person, please, and keep your Google
            account safe: anything shared from your account is treated as shared by you.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Your posts stay yours</h2>
          <p className="mt-2">
            You keep the rights to the words, photos and videos you share. By sharing a post,
            you let us show it on this site, on the map, in link previews when someone shares
            it, and in the invite links you send, for as long as it stays up. We may resize or
            crop photos so they fit, and we show only the first 30 seconds of a video. You can
            delete a post, or your whole account, at any time from your profile, and it comes
            off the site.
          </p>
          <p className="mt-2">
            Only share photos and videos you took yourself or have permission to use. If they
            show people, make sure they are happy for them to be shared.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">What is not allowed</h2>
          <p className="mt-2">In posts, comments, names, bios, profile photos and anything else you post:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Anything unkind, hateful or threatening about a person, a store or a community.</li>
            <li>Private details such as phone numbers, home addresses or someone else&apos;s photo.</li>
            <li>Photos or words copied from someone else without their permission.</li>
            <li>Advertising, paid promotion or links to sell something.</li>
            <li>Posts you know are made up, or that pretend to be someone else.</li>
            <li>Anything against Indian law.</li>
            <li>Using bots or scripts to post, comment, like, follow, report or sign up.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold">How posts and profiles are checked</h2>
          <p className="mt-2">
            Posts go up straight away. Anyone can report a post, and a moderator reads every
            report. When three people report a post, it comes off the site until a moderator
            has looked at it. We may take a post down if it breaks these terms or someone
            reports it with good reason, and you&apos;ll see why on your profile. To keep the site free of spam,
            each person can share one new post a minute and up to {DAILY_MEMORY_LIMIT} a day.
            Comments show at once, without links, a few a minute; a moderator deletes any that
            break these terms once they are reported. A profile photo shows only once a
            moderator has approved it. If a profile is reported with good reason, a moderator
            may remove its bio or photo, or change its name to Member. We may close the account
            of anyone who keeps breaking these terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Other people&apos;s content</h2>
          <p className="mt-2">
            The Instagram posts on Home belong to the people who posted them, and are shown
            through Curator. Maps come from OpenStreetMap contributors through OpenFreeMap, and
            pins show an area of about 500 metres, never an exact spot. Links to other sites,
            such as directions in Google Maps, follow those sites&apos; own terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">The pilot</h2>
          <p className="mt-2">
            This site is new, and things may change, break or pause while we learn. We provide it
            as it is, free of charge. As far as the law allows, we are not responsible for what
            members write, or for any loss from using the site. Nothing in these terms takes away
            rights you have under Indian law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Changes</h2>
          <p className="mt-2">
            If we change these terms, we&apos;ll update the date at the top of this page. If a
            change matters to how your posts are used, we&apos;ll tell you on the site before
            it takes effect.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">Questions or complaints</h2>
          <p className="mt-2">
            Write to our grievance officer at{" "}
            <a href={`mailto:${GRIEVANCE_EMAIL}`} className={link}>
              {GRIEVANCE_EMAIL}
            </a>
            . To report a post, use Report on its page, or email us if you don&apos;t have an
            account. These terms are governed by the laws of India.
          </p>
        </section>
      </div>
    </main>
  );
}
