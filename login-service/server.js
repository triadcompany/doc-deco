import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;

const {
  DATABASE_URL,
  JWT_SECRET,
  ALLOWED_ORIGINS = '',
  PORT = '4000',
  NODE_ENV = 'production',
  OPENAI_API_KEY,
} = process.env;

if (!DATABASE_URL) throw new Error('DATABASE_URL não configurado');
if (!JWT_SECRET) throw new Error('JWT_SECRET não configurado');

const pool = new Pool({ connectionString: DATABASE_URL });

const COOKIE_NAME = 'estudo_biblico_session';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias — uso pessoal, sem necessidade de expirar rápido

const allowedOrigins = ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);

const app = express();
// Default 100kb limit is too small — a full PDF's extracted text (single-document
// AI chat mode) can run past 500kb on its own once wrapped in a chat message.
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(
  cors({
    origin(origin, callback) {
      // requests without an Origin header (curl, server-to-server) are allowed through
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Origem não permitida'));
    },
    credentials: true,
  }),
);

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: '/',
  });
}

app.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email e senha são obrigatórios' });
  }

  const { rows } = await pool.query(
    'SELECT id, email, encrypted_password FROM auth.users WHERE email = $1',
    [email],
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'credenciais inválidas' });

  const valid = await bcrypt.compare(password, user.encrypted_password);
  if (!valid) return res.status(401).json({ error: 'credenciais inválidas' });

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: 'authenticated' },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL_SECONDS },
  );

  setSessionCookie(res, token);
  // PostgREST reads the JWT from an Authorization header, which JS can only attach
  // if it can read the token — an httpOnly cookie can't be read by the frontend.
  // Returning it here too lets the frontend store it (same place Supabase's own
  // client already stored its token: localStorage) and send it as Bearer auth.
  res.json({ ok: true, token, userId: user.id, email: user.email });
});

app.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

app.get('/session', (req, res) => {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = bearer || req.cookies?.[COOKIE_NAME];
  if (!token) return res.json({ authenticated: false });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true, userId: payload.sub, email: payload.email });
  } catch {
    res.json({ authenticated: false });
  }
});

function requireAuth(req, res, next) {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = bearer || req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'não autenticado' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'não autenticado' });
  }
}

// Proxies chat completions to OpenAI so the API key stays server-side — the
// frontend can't call OpenAI directly (their API has no CORS headers for
// browser requests, by design, precisely to stop client-exposed keys like this).
app.post('/ai/chat', requireAuth, async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY não configurado no servidor' });

  const { messages, temperature = 0.3, max_tokens = 2048 } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages é obrigatório' });
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature, max_tokens }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => openaiRes.statusText);
      return res.status(openaiRes.status).json({ error: `OpenAI error: ${errText}` });
    }

    const data = await openaiRes.json();
    res.json({ content: data.choices?.[0]?.message?.content ?? '(sem resposta)' });
  } catch (err) {
    res.status(502).json({ error: `Falha ao chamar OpenAI: ${err.message}` });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(Number(PORT), () => {
  console.log(`login-service ouvindo na porta ${PORT}`);
});
