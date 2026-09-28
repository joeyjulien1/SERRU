'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Icon } from '../Icon';
import { Alert } from '../ui';

type Rect = { x: number; y: number; w: number; h: number }; // fractions of the photo, 0–1
type Photo = { url: string; width: number; height: number };
type Result = { url: string; file: File };
type Drag = { mode: 'move' | 'resize' | 'draw'; startX: number; startY: number; rect: Rect };

// Phone photos are 12+ MP; this keeps everything fast while staying sharp on screen and when saved.
const MAX_SIDE = 1800;
const MIN_W = 0.04;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous'; // product photos come from the image CDN; needed to save the canvas
  img.src = src;
  return img.decode().then(() => img);
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image'))), 'image/jpeg', 0.9),
  );
}

/** Reads the customer's photo in the browser (it is never uploaded), upright and resized. */
async function preparePhoto(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { url: URL.createObjectURL(await toJpeg(canvas)), width: canvas.width, height: canvas.height };
}

/** The saved picture: the wall photo with the piece drawn where the customer placed it. */
async function renderPreview(photo: Photo, rect: Rect, artUrl: string): Promise<Blob> {
  const [wall, piece] = await Promise.all([loadImage(photo.url), loadImage(artUrl)]);
  const canvas = document.createElement('canvas');
  canvas.width = photo.width;
  canvas.height = photo.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(wall, 0, 0, canvas.width, canvas.height);
  const x = rect.x * canvas.width;
  const y = rect.y * canvas.height;
  const w = rect.w * canvas.width;
  const h = rect.h * canvas.height;
  // Soft shadow on the wall, as on screen.
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = Math.max(8, w * 0.06);
  ctx.shadowOffsetY = Math.max(3, h * 0.025);
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  // The artwork, cropped like `object-fit: cover`.
  const s = Math.max(w / piece.naturalWidth, h / piece.naturalHeight);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(piece, (piece.naturalWidth - sw) / 2, (piece.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
  return toJpeg(canvas);
}

export function WallPreview({
  slug,
  title,
  art,
}: {
  slug: string;
  title: string;
  art: { url: string; width: number; height: number };
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  // Height of a box `w` wide (as a fraction of the photo width) that keeps the artwork's proportions, and back.
  const artRatio = art.width > 0 && art.height > 0 ? art.width / art.height : 3 / 4;
  const heightFor = (w: number, p: Photo) => (w * p.width) / artRatio / p.height;
  const widthFor = (h: number, p: Photo) => (h * p.height * artRatio) / p.width;
  const maxWidth = (r: Rect, p: Photo) => Math.min(1 - r.x, widthFor(1 - r.y, p));

  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo]);
  useEffect(() => () => void (result && URL.revokeObjectURL(result.url)), [result]);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const p = await preparePhoto(file);
      let w = 0.36;
      if (heightFor(w, p) > 0.6) w = widthFor(0.6, p);
      const h = heightFor(w, p);
      setPhoto(p);
      setRect({ x: (1 - w) / 2, y: clamp(0.42 - h / 2, 0.02, 1 - h), w, h });
      setResult(null);
    } catch {
      setError('We could not open that photo. Please use a JPG or PNG image.');
    } finally {
      if (input.current) input.current.value = '';
    }
  }

  function pointAt(e: ReactPointerEvent) {
    const box = frame.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - box.left) / box.width, 0, 1), y: clamp((e.clientY - box.top) / box.height, 0, 1) };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!photo || !rect || result) return;
    const p = pointAt(e);
    const target = e.target as HTMLElement;
    const mode = target.dataset.handle !== undefined ? 'resize' : target.closest('[data-art]') ? 'move' : 'draw';
    drag.current = { mode, startX: p.x, startY: p.y, rect };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || !photo) return;
    const p = pointAt(e);
    const r = d.rect;
    if (d.mode === 'move') {
      setRect({ ...r, x: clamp(r.x + p.x - d.startX, 0, 1 - r.w), y: clamp(r.y + p.y - d.startY, 0, 1 - r.h) });
      return;
    }
    if (d.mode === 'resize') {
      // The top-left corner stays put; the size follows whichever way the corner moved further,
      // so pulling it in makes the piece smaller and pulling it out makes it bigger.
      const byX = p.x - d.startX;
      const byY = widthFor(p.y - d.startY, photo);
      const w = clamp(r.w + (Math.abs(byX) > Math.abs(byY) ? byX : byY), MIN_W, maxWidth(r, photo));
      setRect({ ...r, w, h: heightFor(w, photo) });
      return;
    }
    // Drawing a new box from where the finger went down.
    const span = Math.max(Math.abs(p.x - d.startX), widthFor(Math.abs(p.y - d.startY), photo));
    if (span < 0.02) return;
    const w = clamp(span, MIN_W, Math.min(1, widthFor(1, photo)));
    const h = heightFor(w, photo);
    const x = p.x < d.startX ? d.startX - w : d.startX;
    const y = p.y < d.startY ? d.startY - h : d.startY;
    setRect({ x: clamp(x, 0, 1 - w), y: clamp(y, 0, 1 - h), w, h });
  }

  function onPointerUp() {
    drag.current = null;
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!photo || !rect) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      const [dx, dy] = moves[e.key];
      setRect({ ...rect, x: clamp(rect.x + dx, 0, 1 - rect.w), y: clamp(rect.y + dy, 0, 1 - rect.h) });
    } else if (e.key === '+' || e.key === '=' || e.key === '-') {
      const w = clamp(rect.w * (e.key === '-' ? 0.93 : 1.07), MIN_W, maxWidth(rect, photo));
      setRect({ ...rect, w, h: heightFor(w, photo) });
    } else {
      return;
    }
    e.preventDefault();
  }

  async function save() {
    if (!photo || !rect) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await renderPreview(photo, rect, art.url);
      const file = new File([blob], `${slug}-on-my-wall.jpg`, { type: 'image/jpeg' });
      // Phones get the share sheet ("Save image", WhatsApp…); computers get a download.
      setCanShare(window.matchMedia('(pointer: coarse)').matches && Boolean(navigator.canShare?.({ files: [file] })));
      setResult({ url: URL.createObjectURL(blob), file });
    } catch {
      setError('We could not create the image. You can take a screenshot of the preview instead.');
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    if (!result) return;
    try {
      await navigator.share({ files: [result.file], title: `${title} on my wall` });
    } catch {
      // Closed the share sheet — nothing to do.
    }
  }

  function reset() {
    setPhoto(null);
    setRect(null);
    setResult(null);
    setError(null);
  }

  return (
    <section className="section section--tight wall" aria-labelledby="wall-title">
      <div className="container">
        <div className="section-head">
          <div className="section-head__text">
            <span className="eyebrow">Visualise it</span>
            <h2 id="wall-title" className="h2">
              See it on your wall
            </h2>
            <p className="lead">Photograph your wall, mark where {title} should hang, and see it in your own space before you order.</p>
          </div>
        </div>

        <div className="wall__grid">
          <div className="wall__stage">
            {!photo ? (
              <label htmlFor={inputId} className="wall__empty">
                <Icon name="image" size={30} />
                <span className="h3">Add a photo of your wall</span>
                <span className="small muted">Take one now or choose from your photos</span>
                <span className="btn">
                  <Icon name="upload" size={18} /> Upload photo
                </span>
              </label>
            ) : (
              <div
                ref={frame}
                className="wall__frame"
                data-editing={!result ? '' : undefined}
                style={{ aspectRatio: `${photo.width} / ${photo.height}`, maxWidth: `calc(72vh * ${photo.width / photo.height})` }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <img className="wall__photo" src={result ? result.url : photo.url} alt={result ? `${title} on your wall` : 'Your wall'} draggable={false} />
                {!result && rect && (
                  <div
                    data-art=""
                    className="wall__art"
                    style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
                    tabIndex={0}
                    role="group"
                    aria-label={`${title} on your wall. Drag to move, drag the corner to resize, or use the arrow keys and plus or minus.`}
                    onKeyDown={onKeyDown}
                  >
                    <img src={art.url} alt="" crossOrigin="anonymous" draggable={false} />
                    <span className="wall__handle" data-handle="" aria-hidden="true" />
                  </div>
                )}
                {result && <span className="wall__badge">Your preview</span>}
              </div>
            )}
            <input
              ref={input}
              id={inputId}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void choose(e.target.files?.[0])}
            />
          </div>

          <div className="wall__panel">
            <ol className="wall__steps">
              <li data-done={photo ? '' : undefined}>
                <strong>Photograph your wall</strong>
                <span>Stand back and shoot straight on, in good daylight.</span>
              </li>
              <li data-done={photo && rect ? '' : undefined}>
                <strong>Mark the spot</strong>
                <span>Drag the piece into place and pull its corner to resize it — or draw a new box on the wall.</span>
              </li>
              <li data-done={result ? '' : undefined}>
                <strong>Save your preview</strong>
                <span>Keep it, or send it to anyone whose opinion counts.</span>
              </li>
            </ol>

            {error && <Alert tone="error">{error}</Alert>}

            {photo && !result && (
              <div className="wall__actions">
                <button type="button" className="btn btn--block" onClick={() => void save()} disabled={saving || !rect}>
                  {saving ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" size={18} />} Save this preview
                </button>
                <label htmlFor={inputId} className="btn btn--outline btn--block">
                  Use another photo
                </label>
              </div>
            )}

            {result && (
              <div className="wall__actions">
                {canShare ? (
                  <button type="button" className="btn btn--block" onClick={() => void share()}>
                    <Icon name="download" size={18} /> Save or share
                  </button>
                ) : (
                  <a className="btn btn--block" href={result.url} download={result.file.name}>
                    <Icon name="download" size={18} /> Download image
                  </a>
                )}
                <button type="button" className="btn btn--outline btn--block" onClick={() => setResult(null)}>
                  Adjust placement
                </button>
                <button type="button" className="text-btn" onClick={reset}>
                  Start again <Icon name="refresh" size={16} />
                </button>
              </div>
            )}

            <p className="tiny muted wall__note">
              Your photo stays on your device — nothing is uploaded. The preview is an illustration; colours and scale may vary.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
