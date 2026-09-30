'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Media } from '@/lib/media';
import { CategoryArt } from '../CategoryArt';
import { Icon } from '../Icon';

export function Gallery({ images, title, fallbackSlug }: { images: Media[]; title: string; fallbackSlug: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const goTo = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  if (images.length === 0) {
    return (
      <div className="gallery">
        <div className="gallery__track">
          <div className="gallery__slide">
            <CategoryArt slug={fallbackSlug} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gallery" aria-roledescription="carousel" aria-label={`${title} images`}>
      <div className="gallery__stage">
        <div className="gallery__track" ref={track} tabIndex={0}>
          {images.map((img, i) => (
            <figure className="gallery__slide" key={img.id} aria-label={`Image ${i + 1} of ${images.length}`}>
              <img
                src={img.url}
                alt={img.alt || `${title} — image ${i + 1}`}
                data-cutout={img.cutout ? '' : undefined}
                width={img.width}
                height={img.height}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : undefined}
              />
            </figure>
          ))}
        </div>
        {images.length > 1 && (
          <>
            <div className="gallery__arrows">
              <button type="button" className="icon-btn" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous image">
                <Icon name="chevronLeft" />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => goTo(index + 1)}
                disabled={index >= images.length - 1}
                aria-label="Next image"
              >
                <Icon name="chevronRight" />
              </button>
            </div>
            <span className="gallery__counter" aria-hidden="true">
              {index + 1} / {images.length} · swipe
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="gallery__thumbs">
          {images.map((img, i) => (
            <button
              type="button"
              key={img.id}
              onClick={() => goTo(i)}
              aria-current={i === index}
              aria-label={`Show image ${i + 1}`}
            >
              <img src={img.thumbUrl} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
