import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { useSettings, type Language, type DistanceUnit, type FontSize } from "@/hooks/use-settings";
import { Accessibility, Globe, MapPin, Ruler, Bell, Type, RotateCcw, Lock } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

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

  useEffect(() => {
    if (!user) return;
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
