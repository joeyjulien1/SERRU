'use client';

import { useEffect, useRef } from 'react';

/**
 * Motion on phones and tablets. Parts of each page reveal as they scroll into view, product rows
 * keep the card in front in focus while the others ease back (with a line showing progress along
 * the row), the home hero drifts as you scroll away, and a thin bar tracks progress down the page. The page markup is untouched: elements get a
 * `data-fx` attribute that store.css animates, and it is removed again once they have arrived.
 * Nothing runs on desktop or for visitors who ask for reduced motion.
 */

const MOTION_QUERY = '(max-width: 1023px) and (prefers-reduced-motion: no-preference)';
const RAIL_QUERY = '(max-width: 767px)';

// [selector, effect]: the first effect that matches an element wins.
const REVEALS: [string, string][] = [
  [
    '.section-head .eyebrow, .ooo__intro .eyebrow, .commission .eyebrow, .newsletter .eyebrow, .contact-steps .eyebrow, .contact__form-head .eyebrow',
    'eyebrow',
  ],
  ['.section-head h2, .ooo__intro h2, .commission h2, .newsletter h2, .prose h2, .contact__form-head h2', 'title'],
  ['.rail', 'rail'],
  ['.product-grid:not(.rail) > .product-card', 'card'],
  ['.cat-tile', 'tile'],
  ['.commission', 'window'],
  ['.stat', 'stat'],
  [
    [
      '.section-head__note',
      '.section-head .text-btn',
      '.ooo__intro > p',
      '.ooo__intro > .text-btn',
      '.commission p',
      '.commission > .btn',
      '.newsletter > p',
      '.newsletter > form',
      '.wall__grid > *',
      '.pdp__perks li',
      '.accordion details',
      '.prose > :not(h2)',
      '.contact-method',
      '.contact-steps__list li',
      '.panel',
      '.site-footer__grid > *',
      '.site-footer__payments',
    ].join(', '),
    'up',
  ],
];

/** How long an effect takes, plus room for staggered children, before its styles are dropped. */
const SETTLE_MS = 3400;

type RailState = { frame: number };

export function Motion() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia(MOTION_QUERY).matches) return;
    const railQuery = window.matchMedia(RAIL_QUERY);
    const root = document.documentElement;
    const pending = new Set<HTMLElement>();
    const rails = new Map<HTMLElement, RailState>();
    const timers = new Set<number>();
    let hero: HTMLElement | null = null;
    let frame = 0;

    // ── Reveal on scroll ──
    const arrive = (els: HTMLElement[]) => {
      els
        .map((el) => ({ el, box: el.getBoundingClientRect() }))
        .sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left)
        .forEach(({ el }, i) => {
          io.unobserve(el);
          pending.delete(el);
          // Things that arrive together follow one another.
          el.style.setProperty('--fx-delay', `${Math.min(i, 6) * 90}ms`);
          el.dataset.in = '';
          const timer = window.setTimeout(() => {
            timers.delete(timer);
            delete el.dataset.fx;
            delete el.dataset.in;
            el.style.removeProperty('--fx-delay');
          }, SETTLE_MS + i * 90);
          timers.add(timer);
        });
    };

    const io = new IntersectionObserver(
      (entries) => arrive(entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement)),
      { rootMargin: '0px 0px -6% 0px' },
    );

    /** Marks new elements. On first load whatever is already on screen stays as it is. */
    const scan = (firstLoad: boolean) => {
      for (const [selector, fx] of REVEALS) {
        for (const el of document.querySelectorAll<HTMLElement>(selector)) {
          if (el.dataset.fx || el.closest('.drawer, .search-overlay')) continue;
          if (firstLoad && el.getBoundingClientRect().top < window.innerHeight) continue;
          el.dataset.fx = fx;
          pending.add(el);
          io.observe(el);
        }
      }
      for (const rail of document.querySelectorAll<HTMLElement>('.rail')) {
        if (rails.has(rail)) continue;
        rails.set(rail, { frame: 0 });
        rail.addEventListener('scroll', onRailScroll, { passive: true });
        focusRail(rail);
      }
      for (const [rail, state] of rails) {
        if (rail.isConnected) continue;
        cancelAnimationFrame(state.frame);
        rail.removeEventListener('scroll', onRailScroll);
        rails.delete(rail);
      }
      for (const el of pending) {
        if (el.isConnected) continue;
        io.unobserve(el);
        pending.delete(el);
      }
      hero = document.querySelector<HTMLElement>('.hero');
    };

    // ── Product rows: the card in front stays in focus, the rest ease back; a line shows progress ──
    function focusRail(rail: HTMLElement) {
      const cards = rail.children as HTMLCollectionOf<HTMLElement>;
      const progress = rail.nextElementSibling?.classList.contains('rail-progress')
        ? (rail.nextElementSibling as HTMLElement)
        : null;
      const max = rail.scrollWidth - rail.clientWidth;
      if (progress) {
        progress.toggleAttribute('data-static', max <= 1);
        progress.style.setProperty('--rail-size', (rail.clientWidth / rail.scrollWidth).toFixed(4));
        progress.style.setProperty('--rail-pos', max > 1 ? (rail.scrollLeft / max).toFixed(4) : '0');
      }
      if (cards.length < 2 || !railQuery.matches) return;
      const origin = cards[0].offsetLeft;
      const step = cards[1].offsetLeft - origin;
      if (step <= 0) return;
      for (const card of cards) {
        // 0 for the card in front, 1 for its neighbour (negative to the left).
        const p = Math.max(-1.5, Math.min(1.5, (card.offsetLeft - origin - rail.scrollLeft) / step));
        card.style.setProperty('--p', p.toFixed(3));
        card.style.setProperty('--pc', Math.max(-1, Math.min(1, p)).toFixed(3));
        card.style.setProperty('--pa', Math.min(1, Math.abs(p)).toFixed(3));
      }
    }

    function onRailScroll(event: Event) {
      const rail = event.currentTarget as HTMLElement;
      const state = rails.get(rail);
      if (!state || state.frame) return;
      state.frame = requestAnimationFrame(() => {
        state.frame = 0;
        focusRail(rail);
      });
    }

    // ── Page scroll: progress bar, header shadow, hero drift ──
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(pageFrame);
    };
    function pageFrame() {
      frame = 0;
      const y = window.scrollY;
      const max = root.scrollHeight - window.innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      root.toggleAttribute('data-scrolled', y > 8);
      if (hero?.isConnected) hero.style.setProperty('--hero', Math.min(1, y / hero.offsetHeight).toFixed(3));
      // At the very bottom, anything still waiting (a short last row) arrives.
      if (max > 0 && y >= max - 2) {
        arrive([...pending].filter((el) => el.getBoundingClientRect().top < window.innerHeight));
      }
    }

    const onResize = () => {
      for (const rail of rails.keys()) focusRail(rail);
      onScroll();
    };

    // New content (another page, a filtered list) is marked before it is painted, so it animates in.
    let queued = false;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        scan(false);
      });
    });

    scan(true);
    pageFrame();
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      mo.disconnect();
      io.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      for (const [rail, state] of rails) {
        cancelAnimationFrame(state.frame);
        rail.removeEventListener('scroll', onRailScroll);
      }
      for (const timer of timers) clearTimeout(timer);
      for (const el of document.querySelectorAll<HTMLElement>('[data-fx]')) {
        delete el.dataset.fx;
        delete el.dataset.in;
      }
      root.removeAttribute('data-scrolled');
    };
  }, []);

  return <div ref={bar} className="scroll-progress" aria-hidden="true" />;
}
