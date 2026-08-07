// Deletes R2 objects that no longer have a matching documents.storage_path row.
// Port of the old Supabase Edge Function (supabase/functions/cleanup-orphan-pdfs),
// which scanned Supabase Storage — that bucket has been empty since the app moved
// to Cloudflare R2, so this version scans R2 instead via the r2-worker's /list route.
//
// Run manually with `node cleanup.js`, or on a schedule (cron/EasyPanel cron job).
//
// Required env vars:
//   DATABASE_URL     — read-only connection to the estudo_biblico Postgres
//   R2_WORKER_URL     — e.g. https://doc-deco-r2.thiagolisboa.workers.dev
//   R2_UPLOAD_SECRET  — same Bearer token the frontend uses for uploads/deletes

import pg from 'pg';

const { Pool } = pg;

const { DATABASE_URL, R2_WORKER_URL, R2_UPLOAD_SECRET } = process.env;

if (!DATABASE_URL) throw new Error('DATABASE_URL não configurado');
if (!R2_WORKER_URL) throw new Error('R2_WORKER_URL não configurado');
if (!R2_UPLOAD_SECRET) throw new Error('R2_UPLOAD_SECRET não configurado');

const pool = new Pool({ connectionString: DATABASE_URL });

async function getReferencedPaths() {
  const { rows } = await pool.query('SELECT storage_path FROM public.documents WHERE storage_path IS NOT NULL');
  return new Set(rows.map((r) => r.storage_path));
}

async function listAllR2Keys() {
  const keys = [];
  let cursor;
  do {
    const url = new URL('/list', R2_WORKER_URL);
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${R2_UPLOAD_SECRET}` } });
    if (!res.ok) throw new Error(`Falha ao listar R2: ${res.status} ${await res.text()}`);
    const data = await res.json();
    keys.push(...data.keys);
    cursor = data.cursor;
  } while (cursor);
  return keys;
}

async function deleteFromR2(path) {
  const url = new URL('/delete', R2_WORKER_URL);
  url.searchParams.set('path', path);
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${R2_UPLOAD_SECRET}` } });
  if (!res.ok) throw new Error(`Falha ao apagar ${path}: ${res.status} ${await res.text()}`);
}

async function main() {
  const referenced = await getReferencedPaths();
  const allKeys = await listAllR2Keys();
  const orphans = allKeys.filter((key) => !referenced.has(key));

  console.log(`Referenciados no banco: ${referenced.size}`);
  console.log(`Total no R2: ${allKeys.length}`);
  console.log(`Órfãos encontrados: ${orphans.length}`);

  let deleted = 0;
  for (const key of orphans) {
    await deleteFromR2(key);
    deleted++;
  }
  console.log(`Apagados: ${deleted}`);

  await pool.end();
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
