import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — SideQuest" },
      { name: "description", content: "How SideQuest collects, uses, and protects your personal, financial, and location information." },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Legal</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Effective Date: May 10, 2026</p>
        </div>

        <div className="bento-card p-8 space-y-8">
          <p className="text-muted-foreground leading-relaxed">
            Welcome to our application. Your privacy and security are important to us. This Privacy Policy
            explains how we collect, use, and protect your personal and financial information when you use
            our services.
          </p>

          <Section title="Information We Collect">
            <p>We may collect the following types of information:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Personal information such as your name, email address, phone number, and account details.</li>
              <li>Financial information necessary to process payments and transactions.</li>
              <li>Location information used to provide app-related services and features.</li>
            </ul>
          </Section>

          <Section title="How We Use Your Information">
            <p>We only use your information for the purposes necessary to operate and improve our services, including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Processing payments and financial transactions.</li>
              <li>Providing location-based app services and functionality.</li>
              <li>Maintaining account security and preventing fraud.</li>
              <li>Improving user experience and app performance.</li>
            </ul>
          </Section>

          <Section title="Financial Information">
            <p>
              All financial information is handled securely and used solely for payment processing and
              related transaction services. We do not sell, share, or misuse your financial data.
            </p>
          </Section>

          <Section title="Location Information">
            <p>
              Location data is only used to support app services that require location functionality. We do
              not use your location information for unrelated purposes.
            </p>
          </Section>

          <Section title="Data Security">
            <p>
              We take reasonable administrative, technical, and physical measures to protect your personal
              and financial information from unauthorized access, loss, misuse, or disclosure.
            </p>
          </Section>

          <Section title="Sharing of Information">
            <p>We do not sell or rent your personal or financial information to third parties. Information may only be shared when necessary to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Process payments through secure payment providers.</li>
              <li>Comply with legal obligations.</li>
              <li>Protect the safety, rights, and security of users and the platform.</li>
            </ul>
          </Section>

          <Section title="Your Rights">
            <p>
              You may request access to, correction of, or deletion of your personal information, subject to
              applicable laws and operational requirements.
            </p>
          </Section>

          <Section title="Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. Continued use of the app after changes
              are posted constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section title="Contact Us">
            <p>
              If you have questions about this Privacy Policy or how your information is handled, please
              contact us through the app's support channels.
            </p>
          </Section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
