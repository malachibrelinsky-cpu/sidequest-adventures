import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Compass } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Join SideQuest" }, { name: "description", content: "Sign in or create your SideQuest account." }] }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  displayName: z.string().trim().min(2).max(50).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) navigate({ to: "/feed" }); }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, displayName: mode === "signup" ? displayName : undefined });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/feed`, data: { display_name: displayName } },
        });
        if (error) throw error;
        toast.success("Welcome to SideQuest!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/feed" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally { setLoading(false); }
  };

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

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text" placeholder="Display name" value={displayName}
              onChange={(e) => setDisplayName(e.target.value)} maxLength={50} required
              className="w-full rounded-xl bg-input/40 border border-border px-4 py-3 outline-none focus:border-primary"
            />
          )}
          <input
            type="email" placeholder="you@email.com" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            className="w-full rounded-xl bg-input/40 border border-border px-4 py-3 outline-none focus:border-primary"
          />
          <input
            type="password" placeholder="Password (min 8 chars)" value={password}
            onChange={(e) => setPassword(e.target.value)} minLength={8} required
            className="w-full rounded-xl bg-input/40 border border-border px-4 py-3 outline-none focus:border-primary"
          />
          <button
            type="submit" disabled={loading}
            className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-3 font-semibold disabled:opacity-50 hover:opacity-90 transition"
          >
            {loading ? "..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === "login" ? "New here?" : "Have an account?"}{" "}
          <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary font-semibold hover:underline">
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
