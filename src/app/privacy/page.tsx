import type { Metadata } from "next";
import { GRIEVANCE_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy · Local Stores & Their Stories",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12 text-ink">
      <h1 className="text-3xl font-extrabold text-brand-red">Privacy notice</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Draft for the pilot. Last updated 7 October 2026.
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
            <li>Which memories you love. Only you can see this; the person who shared a memory sees only how many people loved it.</li>
            <li>Reports you send about a memory. Only moderators can read them.</li>
            <li>The invite links you make, and who joined through them. If you joined through a friend&apos;s invite, who invited you.</li>
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
            you&apos;ll see why on <strong>My account</strong>. We keep a short record of each
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
          <h2 className="text-lg font-bold">Invites and the Memory Chain</h2>
          <p className="mt-2">
            Each memory comes with three personal invite links for you to send to friends. Each
            link works once. When a friend joins through yours, you see their name next to that
            invite, and the Memory Chain shows that you passed the memory on to them.
          </p>
          <p className="mt-2">
            The Memory Chain is public. It names people only through memories they chose to
            show on the Wall; anyone without one appears as &ldquo;a friend&rdquo;. A memory
            you shared only by link never appears on it. If you delete your account, you leave
            the chain and your invite links stop working.
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
            linked to it (your memories and photos, your invite links, the list of memories you
            loved and the reports you sent), from <strong>My account</strong> at any time. You can
            also write to us to access, correct or erase your data.
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
