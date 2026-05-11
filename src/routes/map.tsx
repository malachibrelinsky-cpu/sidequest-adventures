import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { toast } from "sonner";
import { MapPin, Navigation, Sparkles, MessageCircle, Trophy, Users, Clock } from "lucide-react";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Map — SideQuest" },
      { name: "description", content: "Find SideQuest members near you on a live worldwide map." },
    ],
    links: [
      { rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
    ],
  }),
  component: MapPage,
});

type Member = {
  id: string; display_name: string; avatar_url: string | null;
  city: string | null; bio: string | null;
  latitude: number | null; longitude: number | null;
};

type Quest = {
  id: string; caption: string | null; location: string | null;
  difficulty: string | null; points: number | null;
  participants_needed: number | null; quest_time: string | null;
  latitude: number; longitude: number;
  profiles: { display_name: string; avatar_url: string | null } | null;
};

function MapPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<Member | null>(null);
  const [savingLoc, setSavingLoc] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("id, display_name, avatar_url, city, bio, latitude, longitude");
    const list = (data ?? []) as Member[];
    setMembers(list.filter((m) => m.id !== user.id && m.latitude != null && m.longitude != null));
    setMe(list.find((m) => m.id === user.id) ?? null);

    const { data: qData } = await supabase
      .from("posts")
      .select("id, caption, location, difficulty, points, participants_needed, quest_time, latitude, longitude, profiles!posts_user_id_fkey(display_name, avatar_url)")
      .not("difficulty", "is", null)
      .not("latitude", "is", null)
      .is("completed_at", null)
      .order("created_at", { ascending: false });
    setQuests((qData ?? []) as unknown as Quest[]);
  };
  useEffect(() => { if (user) load(); }, [user]);

  const useGPS = () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setSavingLoc(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Reverse geocode for city name (free, no key required)
        let cityName: string | null = null;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=10`);
          const j = await r.json();
          cityName = j.address?.city || j.address?.town || j.address?.village || j.address?.state || j.address?.country || null;
        } catch {}
        const update: { latitude: number; longitude: number; city?: string } = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        if (cityName) update.city = cityName;
        const { error } = await supabase.from("profiles").update(update).eq("id", user!.id);
        setSavingLoc(false);
        if (error) toast.error(error.message);
        else { toast.success(cityName ? `Located in ${cityName}` : "Location updated"); load(); }
      },
      (err) => { setSavingLoc(false); toast.error(err.message); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const searchCity = async (query: string) => {
    if (!query.trim() || !user) return;
    setSavingLoc(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
      const j = await r.json();
      if (!j[0]) { toast.error("City not found"); setSavingLoc(false); return; }
      const { error } = await supabase.from("profiles").update({
        city: query.trim(),
        latitude: parseFloat(j[0].lat),
        longitude: parseFloat(j[0].lon),
      }).eq("id", user.id);
      if (error) toast.error(error.message);
      else { toast.success(`Located in ${query}`); load(); }
    } catch { toast.error("Geocoding failed"); }
    setSavingLoc(false);
  };

  if (loading || !user) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-primary font-semibold text-sm mb-2">LIVE MAP</p>
            <h1 className="text-4xl md:text-5xl font-bold">Questers worldwide</h1>
            <p className="text-muted-foreground mt-2">Real GPS, real cities. Tap a pin to start a chat.</p>
          </div>
          <LocationControls onGPS={useGPS} onCity={searchCity} saving={savingLoc} />
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-5">
          <div className="bento-card relative aspect-[4/3] lg:aspect-auto lg:min-h-[600px] overflow-hidden p-0">
            <LeafletMap me={me} members={members} onSelect={setSelected} />
          </div>

          <aside className="bento-card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm text-primary font-semibold">
              <Sparkles className="size-4" /> {members.length} questers on the map
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
                <Link
                  to="/messages/$userId" params={{ userId: selected.id }}
                  className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-2.5 font-semibold text-sm hover:opacity-90 transition flex items-center justify-center gap-2"
                >
                  <MessageCircle className="size-4" /> Start a chat
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {members.length === 0 && <p className="text-sm text-muted-foreground">No one's on the map yet — set your location or invite a friend.</p>}
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

function LocationControls({ onGPS, onCity, saving }: { onGPS: () => void; onCity: (q: string) => void; saving: boolean }) {
  const [city, setCity] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={onGPS} disabled={saving}
        className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-2.5 font-semibold text-sm flex items-center gap-2 disabled:opacity-50 hover:opacity-90 transition">
        <Navigation className="size-4" /> Use my GPS
      </button>
      <form
        onSubmit={(e) => { e.preventDefault(); onCity(city); setCity(""); }}
        className="flex items-center gap-2 bento-card px-3 py-1"
      >
        <input
          value={city} onChange={(e) => setCity(e.target.value)} maxLength={100}
          placeholder="search city worldwide…"
          className="bg-transparent outline-none text-sm w-44 sm:w-56 py-1.5"
        />
        <button type="submit" disabled={saving || !city.trim()}
          className="text-primary text-sm font-semibold disabled:opacity-50">Go</button>
      </form>
    </div>
  );
}

function LeafletMap({ me, members, onSelect }: { me: Member | null; members: Member[]; onSelect: (m: Member) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      if (!mapRef.current) {
        const center: [number, number] = me?.latitude != null && me.longitude != null
          ? [me.latitude, me.longitude]
          : [20, 0];
        const zoom = me?.latitude != null ? 11 : 2;
        mapRef.current = L.map(ref.current, { zoomControl: true, attributionControl: false }).setView(center, zoom);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 19,
        }).addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!layerRef.current) return;
      layerRef.current.clearLayers();

      const mintMarker = (label: string, isMe: boolean, avatar: string | null) => {
        const initial = label[0]?.toUpperCase() ?? "?";
        const html = isMe
          ? `<div style="position:relative;width:42px;height:42px"><div style="position:absolute;inset:0;border-radius:9999px;background:rgba(115,255,184,.4);animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite"></div><div style="position:relative;width:42px;height:42px;border-radius:9999px;background:linear-gradient(135deg,#2dd4a8,#73ffb8);display:grid;place-items:center;color:#0d1b2a;font-weight:800;font-size:11px;border:3px solid #0d1b2a;box-shadow:0 0 20px #2dd4a8">You</div></div>`
          : `<div style="width:38px;height:38px;border-radius:9999px;background:#0d1b2a;border:2px solid #2dd4a8;display:grid;place-items:center;color:#fff;font-weight:700;font-size:14px;overflow:hidden;box-shadow:0 0 18px -4px #2dd4a8">${avatar ? `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover"/>` : initial}</div>`;
        return L.divIcon({ html, className: "", iconSize: [42, 42], iconAnchor: [21, 21] });
      };

      if (me?.latitude != null && me.longitude != null) {
        L.marker([me.latitude, me.longitude], { icon: mintMarker("You", true, null) })
          .bindTooltip("You", { direction: "top" })
          .addTo(layerRef.current);
      }
      members.forEach((m) => {
        const marker = L.marker([m.latitude!, m.longitude!], { icon: mintMarker(m.display_name, false, m.avatar_url) })
          .bindTooltip(m.display_name, { direction: "top" })
          .on("click", () => onSelect(m));
        marker.addTo(layerRef.current);
      });

      // Recenter if we just got a location
      if (me?.latitude != null && me.longitude != null && mapRef.current.getZoom() < 5) {
        mapRef.current.setView([me.latitude, me.longitude], 11);
      }
    })();
  }, [ready, me, members, onSelect]);

  return (
    <>
      <style>{`@keyframes ping { 75%,100% { transform: scale(2); opacity: 0; } }`}</style>
      <div ref={ref} className="absolute inset-0 z-0" />
    </>
  );
}
