import { useEffect, useState, useCallback } from "react";

export type Language = "en" | "es" | "fr" | "de" | "pt" | "ja";
export type DistanceUnit = "km" | "mi";
export type FontSize = "sm" | "md" | "lg" | "xl";

export type AppSettings = {
  language: Language;
  distanceUnit: DistanceUnit;
  locationEnabled: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  fontSize: FontSize;
  notifications: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  language: "en",
  distanceUnit: "km",
  locationEnabled: true,
  reduceMotion: false,
  highContrast: false,
  fontSize: "md",
  notifications: true,
};

const KEY = "sidequest:settings";

function read(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function applyToDocument(s: AppSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const sizes: Record<FontSize, string> = { sm: "14px", md: "16px", lg: "18px", xl: "20px" };
  root.style.fontSize = sizes[s.fontSize];
  root.classList.toggle("reduce-motion", s.reduceMotion);
  root.classList.toggle("high-contrast", s.highContrast);
  root.lang = s.language;
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const s = read();
    setSettings(s);
    applyToDocument(s);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        const next = read();
        setSettings(next);
        applyToDocument(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      applyToDocument(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch {}
    setSettings(DEFAULT_SETTINGS);
    applyToDocument(DEFAULT_SETTINGS);
  }, []);

  return { settings, update, reset };
}

export function formatDistance(km: number, unit: DistanceUnit): string {
  if (unit === "mi") {
    const mi = km * 0.621371;
    return mi < 0.1 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(1)} mi`;
  }
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}
