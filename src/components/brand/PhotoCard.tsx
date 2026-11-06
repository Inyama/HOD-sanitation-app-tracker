import Image from "next/image";
import { cn } from "@/lib/utils";
import { getPhoto, type PhotoSlot } from "./photos";

interface PhotoCardProps {
  slot: PhotoSlot;
  /** Text shown over the photo. When present a navy overlay (55 to 70 percent) is applied. */
  title?: string;
  caption?: string;
  className?: string;
  /** Overlay strength 0.55 to 0.7 (spec 3.4). */
  overlay?: number;
  sizes?: string;
  priority?: boolean;
  children?: React.ReactNode;
}

const patterns: Record<string, React.CSSProperties> = {
  dots: {
    backgroundImage: "radial-gradient(rgba(255,255,255,.35) 1.2px, transparent 1.2px)",
    backgroundSize: "16px 16px",
  },
  grid: {
    backgroundImage:
      "linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)",
    backgroundSize: "28px 28px",
  },
  waves: {
    backgroundImage: "repeating-radial-gradient(circle at 0 100%, rgba(255,255,255,.16) 0 2px, transparent 2px 22px)",
  },
  rays: {
    backgroundImage:
      "repeating-conic-gradient(from 200deg at 85% 0%, rgba(255,255,255,.14) 0deg 6deg, transparent 6deg 18deg)",
  },
};

/**
 * A photo slot. Uses the real photo when one is configured in photos.json,
 * otherwise a branded gradient and pattern placeholder (never a broken link).
 */
export function PhotoCard({
  slot,
  title,
  caption,
  className,
  overlay = 0.6,
  sizes = "(min-width: 1024px) 33vw, 100vw",
  priority,
  children,
}: PhotoCardProps) {
  const photo = getPhoto(slot);
  const hasText = Boolean(title || caption || children);
  const strength = Math.min(0.7, Math.max(0.55, overlay));

  return (
    <figure
      className={cn("group relative isolate overflow-hidden rounded-(--radius-lg) bg-navy-900 shadow-soft", className)}
    >
      {photo.file ? (
        <Image
          src={photo.file}
          alt={photo.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="-z-20 object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
      ) : (
        <div
          role="img"
          aria-label={`${photo.alt} (placeholder artwork)`}
          className="absolute inset-0 -z-20"
          style={{ backgroundImage: photo.placeholder.gradient }}
        >
          <div className="absolute inset-0" style={patterns[photo.placeholder.pattern]} />
        </div>
      )}
      {hasText && (
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background: `linear-gradient(180deg, rgba(10,26,68,${strength - 0.25}) 0%, rgba(10,26,68,${strength}) 60%, rgba(6,15,43,${strength + 0.1}) 100%)`,
          }}
        />
      )}
      {hasText && (
        <figcaption className="flex h-full flex-col justify-end gap-1 p-5 text-white">
          {title && <span className="font-heading text-xl font-semibold">{title}</span>}
          {caption && <span className="text-sm text-white/85">{caption}</span>}
          {children}
        </figcaption>
      )}
    </figure>
  );
}
