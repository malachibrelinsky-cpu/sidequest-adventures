import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions — SideQuest" },
      { name: "description", content: "The Terms and Conditions for using SideQuest, including eligibility, user content, safety, and liability." },
    ],
  }),
  component: TermsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function TermsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Legal</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">Terms and Conditions</h1>
          <p className="text-sm text-muted-foreground">Last Updated: May 11, 2026</p>
        </div>

        <div className="bento-card p-8 space-y-8">
          <p className="text-muted-foreground leading-relaxed">
            Welcome to Sidequest ("Sidequest," "we," "our," or "us"). By accessing or using the Sidequest
            mobile application, website, or related services (collectively, the "Service"), you agree to
            these Terms and Conditions ("Terms"). If you do not agree to these Terms, do not use the Service.
          </p>

          <Section title="1. Eligibility">
            <p>You must be at least 16 years old to use Sidequest. By using the Service, you represent and warrant that:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>You are 16 years of age or older;</li>
              <li>You have the legal authority to agree to these Terms; and</li>
              <li>All information you provide is accurate and truthful.</li>
            </ul>
            <p>We reserve the right to suspend or terminate accounts that violate this age requirement.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              Sidequest is a platform that allows users to connect with others, participate in activities,
              post content, share photos, communicate, and use location-based features.
            </p>
            <p>Features of the Service may include:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>User profiles;</li>
              <li>Location tracking and location-based matching;</li>
              <li>User-uploaded photos and media;</li>
              <li>Messaging and social interaction;</li>
              <li>Community events, quests, or meetups.</li>
            </ul>
            <p>We may modify, suspend, or discontinue any part of the Service at any time without notice.</p>
          </Section>

          <Section title="3. Location Services">
            <p>
              By using Sidequest, you acknowledge and agree that the app may collect, process, and use your
              location data to provide app functionality and improve user experiences.
            </p>
            <p>You may disable location permissions through your device settings, though some features may not function properly without them.</p>
            <p>You understand that sharing your location with other users may involve risks, including unwanted interactions or encounters.</p>
          </Section>

          <Section title="4. User Content and Photos">
            <p>Users may upload photos, text, videos, and other content ("User Content") to the Service.</p>
            <p>By posting User Content, you:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Confirm that you own or have permission to use the content;</li>
              <li>Grant Sidequest a non-exclusive, worldwide, royalty-free license to use, display, reproduce, and distribute the content for operation and promotion of the Service; and</li>
              <li>Accept full responsibility for the content you post.</li>
            </ul>
            <p>You may not upload content that:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Is illegal, abusive, threatening, defamatory, or fraudulent;</li>
              <li>Violates another person's rights;</li>
              <li>Contains nudity, exploitation, or harmful material;</li>
              <li>Promotes scams, violence, or criminal activity.</li>
            </ul>
            <p>We reserve the right to remove any content or suspend accounts at our discretion.</p>
          </Section>

          <Section title="5. User Safety">
            <p>Users are solely responsible for their interactions with other users both online and in person.</p>
            <p>Sidequest does not verify all users and cannot guarantee:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>The identity of users;</li>
              <li>The truthfulness of user information;</li>
              <li>The safety of in-person interactions;</li>
              <li>The legitimacy of quests, events, or offers posted by users.</li>
            </ul>
            <p>You agree to use caution and good judgment when interacting with others.</p>
          </Section>

          <Section title="6. Assumption of Risk">
            <p>By using Sidequest, you acknowledge that participation in meetups, activities, quests, or interactions with other users may involve risks including, but not limited to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Physical injury;</li>
              <li>Theft;</li>
              <li>Fraud or scams;</li>
              <li>Harassment;</li>
              <li>Emotional distress;</li>
              <li>Property damage;</li>
              <li>Serious bodily harm or death.</li>
            </ul>
            <p>You voluntarily assume all risks associated with using the Service.</p>
          </Section>

          <Section title="7. Limitation of Liability">
            <p>To the maximum extent permitted by law, the creators, owners, operators, employees, affiliates, and partners of Sidequest shall not be liable for any:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Injuries; Losses; Damages; Theft; Fraud; Scams; Assaults; Disputes; Death; Emotional distress;</li>
              <li>Or any other harm or damages</li>
            </ul>
            <p>resulting from:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use of the Service;</li>
              <li>Interactions with users;</li>
              <li>Participation in activities or meetups;</li>
              <li>Reliance on user-generated content; or</li>
              <li>Use of location-sharing features.</li>
            </ul>
            <p>Use of Sidequest is entirely at your own risk.</p>
          </Section>

          <Section title="8. Prohibited Conduct">
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Harass, threaten, or harm others;</li>
              <li>Impersonate another person;</li>
              <li>Use the Service for illegal purposes;</li>
              <li>Post fraudulent or misleading information;</li>
              <li>Attempt to hack, disrupt, or abuse the platform;</li>
              <li>Collect user information without permission;</li>
              <li>Use Sidequest to organize illegal activities.</li>
            </ul>
            <p>Violation of these rules may result in suspension or permanent termination.</p>
          </Section>

          <Section title="9. Account Termination">
            <p>
              We reserve the right to suspend or terminate any account at our sole discretion, with or
              without notice, for violations of these Terms or for behavior deemed harmful to the community
              or platform.
            </p>
          </Section>

          <Section title="10. Privacy">
            <p>
              Your use of Sidequest is also governed by our Privacy Policy, which explains how we collect
              and use data including location information and user-generated content.
            </p>
          </Section>

          <Section title="11. Disclaimer of Warranties">
            <p>Sidequest is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, express or implied.</p>
            <p>We do not guarantee:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Continuous availability;</li>
              <li>Accuracy of information;</li>
              <li>Safety of users;</li>
              <li>Error-free operation; or</li>
              <li>That the Service will meet your expectations.</li>
            </ul>
          </Section>

          <Section title="12. Changes to Terms">
            <p>
              We may update these Terms at any time. Continued use of the Service after changes are posted
              constitutes acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="13. Governing Law">
            <p>
              These Terms shall be governed by and interpreted under the laws of the United States and the
              State of North Carolina, without regard to conflict of law principles.
            </p>
          </Section>

          <Section title="14. Contact">
            <p>For questions regarding these Terms, contact:</p>
            <p>
              sidequest.services26@gmail.com
            </p>
          </Section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
