// Burn a "Sidequest" + compass watermark into the bottom-right corner of an
// uploaded image. Videos are watermarked at display time via <VideoWithWatermark>
// since transcoding video in the browser is too heavy.

const COMPASS_SVG = (size: number, color: string) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
     fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"/>
  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
</svg>`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function isImageType(file: File): boolean {
  if (file.type) return file.type.startsWith("image/");
  return /\.(png|jpe?g|webp|gif|avif|heic|bmp)$/i.test(file.name);
}

export async function watermarkImage(file: File): Promise<File> {
  if (!isImageType(file)) return file;
  // Skip GIF (animated) and HEIC (browser may not decode) — return original.
  if (/gif|heic|heif/i.test(file.type)) return file;

  let bitmap: HTMLImageElement | ImageBitmap;
  try {
    if ("createImageBitmap" in window) {
      bitmap = await createImageBitmap(file);
    } else {
      const url = URL.createObjectURL(file);
      try {
        bitmap = await loadImage(url);
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  } catch {
    return file; // unable to decode — upload as-is
  }

  const w = (bitmap as any).width as number;
  const h = (bitmap as any).height as number;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);

  // Scale watermark relative to the smaller dimension so it looks consistent
  // on both portrait and landscape images. Caps prevent micro/giant marks.
  const base = Math.min(w, h);
  const fontSize = Math.max(14, Math.min(48, Math.round(base * 0.035)));
  const iconSize = Math.round(fontSize * 1.15);
  const gap = Math.round(fontSize * 0.4);
  const padX = Math.round(fontSize * 0.9);
  const padY = Math.round(fontSize * 0.55);
  const margin = Math.max(12, Math.round(base * 0.025));

  ctx.font = `700 ${fontSize}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Inter, sans-serif`;
  ctx.textBaseline = "middle";
  const text = "Sidequest";
  const textWidth = ctx.measureText(text).width;
  const pillW = padX * 2 + textWidth + gap + iconSize;
  const pillH = padY * 2 + Math.max(fontSize, iconSize);
  const pillX = w - margin - pillW;
  const pillY = h - margin - pillH;

  // Draw soft drop shadow for legibility on any background
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = Math.round(fontSize * 0.6);
  ctx.shadowOffsetY = 1;
  // Pill background
  const radius = pillH / 2;
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  roundedRect(ctx, pillX, pillY, pillW, pillH, radius);
  ctx.fill();
  ctx.restore();

  // Text
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.textBaseline = "middle";
  const textX = pillX + padX;
  const textY = pillY + pillH / 2;
  ctx.fillText(text, textX, textY);

  // Compass icon (loaded from inline SVG)
  try {
    const svg = COMPASS_SVG(iconSize, "#ffffff").trim();
    const svgUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    const icon = await loadImage(svgUrl);
    const iconX = textX + textWidth + gap;
    const iconY = pillY + (pillH - iconSize) / 2;
    ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
  } catch {
    // If the icon fails to load (rare), the text-only watermark still ships.
  }

  // Encode. JPEG for opaque sources to keep size down; PNG for transparency.
  const wantsPng = /png|webp/i.test(file.type);
  const mime = wantsPng ? "image/png" : "image/jpeg";
  const quality = wantsPng ? undefined : 0.92;
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, mime, quality),
  );
  if (!blob) return file;

  const ext = mime === "image/png" ? "png" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${baseName}.wm.${ext}`, { type: mime });
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
