import { Compass } from "lucide-react";

// Visual-only watermark overlay rendered above an inline <video>. The video
// file itself is unmodified — see src/lib/watermark.ts for the image path.
export function VideoWithWatermark({
  src,
  className,
  controls = true,
}: {
  src: string;
  className?: string;
  controls?: boolean;
}) {
  return (
    <div className="relative inline-block w-full">
      <video src={src} controls={controls} playsInline className={className} />
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
