import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { toast } from "sonner";
import { MapPin, Navigation, Sparkles } from "lucide-react";

export const Route = createFileRoute("/map")({
  head: () => ({ meta: [{ title: "Map — SideQuest" }, { name: "description", content: "Find members near you on the SideQuest live map." }] }),
  component: MapPage,
});

type Member = {
  id: string; display_name: string; avatar_url: string | null;
  city: string | null; bio: string | null;
  latitude: number | null; longitude: number | null;
};

function MapPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<Member | null>(null);
  const [cityInput, setCityInput] = useState("");
  const [savingLoc, setSavingLoc] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("id, display_name, avatar_url, city, bio, latitude, longitude");
    const list = (data ?? []) as Member[];
    setMembers(list.filter((m) => m.id !== user.id && m.latitude != null && m.longitude != null));
    setMe(list.find((m) => m.id === user.id) ?? null);
  };
  useEffect(() => { if (user) load(); }, [user]);

  const useGPS = () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setSavingLoc(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { error } = await supabase.from("profiles").update({
          latitude: pos.coords.latitude, longitude: pos.coords.longitude,
        }).eq("id", user!.id);
        setSavingLoc(false);
        if (error) toast.error(error.message);
        else { toast.success("Location updated"); load(); }
      },
      (err) => { setSavingLoc(false); toast.error(err.message); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const saveCity = async () => {
    if (!cityInput.trim() || !user) return;
    setSavingLoc(true);
    const baseLat = 37.7749 + (Math.random() - 0.5) * 0.02;
    const baseLng = -122.4194 + (Math.random() - 0.5) * 0.02;
    const { error } = await supabase.from("profiles").update({
      city: cityInput.trim(), latitude: baseLat, longitude: baseLng,
    }).eq("id", user.id);
    setSavingLoc(false);
    if (error) toast.error(error.message);
    else { toast.success("Area saved"); setCityInput(""); load(); }
  };

  if (loading || !user) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  const allPts = [...members, ...(me?.latitude != null ? [me] : [])];
  const lats = allPts.map((m) => m.latitude!);
  const lngs = allPts.map((m) => m.longitude!);
  const minLat = Math.min(...lats, (me?.latitude ?? 37.77) - 0.03);
  const maxLat = Math.max(...lats, (me?.latitude ?? 37.77) + 0.03);
  const minLng = Math.min(...lngs, (me?.longitude ?? -122.42) - 0.03);
  const maxLng = Math.max(...lngs, (me?.longitude ?? -122.42) + 0.03);
  const project = (lat: number, lng: number) => ({
    x: ((lng - minLng) / Math.max(maxLng - minLng, 0.0001)) * 100,
    y: 100 - ((lat - minLat) / Math.max(maxLat - minLat, 0.0001)) * 100,
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-primary font-semibold text-sm mb-2">LIVE MAP</p>
            <h1 className="text-4xl md:text-5xl font-bold">Questers near you</h1>
            <p className="text-muted-foreground mt-2">Tap a pin to see who they are and start a quest together.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={useGPS} disabled={savingLoc}
              className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-2.5 font-semibold text-sm flex items-center gap-2 disabled:opacity-50 hover:opacity-90 transition">
              <Navigation className="size-4" /> Use my location
            </button>
            <div className="flex items-center gap-2 bento-card px-3 py-1">
              <input
                value={cityInput} onChange={(e) => setCityInput(e.target.value)} maxLength={100}
                placeholder="or type your area…"
                className="bg-transparent outline-none text-sm w-40 sm:w-52 py-1.5"
              />
              <button onClick={saveCity} disabled={savingLoc || !cityInput.trim()}
                className="text-primary text-sm font-semibold disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-5">
          <div className="bento-card relative aspect-[4/3] lg:aspect-auto lg:min-h-[600px] overflow-hidden">
            <div className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
                backgroundSize: "40px 40px",
              }}/>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />

            {allPts.length === 0 && (
              <div className="absolute inset-0 grid place-items-center text-center px-6">
                <div>
                  <MapPin className="size-10 text-primary mx-auto mb-3" />
                  <p className="font-semibold mb-1">No questers placed yet</p>
                  <p className="text-sm text-muted-foreground">Set your location to put yourself on the map.</p>
                </div>
              </div>
            )}

            {me?.latitude != null && me.longitude != null && (() => {
              const p = project(me.latitude, me.longitude);
              return (
                <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                  <div className="relative">
                    <div className="absolute inset-0 size-10 rounded-full bg-primary/40 animate-ping" />
                    <div className="relative size-10 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground font-bold ring-4 ring-background">
                      You
                    </div>
                  </div>
                </div>
              );
            })()}

            {members.map((m) => {
              const p = project(m.latitude!, m.longitude!);
              return (
                <button key={m.id}
                  onClick={() => setSelected(m)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group"
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                  <div className="size-9 rounded-full bg-card border-2 border-primary grid place-items-center overflow-hidden hover:scale-110 transition shadow-[0_0_20px_-4px_var(--mint)]">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold">{m.display_name[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition pointer-events-none bg-card border border-border rounded-md px-2 py-0.5 text-xs whitespace-nowrap">
                    {m.display_name}
                  </div>
                </button>
              );
            })}
          </div>

          <aside className="bento-card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm text-primary font-semibold">
              <Sparkles className="size-4" /> {members.length} nearby
            </div>
            {selected ? (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="size-14 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground font-bold overflow-hidden">
                    {selected.avatar_url
                      ? <img src={selected.avatar_url} alt="" className="w-full h-full object-cover" />
                      : selected.display_name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold">{selected.display_name}</p>
                    {selected.city && <p className="text-xs text-muted-foreground">{selected.city}</p>}
                  </div>
                </div>
                {selected.bio && <p className="text-sm text-muted-foreground mb-4">{selected.bio}</p>}
                <button className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-2.5 font-semibold text-sm hover:opacity-90 transition">
                  Send quest invite
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {members.length === 0 && <p className="text-sm text-muted-foreground">No one's on the map near you yet — invite a friend.</p>}
                {members.slice(0, 8).map((m) => (
                  <button key={m.id} onClick={() => setSelected(m)}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted/40 transition text-left">
                    <div className="size-9 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground text-sm font-bold overflow-hidden">
                      {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover"/> : m.display_name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{m.display_name}</p>
                      {m.city && <p className="text-xs text-muted-foreground truncate">{m.city}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
