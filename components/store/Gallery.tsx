'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Media } from '@/lib/media';
import { CategoryArt } from '../CategoryArt';
import { Icon } from '../Icon';

const AUTOPLAY_MS = 3000;

/** Product photos: the main photo first, then the previews — a crossfading slideshow with arrows, dots and swipe. */
export function Gallery({ images, title, fallbackSlug }: { images: Media[]; title: string; fallbackSlug: string }) {
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const swipeStart = useRef<number | null>(null);
  const count = images.length;
  const playing = count > 1 && !hovering && !reducedMotion;

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // Next photo every 3 seconds (skipped while the tab is in the background); any change restarts the timer.
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setIndex((i) => (i + 1) % count);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [playing, index, count]);

  if (count === 0) {
    return (
      <div className="gallery">
        <div className="gallery__stage">
          <div className="gallery__slide" data-active="">
            <CategoryArt slug={fallbackSlug} />
          </div>
        </div>
      </div>
    );
  }

  const step = (delta: number) => setIndex((i) => (i + delta + count) % count);

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType !== 'mouse') setHovering(true); // hold still while a finger is on the photo
    swipeStart.current = e.clientX;
  }
  function onPointerUp(e: PointerEvent) {
    if (e.pointerType !== 'mouse') setHovering(false);
    if (swipeStart.current === null) return;
    const dx = e.clientX - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
  }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else return;
    e.preventDefault();
  }

  return (
    <div
      className="gallery"
      role="region"
      aria-roledescription="carousel"
      aria-label={`${title} photos`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div
        className="gallery__stage"
        tabIndex={count > 1 ? 0 : undefined}
        onKeyDown={count > 1 ? onKeyDown : undefined}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipeStart.current = null;
          setHovering(false);
        }}
        aria-live={playing ? 'off' : 'polite'}
      >
        {images.map((img, i) => (
          <figure
            className="gallery__slide"
            key={img.id}
            data-active={i === index ? '' : undefined}
            aria-hidden={i !== index}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
          >
            <img
              src={img.url}
              alt={img.alt || `${title} — photo ${i + 1}`}
              data-cutout={img.cutout ? '' : undefined}
              width={img.width}
              height={img.height}
              draggable={false}
              fetchPriority={i === 0 ? 'high' : undefined}
            />
          </figure>
        ))}

        {count > 1 && (
          <>
            <button type="button" className="gallery__arrow gallery__arrow--prev" onClick={() => step(-1)} aria-label="Previous photo">
              <Icon name="chevronLeft" size={20} />
            </button>
            <button type="button" className="gallery__arrow gallery__arrow--next" onClick={() => step(1)} aria-label="Next photo">
              <Icon name="chevronRight" size={20} />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="gallery__dots" data-playing={playing ? '' : undefined}>
          {images.map((img, i) => (
            <button
              type="button"
              key={img.id}
              onClick={() => setIndex(i)}
              aria-current={i === index}
              aria-label={`Show photo ${i + 1}`}
            >
              {/* Restarted on every change so the fill tracks the 4-second timer. */}
              {i === index && <span key={index} style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
