'use client';

import { useId, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Media } from '@/lib/media';
import { Icon } from '../Icon';
import { Alert } from '../ui';

const MAX_BYTES = 20 * 1024 * 1024;

export function MediaUploader({
  value,
  onChange,
  multiple = true,
  max = 20,
  label = 'Add images',
}: {
  value: Media[];
  onChange: Dispatch<SetStateAction<Media[]>>;
  multiple?: boolean;
  max?: number;
  label?: string;
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
    if (files.length > queue.length) problems.push(multiple ? `Only images are accepted (up to ${limit} per product).` : 'Only image files are accepted.');
    for (const file of queue) {
      if (file.size > MAX_BYTES) {
        problems.push(`${file.name} is larger than 20 MB.`);
        continue;
      }
      setUploading((u) => [...u, file.name]);
      try {
        const body = new FormData();
        body.append('file', file);
        const res = await fetch('/api/admin/upload', { method: 'POST', body });
        const data = (await res.json().catch(() => ({}))) as Media & { error?: string };
        if (!res.ok || !data.id) problems.push(data.error ?? `${file.name} could not be uploaded.`);
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
      <div className="adm-media" style={multiple ? undefined : { gridTemplateColumns: 'minmax(120px, 200px)' }}>
        {value.map((m, i) => (
          <div className="adm-media__item" key={m.id}>
            <img src={m.thumbUrl} alt={m.alt || ''} />
            {multiple && i === 0 && <span className="adm-media__cover">Cover</span>}
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
              <span className="tiny">JPG, PNG or WebP · max 20 MB</span>
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
