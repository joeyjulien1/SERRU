'use client';

import { useEffect, useState } from 'react';

const INTERVAL_MS = 5000;

type HeroImage = { url: string; alt: string; width: number; height: number };

/**
 * The home hero photo. With two photos (Admin → Settings → Hero photos) they crossfade every
 * 5 seconds; the first stays in place underneath and sets the size, the second fades over it.
 * Holds still for visitors who ask for reduced motion, and while the tab is in the background.
 */
export function HeroSlideshow({ images }: { images: HeroImage[] }) {
  const [index, setIndex] = useState(0);
  const count = images.length;

  useEffect(() => {
    if (count < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setIndex((i) => (i + 1) % count);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [count]);

  return images.map((img, i) => (
    <img
      key={img.url}
      src={img.url}
      alt={i === index ? img.alt : ''}
      aria-hidden={i !== index || undefined}
      data-active={i === index ? '' : undefined}
      width={img.width}
      height={img.height}
      fetchPriority={i === 0 ? 'high' : undefined}
    />
  ));
}
