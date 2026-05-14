import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Compass, Mail, Phone, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { COUNTRY_CODES, toE164 } from "@/lib/phone";
import type { CountryCode } from "libphonenumber-js";
import { sendPhoneOtp, verifyPhoneOtp, verifyAndAttachPhone } from "@/lib/phone-otp.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Sign in or join — SideQuest" },
    { name: "description", content: "Create a free SideQuest account or sign in to join short, spontaneous adventures with locals near you." },
    { property: "og:title", content: "Sign in or join — SideQuest" },
    { property: "og:description", content: "Create a free SideQuest account or sign in to join short, spontaneous adventures with locals near you." },
  ] }),
  component: AuthPage,
});

type Mode = "login" | "signup";
type Method = "email" | "phone" | "both";

const emailSchema = z.string().email().max(255);
const passwordSchema = z.string().min(8).max(72);
const displayNameSchema = z.string().trim().min(2).max(50);

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [method, setMethod] = useState<Method>("email");

  // Common
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Phone
  const [country, setCountry] = useState<CountryCode>("US");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneE164, setPhoneE164] = useState<string | null>(null);

  // Login phone toggle
  const [loginUsePhone, setLoginUsePhone] = useState(false);

  // Signup consent
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [allowContacts, setAllowContacts] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) navigate({ to: "/feed" }); }, [user, navigate]);

  const reset = () => {
    setOtp(""); setOtpSent(false); setPhoneE164(null);
  };

  // ---------- LOGIN ----------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (loginUsePhone) {
        if (!otpSent) {
          const e164 = toE164(phone, country);
          if (!e164) { toast.error("Enter a valid phone number"); return; }
          await sendPhoneOtp({ data: { phone: e164 } });
          setPhoneE164(e164); setOtpSent(true);
          toast.success("Code sent — check your texts");
        } else {
          const { phone: ph, password: pw } = await verifyPhoneOtp({
            data: { phone: phoneE164!, code: otp.trim(), mode: "login" },
          });
          const { error } = await supabase.auth.signInWithPassword({ phone: ph, password: pw });
          if (error) throw error;
          navigate({ to: "/feed" });
        }
      } else {
        const parsed = emailSchema.safeParse(email);
        if (!parsed.success) { toast.error("Enter a valid email"); return; }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/feed" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally { setLoading(false); }
  };

  // ---------- SIGNUP ----------
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const nameOk = displayNameSchema.safeParse(displayName);
      if (!nameOk.success) { toast.error("Display name must be 2–50 chars"); return; }
      if (!otpSent && !agreedTerms) { toast.error("Please agree to the Terms & Conditions"); return; }

      // Phone-only signup
      if (method === "phone") {
        if (!otpSent) {
          const e164 = toE164(phone, country);
          if (!e164) { toast.error("Enter a valid phone number"); return; }
          await sendPhoneOtp({ data: { phone: e164 } });
          setPhoneE164(e164); setOtpSent(true);
          toast.success("Code sent — check your texts");
        } else {
          const { phone: ph, password: pw } = await verifyPhoneOtp({
            data: { phone: phoneE164!, code: otp.trim(), mode: "signup", displayName },
          });
          const { error } = await supabase.auth.signInWithPassword({ phone: ph, password: pw });
          if (error) throw error;
          navigate({ to: allowContacts ? "/onboarding/contacts" : "/feed" });
        }
        return;
      }

      // Email or Both: create the account with email first
      if (!otpSent) {
        const emOk = emailSchema.safeParse(email);
        const pwOk = passwordSchema.safeParse(password);
        if (!emOk.success) { toast.error("Enter a valid email"); return; }
        if (!pwOk.success) { toast.error("Password must be 8–72 chars"); return; }

        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/feed`, data: { display_name: displayName } },
        });
        if (error) throw error;

        if (method === "both") {
          const e164 = toE164(phone, country);
          if (!e164) { toast.error("Enter a valid phone number"); return; }
          await sendPhoneOtp({ data: { phone: e164 } });
          setPhoneE164(e164); setOtpSent(true);
          toast.success("Verify your phone — code sent");
          return;
        }

        toast.success("Welcome to SideQuest!");
        navigate({ to: allowContacts ? "/onboarding/contacts" : "/feed" });
      } else {
        // both → verify OTP and attach phone to current (already signed-in) user
        await verifyAndAttachPhone({ data: { phone: phoneE164!, code: otp.trim() } });
        navigate({ to: allowContacts ? "/onboarding/contacts" : "/feed" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signup failed");
    } finally { setLoading(false); }
  };

  const inputCls = "w-full rounded-xl bg-input/40 border border-border px-4 py-3 outline-none focus:border-primary";

  const PhoneInputs = (
    <div className="flex gap-2">
      <select
        value={country}
        onChange={(e) => setCountry(e.target.value as CountryCode)}
        className="rounded-xl bg-input/40 border border-border px-3 py-3 outline-none focus:border-primary text-sm"
        aria-label="Country code"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c.code} value={c.code}>{c.label} {c.dial}</option>
        ))}
      </select>
      <input
        type="tel" inputMode="tel" placeholder="Phone number" value={phone}
        onChange={(e) => setPhone(e.target.value)} required className={inputCls}
      />
    </div>
  );

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12">
      <div className="w-full max-w-md bento-card p-8">
        <Link to="/" className="flex items-center gap-2 mb-6">
          <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center">
            <Compass className="size-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-xl">SideQuest</span>
        </Link>
        <h1 className="text-3xl font-bold mb-2">{mode === "login" ? "Welcome back" : "Start questing"}</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          {mode === "login" ? "Sign in to find your next adventure." : "Create an account in 30 seconds."}
        </p>

        {mode === "signup" && !otpSent && (
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted/40 mb-4 text-xs font-semibold">
            {(["email", "phone", "both"] as Method[]).map((m) => (
              <button
                key={m} type="button"
                onClick={() => { setMethod(m); reset(); }}
                className={`py-2 rounded-lg transition ${method === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                {m === "email" ? "Email" : m === "phone" ? "Phone" : "Both"}
              </button>
            ))}
          </div>
        )}

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-3">
            {!loginUsePhone ? (
              <>
                <input type="email" placeholder="you@email.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
                <input type="password" placeholder="Password" value={password}
                  onChange={(e) => setPassword(e.target.value)} required className={inputCls} />
              </>
            ) : !otpSent ? (
              PhoneInputs
            ) : (
              <input
                inputMode="numeric" placeholder="6-digit code" value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6} required className={inputCls}
              />
            )}

            <button type="submit" disabled={loading}
              className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-3 font-semibold disabled:opacity-50 hover:opacity-90 transition">
              {loading ? "..." : loginUsePhone ? (otpSent ? "Verify code" : "Send code") : "Sign in"}
            </button>

            <button type="button"
              onClick={() => { setLoginUsePhone(!loginUsePhone); reset(); }}
              className="w-full text-center text-xs text-muted-foreground hover:text-primary transition flex items-center justify-center gap-1.5 pt-1"
            >
              {loginUsePhone ? <><Mail className="size-3.5" /> Use email instead</> : <><Phone className="size-3.5" /> Sign in with phone</>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-3">
            {!otpSent && (
              <input type="text" placeholder="Display name" value={displayName}
                onChange={(e) => setDisplayName(e.target.value)} maxLength={50} required className={inputCls} />
            )}

            {!otpSent && (method === "email" || method === "both") && (
              <>
                <input type="email" placeholder="you@email.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
                <input type="password" placeholder="Password (min 8 chars)" value={password}
                  onChange={(e) => setPassword(e.target.value)} minLength={8} required className={inputCls} />
              </>
            )}

            {!otpSent && (method === "phone" || method === "both") && PhoneInputs}

            {otpSent && (
              <>
                <p className="text-xs text-muted-foreground">
                  We sent a 6-digit code to <span className="font-medium text-foreground">{phoneE164}</span>.
                </p>
                <input
                  inputMode="numeric" placeholder="6-digit code" value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6} required className={inputCls}
                />
              </>
            )}

            {!otpSent && (method === "phone" || method === "both") && (
              <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 leading-snug">
                <ShieldCheck className="size-3.5 text-primary shrink-0 mt-0.5" />
                We use your phone to secure your account, help friends find you, and prevent spam. You can hide yourself from contact discovery anytime in Settings.
              </p>
            )}

            {!otpSent && (
              <div className="space-y-2 pt-1">
                <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-border accent-primary shrink-0"
                    required
                  />
                  <span>
                    I understand and agree to the{" "}
                    <Link to="/terms" className="text-primary hover:underline">Terms & Conditions</Link>
                    {" "}and{" "}
                    <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowContacts}
                    onChange={(e) => setAllowContacts(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-border accent-primary shrink-0"
                  />
                  <span>
                    <span className="font-medium text-foreground">Optional:</span> Allow SideQuest to access my contacts to find friends already on the app. Phone numbers are hashed locally — we never upload your contact list.
                  </span>
                </label>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-3 font-semibold disabled:opacity-50 hover:opacity-90 transition">
              {loading ? "..." : otpSent ? "Verify code" : (method === "email" ? "Create account" : "Send code")}
            </button>

            {otpSent && (
              <button type="button" onClick={reset}
                className="w-full text-center text-xs text-muted-foreground hover:text-primary transition pt-1">
                Use a different number
              </button>
            )}
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === "login" ? "New here?" : "Have an account?"}{" "}
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); reset(); }} className="text-primary font-semibold hover:underline">
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
