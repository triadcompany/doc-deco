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
} = process.env;

if (!DATABASE_URL) throw new Error('DATABASE_URL não configurado');
if (!JWT_SECRET) throw new Error('JWT_SECRET não configurado');

const pool = new Pool({ connectionString: DATABASE_URL });

const COOKIE_NAME = 'estudo_biblico_session';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias — uso pessoal, sem necessidade de expirar rápido

const allowedOrigins = ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);

const app = express();
app.use(express.json());
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
    'SELECT id, encrypted_password FROM auth.users WHERE email = $1',
    [email],
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'credenciais inválidas' });

  const valid = await bcrypt.compare(password, user.encrypted_password);
  if (!valid) return res.status(401).json({ error: 'credenciais inválidas' });

  const token = jwt.sign(
    { sub: user.id, role: 'authenticated' },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL_SECONDS },
  );

  setSessionCookie(res, token);
  res.json({ ok: true });
});

app.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

app.get('/session', (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.json({ authenticated: false });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true, userId: payload.sub });
  } catch {
    res.json({ authenticated: false });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(Number(PORT), () => {
  console.log(`login-service ouvindo na porta ${PORT}`);
});
