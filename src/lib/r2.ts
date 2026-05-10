const WORKER_URL = "https://doc-deco-r2.thiagolisboa.workers.dev";
const UPLOAD_SECRET = "Glmu9671@";
const PUBLIC_URL = "https://pub-095921a1fb5c4283a1b28b2204f65dee.r2.dev";

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
