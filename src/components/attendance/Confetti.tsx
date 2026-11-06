"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

/** One-off gold confetti burst for a successful check-in (spec 3.7). Off under reduced motion. */
export function Confetti({ pieces = 28 }: { pieces?: number }) {
  const reduce = useReducedMotion();
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => {
        const angle = (i / pieces) * Math.PI * 2 + (i % 3) * 0.2;
        const dist = 90 + ((i * 37) % 70);
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 40,
          rotate: (i * 47) % 360,
          color: ["#f5d27a", "#d4a437", "#b8861b", "#fdf3d4"][i % 4],
          w: 6 + (i % 3) * 2,
        };
      }),
    [pieces],
  );
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute rounded-sm"
          style={{ width: b.w, height: b.w * 0.6, backgroundColor: b.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
          animate={{ x: b.x, y: b.y + 120, opacity: 0, rotate: b.rotate + 180, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </div>
  );
}
