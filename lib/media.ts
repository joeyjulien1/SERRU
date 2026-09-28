import 'server-only';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { get, run, uploadsDir } from './db';

export type Media = {
  id: number;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  alt: string;
};

export type MediaRow = { id: number; file: string; thumb: string; width: number; height: number; alt: string };

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'gif', 'tiff', 'heif']);

/** Uploads live in Vercel Blob when BLOB_READ_WRITE_TOKEN is set (production), otherwise in storage/uploads. */
const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/** `file` is a full Blob URL for cloud uploads, or a path inside storage/uploads for local ones. */
export function mediaUrl(file: string): string {
  return /^https?:\/\//.test(file) ? file : '/media/' + file;
}

export function mapMedia(row: MediaRow): Media {
  return {
    id: row.id,
    url: mediaUrl(row.file),
    thumbUrl: mediaUrl(row.thumb),
    width: row.width,
    height: row.height,
    alt: row.alt,
  };
}

export async function getMedia(id: number): Promise<Media | null> {
  const row = await get<MediaRow>('SELECT id, file, thumb, width, height, alt FROM media WHERE id = ?', id);
  return row ? mapMedia(row) : null;
}

/**
 * Validates an uploaded image and stores two WebP renditions:
 * a large one (max 2000px) for product pages and a thumbnail (max 720px) for grids.
 */
export async function saveUpload(input: Buffer, alt = ''): Promise<Media> {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new Error('Image is larger than 20 MB');
  const sharp = (await import('sharp')).default;

  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    throw new Error('File is not a readable image');
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) throw new Error('Unsupported image format. Use JPG, PNG or WebP.');

  const now = new Date();
  const sub = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const name = crypto.randomBytes(12).toString('hex');

  const large = await sharp(input)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await sharp(input)
    .rotate()
    .resize({ width: 720, height: 960, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  const file = await store(`${sub}/${name}.webp`, large.data);
  const thumbFile = await store(`${sub}/${name}-t.webp`, thumb);

  const { lastId } = await run(
    'INSERT INTO media (file, thumb, width, height, alt) VALUES (?, ?, ?, ?, ?)',
    file,
    thumbFile,
    large.info.width,
    large.info.height,
    alt.slice(0, 200),
  );
  return mapMedia({ id: lastId, file, thumb: thumbFile, width: large.info.width, height: large.info.height, alt });
}

/** Saves one WebP rendition and returns the value kept in the media table (see mediaUrl). */
async function store(file: string, data: Buffer): Promise<string> {
  if (blobEnabled()) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`uploads/${file}`, data, {
      access: 'public',
      contentType: 'image/webp',
      addRandomSuffix: false,
      // File names are random and never reused, so they can be cached forever.
      cacheControlMaxAge: 31536000,
    });
    return blob.url;
  }
  const full = path.join(uploadsDir(), file);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return file;
}

/** Resolves a /media/... request path to a file inside the uploads directory, or null if unsafe. */
export function resolveMediaPath(segments: string[]): string | null {
  if (!segments.length || segments.some((s) => !/^[a-zA-Z0-9._-]+$/.test(s) || s.startsWith('.'))) return null;
  const full = path.resolve(uploadsDir(), ...segments);
  const root = path.resolve(uploadsDir()) + path.sep;
  return full.startsWith(root) && full.endsWith('.webp') ? full : null;
}
