import { Compass } from "lucide-react";

// Display-time watermark overlay for images. New uploads also get the mark
// burned into the file via src/lib/watermark.ts; this overlay ensures older
// posts (uploaded before that change) still show the Sidequest mark in-app.
export function ImageWithWatermark({
  src,
  className,
  alt = "",
  loading = "lazy",
}: {
  src: string;
  className?: string;
  alt?: string;
  loading?: "lazy" | "eager";
}) {
  return (
    <div className="relative inline-block w-full h-full">
      <img src={src} alt={alt} loading={loading} className={className} />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-white text-xs font-bold shadow-md backdrop-blur-[2px]"
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
      >
        <span>Sidequest</span>
        <Compass className="size-3.5" strokeWidth={2.4} />
      </div>
    </div>
  );
}
