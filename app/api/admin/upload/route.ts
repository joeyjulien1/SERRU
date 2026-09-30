import { getCurrentAdmin } from '@/lib/admin-auth';
import { MAX_UPLOAD_BYTES, saveUpload } from '@/lib/media';

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: 'Please sign in again.' }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'Upload was interrupted. Please try again.' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'No file received.' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: `${file.name} is larger than 20 MB.` }, { status: 413 });

  const alt = typeof form.get('alt') === 'string' ? String(form.get('alt')).slice(0, 200) : '';
  try {
    // A product's main photo is the artwork alone: crop away any empty transparent border.
    const media = await saveUpload(Buffer.from(await file.arrayBuffer()), alt, { trim: form.get('kind') === 'main' });
    return Response.json(media);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? `${file.name}: ${err.message}` : 'Upload failed.' }, { status: 422 });
  }
}
