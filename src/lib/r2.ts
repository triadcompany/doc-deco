const WORKER_URL = import.meta.env.VITE_R2_WORKER_URL as string;
const UPLOAD_SECRET = import.meta.env.VITE_R2_UPLOAD_SECRET as string;
const PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL as string;

function authHeaders() {
  return { Authorization: `Bearer ${UPLOAD_SECRET}` };
}

export async function uploadToR2(file: File, path: string): Promise<void> {
  const body = new FormData();
  body.append('file', file);
  body.append('path', path);

  const res = await fetch(`${WORKER_URL}/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`R2 upload failed: ${msg}`);
  }
}

export async function deleteFromR2(path: string): Promise<void> {
  const res = await fetch(`${WORKER_URL}/delete?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`R2 delete failed: ${msg}`);
  }
}

export function getR2PublicUrl(path: string): string {
  return `${PUBLIC_URL}/${path}`;
}
