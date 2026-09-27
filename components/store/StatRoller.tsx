'use client';

import { useEffect, useRef, useState } from 'react';

/** A number whose digits roll into place when it scrolls into view. */
export function StatRoller({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const text = value.toLocaleString('en-US');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <span ref={ref} className="stat__value" aria-label={text + suffix}>
      {[...text].map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className="roller" aria-hidden="true">
            <span
              className="roller__strip"
              style={{
                transform: `translateY(-${visible ? Number(ch) : 0}em)`,
                transitionDelay: `${i * 90}ms`,
              }}
            >
              {Array.from({ length: 10 }, (_, d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden="true">
            {ch}
          </span>
        ),
      )}
      {suffix && <span aria-hidden="true">{suffix}</span>}
    </span>
  );
}
