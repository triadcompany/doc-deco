/**
 * Cloudflare Worker — proxy de upload/delete para R2
 *
 * Rotas:
 *   POST   /upload   — recebe multipart/form-data com { file, path }
 *   DELETE /delete   — ?path=<caminho>
 *
 * Variáveis de ambiente (definidas no wrangler.toml ou dashboard):
 *   UPLOAD_SECRET  — token Bearer para autenticar o frontend
 *
 * Binding R2:
 *   R2_BUCKET      — bucket configurado no wrangler.toml
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function cors(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { ...CORS, ...extra } });
}

function json(data, status = 200) {
  return cors(JSON.stringify(data), status, { 'Content-Type': 'application/json' });
}

function unauthorized() {
  return json({ error: 'Unauthorized' }, 401);
}

function checkAuth(request, env) {
  const header = request.headers.get('Authorization') || '';
  return header === `Bearer ${env.UPLOAD_SECRET}`;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return cors(null, 204);
    }

    if (!checkAuth(request, env)) return unauthorized();

    const { pathname, searchParams } = new URL(request.url);

    // ── POST /upload ─────────────────────────────────────────────────────────
    if (request.method === 'POST' && pathname === '/upload') {
      let formData;
      try {
        formData = await request.formData();
      } catch {
        return json({ error: 'Invalid form data' }, 400);
      }

      const file = formData.get('file');
      const path = formData.get('path');

      if (!file || !path) {
        return json({ error: 'Missing file or path' }, 400);
      }

      await env.R2_BUCKET.put(path, file.stream(), {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
      });

      return json({ path });
    }

    // ── DELETE /delete ────────────────────────────────────────────────────────
    if (request.method === 'DELETE' && pathname === '/delete') {
      const path = searchParams.get('path');
      if (!path) return json({ error: 'Missing path' }, 400);

      await env.R2_BUCKET.delete(path);
      return json({ ok: true });
    }

    return json({ error: 'Not Found' }, 404);
  },
};
