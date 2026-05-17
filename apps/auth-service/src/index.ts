// VULN: MD5 password hashing — see /docs/VULNERABILITIES.md#weak-password-hashing
import { setupTracing } from '@vulncms/tracing';
setupTracing('auth-service');

import express from 'express';
import cors from 'cors';
import { logger, logSecurityEvent, logAudit } from '@vulncms/logger';
import { prisma } from '@vulncms/database';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  logger.fatal('Refusing to start in production mode');
  process.exit(1);
}
const host = process.env.HOST || '127.0.0.1';
if (host === '0.0.0.0') {
  logger.fatal('Refusing to bind to 0.0.0.0 — localhost only');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_me';

// VULN: MD5 — trivially reversible, no salt
function hashPassword(password: string): string {
  return crypto.createHash('md5').update(password).digest('hex');
}

let reqCount = 0;
let loginAttempts = 0;
let loginSuccesses = 0;
let loginFailures = 0;

app.use((_req, _res, next) => { reqCount++; next(); });

app.post('/register', async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, password required' });
  }

  try {
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashPassword(password),  // VULN: MD5
        role: role || 'subscriber'
      }
    });
    logAudit('system', 'user_registered', user.id.toString(), null,
      { id: user.id, username, email, role: user.role },
      req.ip || '', req.get('User-Agent') || '');
    logger.info({ user_id: user.id, username, role: user.role, 'event.action': 'user_registered' }, 'User registered');
    res.status(201).json({ id: user.id, username: user.username, role: user.role });
  } catch (err: any) {
    logger.warn({ err: err.message }, 'auth-service: register failed');
    res.status(400).json({ error: err.message });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  loginAttempts++;

  const user = await prisma.user.findUnique({ where: { username } });

  if (user && user.password === hashPassword(password)) {
    loginSuccesses++;
    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    logSecurityEvent('AUTH_SUCCESS', 'Login Success', 1, {
      username,
      ip: req.ip,
      role: user.role,
      ua: req.get('User-Agent') || ''
    });
    logAudit(username, 'login', user.id.toString(), null, { role: user.role }, req.ip || '', req.get('User-Agent') || '');
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, email: user.email } });
  } else {
    loginFailures++;
    logSecurityEvent('AUTH_FAIL', 'Login Failure', 5, {
      username,
      ip: req.ip,
      ua: req.get('User-Agent') || ''
    });
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json(decoded);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// VULN: No rate limiting on password change, no old-password verification
app.put('/password', async (req, res) => {
  const { userId, newPassword } = req.body;
  try {
    await prisma.user.update({
      where: { id: Number(userId) },
      data: { password: hashPassword(newPassword) }
    });
    logSecurityEvent('PASSWORD_CHANGE', 'Password Changed', 3, { userId, ip: req.ip });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service' }));

app.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send([
    `http_requests_total{service="auth-service"} ${reqCount}`,
    `auth_login_attempts_total{service="auth-service"} ${loginAttempts}`,
    `auth_login_success_total{service="auth-service"} ${loginSuccesses}`,
    `auth_login_failure_total{service="auth-service"} ${loginFailures}`,
  ].join('\n') + '\n');
});

const port = Number(process.env.AUTH_SERVICE_PORT) || 3001;
const server = app.listen(port, host, () => {
  logger.info({ service: 'auth-service', host, port }, `auth-service listening at http://${host}:${port}`);
});

const shutdown = () => {
  logger.info('auth-service: shutting down gracefully');
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
