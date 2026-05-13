import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { useSettings, type Language, type DistanceUnit, type FontSize } from "@/hooks/use-settings";
import { Accessibility, Globe, MapPin, Ruler, Bell, Type, RotateCcw, Lock, User as UserIcon, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toE164 } from "@/lib/phone";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SideQuest" },
      { name: "description", content: "Adjust accessibility, language, location, units and other in-app preferences." },
    ],
  }),
  component: SettingsPage,
});

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Português" },
  { value: "ja", label: "日本語" },
];

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Extra large" },
];

function SettingsPage() {
  const { settings, update, reset } = useSettings();
  const { user } = useAuth();
  const [discoverable, setDiscoverable] = useState<boolean | null>(null);
  const [hasPhone, setHasPhone] = useState(false);

  // Account state
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [phone, setPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");

  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    setPhone(user.phone ? `+${user.phone}` : "");
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.display_name) setDisplayName(data.display_name);
    });
    supabase.rpc("get_my_profile_phone").then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setDiscoverable(row.discoverable_by_contacts ?? true);
        setHasPhone(!!row.phone_e164);
      }
    });
  }, [user]);

  const toggleDiscoverable = async (v: boolean) => {
    setDiscoverable(v);
    const { error } = await supabase.from("profiles").update({ discoverable_by_contacts: v }).eq("id", user!.id);
    if (error) { toast.error(error.message); setDiscoverable(!v); }
    else toast.success(v ? "You're discoverable by contacts" : "Hidden from contact discovery");
  };

  const saveDisplayName = async () => {
    const name = displayName.trim();
    if (name.length < 2 || name.length > 50) { toast.error("Username must be 2-50 characters"); return; }
    setSavingName(true);
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user!.id);
    setSavingName(false);
    if (error) toast.error(error.message);
    else toast.success("Username updated");
  };

  const saveEmail = async () => {
    const trimmed = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) { toast.error("Enter a valid email"); return; }
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    setSavingEmail(false);
    if (error) toast.error(error.message);
    else toast.success("Check your inbox to confirm the new email");
  };

  const sendPhoneOtp = async () => {
    const e164 = toE164(phone);
    if (!e164) { toast.error("Enter a valid phone number with country code"); return; }
    setSavingPhone(true);
    const { error } = await supabase.auth.updateUser({ phone: e164 });
    setSavingPhone(false);
    if (error) { toast.error(error.message); return; }
    setPendingPhone(e164);
    setOtpStep(true);
    toast.success("Verification code sent");
  };

  const verifyPhoneOtp = async () => {
    if (!/^\d{6}$/.test(otpCode)) { toast.error("Enter the 6-digit code"); return; }
    setSavingPhone(true);
    const { error } = await supabase.auth.verifyOtp({ phone: pendingPhone, token: otpCode, type: "phone_change" });
    setSavingPhone(false);
    if (error) { toast.error(error.message); return; }
    setOtpStep(false);
    setOtpCode("");
    setHasPhone(true);
    toast.success("Phone number updated");
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Tune SideQuest to fit how you explore.</p>
          </div>
          <button
            onClick={() => { reset(); toast.success("Settings reset"); }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs hover:border-primary transition"
          >
            <RotateCcw className="size-3.5" /> Reset
          </button>
        </div>

        <div className="space-y-4">
          <Section icon={<Accessibility className="size-4 text-primary" />} title="Accessibility" desc="Adjust how the app feels and reads.">
            <Toggle
              label="Reduce motion"
              desc="Minimize animations and transitions."
              value={settings.reduceMotion}
              onChange={(v) => update("reduceMotion", v)}
            />
            <Toggle
              label="High contrast"
              desc="Boost color contrast for legibility."
              value={settings.highContrast}
              onChange={(v) => update("highContrast", v)}
            />
            <SelectRow
              icon={<Type className="size-4 text-muted-foreground" />}
              label="Text size"
              value={settings.fontSize}
              options={FONT_SIZES}
              onChange={(v) => update("fontSize", v as FontSize)}
            />
          </Section>

          <Section icon={<Globe className="size-4 text-primary" />} title="Language" desc="Pick your preferred language.">
            <SelectRow
              label="Language"
              value={settings.language}
              options={LANGUAGES}
              onChange={(v) => update("language", v as Language)}
            />
          </Section>

          <Section icon={<MapPin className="size-4 text-primary" />} title="Location" desc="Used to show nearby quests and distances.">
            <Toggle
              label="Use my location"
              desc="Let SideQuest read your device location."
              value={settings.locationEnabled}
              onChange={(v) => update("locationEnabled", v)}
            />
          </Section>

          <Section icon={<Ruler className="size-4 text-primary" />} title="Units" desc="How distances are displayed across the app.">
            <div className="flex gap-2">
              {(["km", "mi"] as DistanceUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => update("distanceUnit", u)}
                  className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
                    settings.distanceUnit === u
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {u === "km" ? "Kilometers" : "Miles"}
                </button>
              ))}
            </div>
          </Section>

          <Section icon={<Bell className="size-4 text-primary" />} title="Notifications" desc="Heads-up when something happens.">
            <Toggle
              label="In-app notifications"
              desc="Show toasts for new messages, joins and replies."
              value={settings.notifications}
              onChange={(v) => update("notifications", v)}
            />
          </Section>

          {user && (
            <Section icon={<UserIcon className="size-4 text-primary" />} title="Account" desc="Update your username, email and phone.">
              <div className="rounded-lg p-3">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><UserIcon className="size-3.5" /> Username</label>
                <div className="flex gap-2">
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={50}
                    className="flex-1 rounded-lg bg-input/40 border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <button onClick={saveDisplayName} disabled={savingName} className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-4 py-2 text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition">
                    {savingName ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>

              <div className="rounded-lg p-3">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><Mail className="size-3.5" /> Email</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 rounded-lg bg-input/40 border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <button onClick={saveEmail} disabled={savingEmail} className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-4 py-2 text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition">
                    {savingEmail ? "Saving…" : "Save"}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">You'll receive a confirmation link at the new address.</p>
              </div>

              <div className="rounded-lg p-3">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><Phone className="size-3.5" /> Phone</label>
                {!otpStep ? (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 555 123 4567"
                        className="flex-1 rounded-lg bg-input/40 border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                      <button onClick={sendPhoneOtp} disabled={savingPhone} className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-4 py-2 text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition">
                        {savingPhone ? "Sending…" : "Send code"}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">We'll text a 6-digit code to verify the new number.</p>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <input
                      inputMode="numeric"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                      className="flex-1 rounded-lg bg-input/40 border border-border px-3 py-2 text-sm outline-none focus:border-primary tracking-widest"
                    />
                    <button onClick={verifyPhoneOtp} disabled={savingPhone} className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-4 py-2 text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition">
                      {savingPhone ? "Verifying…" : "Verify"}
                    </button>
                    <button onClick={() => { setOtpStep(false); setOtpCode(""); }} className="text-xs text-muted-foreground hover:text-foreground px-2">Cancel</button>
                  </div>
                )}
              </div>
            </Section>
          )}

          {user && (
            <Section icon={<Lock className="size-4 text-primary" />} title="Privacy" desc="Control how others can find you.">
              <Toggle
                label="Discoverable by contacts"
                desc={hasPhone
                  ? "Friends with your number in their contacts can find you on SideQuest."
                  : "Add a phone number to your account to enable contact discovery."}
                value={discoverable ?? false}
                onChange={(v) => { if (hasPhone) toggleDiscoverable(v); else toast.info("Add a phone number first"); }}
              />
            </Section>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="bento-card p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="size-8 rounded-lg bg-primary/10 grid place-items-center">{icon}</div>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer rounded-lg p-3 hover:bg-muted/30 transition">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {desc && <span className="block text-xs text-muted-foreground">{desc}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition ${value ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-background transition-transform ${value ? "translate-x-5" : ""}`}
        />
      </button>
    </label>
  );
}

function SelectRow({ icon, label, value, options, onChange }: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-muted/30 transition">
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg bg-input/40 border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
