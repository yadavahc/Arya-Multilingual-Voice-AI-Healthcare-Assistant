'use client';

/** Animated waveform used on the hero + speaking states. Pure CSS, no deps. */
export function Waveform({ bars = 32, className = '' }: { bars?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="wave-bar w-1.5 rounded-full bg-teal-500"
          style={{
            height: `${20 + (i % 6) * 8}px`,
            animationDelay: `${(i % 8) * 0.09}s`,
          }}
        />
      ))}
    </div>
  );
}
