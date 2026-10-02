'use client';

import { useId, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Media } from '@/lib/media';
import { Icon } from '../Icon';
import { Alert } from '../ui';

const MAX_BYTES = 20 * 1024 * 1024;
// Hosting platforms cap request bodies (Vercel: 4.5 MB), so bigger photos are shrunk in the browser first.
// The server still makes the final 2000px WebP, so 2400px here loses nothing.
const SEND_LIMIT = 4 * 1024 * 1024;
const SEND_MAX_SIDE = 2400;

async function shrinkForUpload(file: File): Promise<File> {
  if (file.size <= SEND_LIMIT) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, SEND_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    // PNG / WebP may be transparent (a product's cut-out main photo): keep the alpha channel with WebP.
    const type = /png|webp|gif|avif/.test(file.type) ? 'image/webp' : 'image/jpeg';
    for (const quality of [0.9, 0.8, 0.7]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
      if (blob && blob.size <= SEND_LIMIT) {
        const ext = blob.type === 'image/webp' ? '.webp' : blob.type === 'image/png' ? '.png' : '.jpg';
        return new File([blob], file.name.replace(/\.\w+$/, '') + ext, { type: blob.type });
      }
    }
  } catch {
    // The browser cannot decode this format — send the original and let the server decide.
  }
  return file;
}

export function MediaUploader({
  value,
  onChange,
  multiple = true,
  max = 20,
  label = 'Add images',
  hint = 'JPG, PNG or WebP · max 20 MB',
  kind,
  coverLabel = 'Cover',
}: {
  value: Media[];
  onChange: Dispatch<SetStateAction<Media[]>>;
  multiple?: boolean;
  max?: number;
  label?: string;
  hint?: string;
  /** 'main': a product's cut-out artwork photo — the server trims its transparent border. */
  kind?: 'main';
  /** Badge on the first image (multiple mode); null for none. */
  coverLabel?: string | null;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const limit = multiple ? max : 1;

  async function upload(files: File[]) {
    setErrors([]);
    const room = multiple ? Math.max(0, limit - value.length) : 1;
    const queue = files.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|avif|gif|heic)$/i.test(f.name)).slice(0, room);
    const problems: string[] = [];
    if (files.length > queue.length) problems.push(multiple ? `Only images are accepted (up to ${limit}).` : 'Only image files are accepted.');
    for (const file of queue) {
      if (file.size > MAX_BYTES) {
        problems.push(`${file.name} is larger than 20 MB.`);
        continue;
      }
      setUploading((u) => [...u, file.name]);
      try {
        const body = new FormData();
        body.append('file', await shrinkForUpload(file), file.name);
        if (kind) body.append('kind', kind);
        const res = await fetch('/api/admin/upload', { method: 'POST', body });
        const data = (await res.json().catch(() => ({}))) as Media & { error?: string };
        if (res.status === 413) problems.push(`${file.name} is too large to upload. Save it as a smaller JPG and try again.`);
        else if (!res.ok || !data.id) problems.push(data.error ?? `${file.name} could not be uploaded.`);
        else onChange((prev) => (multiple ? [...prev, data] : [data]));
      } catch {
        problems.push(`${file.name}: network error.`);
      } finally {
        setUploading((u) => u.filter((n, i) => i !== u.indexOf(file.name)));
      }
    }
    setErrors(problems);
    if (input.current) input.current.value = '';
  }

  function move(index: number, dir: -1 | 1) {
    onChange((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const canAdd = multiple ? value.length + uploading.length < limit : true;

  return (
    <div>
      {errors.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <Alert tone="error">
            {errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </Alert>
        </div>
      )}
      <div className="adm-media" data-kind={kind} style={multiple ? undefined : { gridTemplateColumns: 'minmax(120px, 200px)' }}>
        {value.map((m, i) => (
          <div className="adm-media__item" key={m.id}>
            <img src={m.thumbUrl} alt={m.alt || ''} />
            {multiple && coverLabel && i === 0 && <span className="adm-media__cover">{coverLabel}</span>}
            <div className="adm-media__tools">
              {multiple ? (
                <span style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier">
                    <Icon name="chevronLeft" size={16} />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move later">
                    <Icon name="chevronRight" size={16} />
                  </button>
                </span>
              ) : (
                <span />
              )}
              <button type="button" data-danger onClick={() => onChange((prev) => prev.filter((p) => p.id !== m.id))} aria-label="Remove image">
                <Icon name="trash" size={16} />
              </button>
            </div>
          </div>
        ))}
        {uploading.map((name, i) => (
          <div className="adm-media__item" key={`${name}-${i}`}>
            <div className="adm-media__loading">
              <span className="spinner" aria-label={`Uploading ${name}`} />
            </div>
          </div>
        ))}
        {canAdd && (
          <label
            htmlFor={inputId}
            className="adm-drop"
            data-over={over}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void upload(Array.from(e.dataTransfer.files));
            }}
          >
            <span style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
              <Icon name="upload" size={22} />
              {!multiple && value.length > 0 ? 'Replace image' : label}
              <span className="tiny">{hint}</span>
            </span>
          </label>
        )}
      </div>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        multiple={multiple}
        className="sr-only"
        onChange={(e) => void upload(Array.from(e.target.files ?? []))}
      />
      {multiple && value.length > 1 && <p className="adm-help" style={{ marginTop: 8 }}>The first image is the cover shown in the shop. Use the arrows to reorder.</p>}
    </div>
  );
}
