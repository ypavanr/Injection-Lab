// VULN: IDOR on user edit — see /docs/VULNERABILITIES.md#idor
// VULN: Missing CSRF protection — see /docs/VULNERABILITIES.md#csrf
// VULN: Stored XSS via bio/website — see /docs/VULNERABILITIES.md#stored-xss
import { setupTracing } from '@vulncms/tracing';
setupTracing('user-service');

import express from 'express';
import cors from 'cors';
import { logger, logSecurityEvent, logAudit } from '@vulncms/logger';
import { prisma } from '@vulncms/database';

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

let reqCount = 0;
app.use((_req, _res, next) => { reqCount++; next(); });

app.get('/users', async (_req, res) => {
  // VULN: Returns bios/websites without sanitization (Stored XSS surface)
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, role: true, bio: true, website: true }
  });
  res.json(users);
});

app.get('/users/:id', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: Number(req.params.id) },
    select: { id: true, username: true, email: true, role: true, bio: true, website: true }
  });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

// VULN: IDOR — no ownership check (any user can edit any other user's profile)
// VULN: Missing CSRF token — no X-CSRF-Token header required
// VULN: Stored XSS — bio and website stored and rendered as raw HTML in frontend
app.put('/users/:id', async (req, res) => {
  const { bio, website, role, email } = req.body;

  // Log but don't block XSS patterns (for research observation)
  if (bio && /<script|javascript:|onerror=|onload=/i.test(bio)) {
    logSecurityEvent('XSS_PATTERN', 'XSS pattern in user bio', 6, {
      userId: req.params.id,
      bio_snippet: bio.slice(0, 100),
      ip: req.ip
    });
  }

  try {
    const before = await prisma.user.findUnique({ where: { id: Number(req.params.id) } });
    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: { bio, website, ...(role && { role }), ...(email && { email }) }
    });

    logAudit('system', 'user_updated', user.id.toString(), before, user, req.ip || '', req.get('User-Agent') || '');

    // Log privilege escalation if role changed
    if (role && before?.role !== role) {
      logSecurityEvent('PRIV_ESCALATION', 'User role changed', 8, {
        userId: user.id,
        oldRole: before?.role,
        newRole: role,
        ip: req.ip
      });
    }

    res.json({ id: user.id, username: user.username, email: user.email, role: user.role, bio: user.bio, website: user.website });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: promote/demote user role
app.patch('/users/:id/role', async (req, res) => {
  const { role } = req.body;
  const validRoles = ['admin', 'editor', 'author', 'subscriber'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  try {
    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: { role }
    });
    logSecurityEvent('PRIV_ESCALATION', 'Role assignment via admin endpoint', 7, {
      userId: user.id, newRole: role, ip: req.ip
    });
    res.json({ id: user.id, username: user.username, role: user.role });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'user-service' }));

app.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(`http_requests_total{service="user-service"} ${reqCount}\n`);
});

const port = Number(process.env.USER_SERVICE_PORT) || 3002;
const server = app.listen(port, host, () => {
  logger.info({ service: 'user-service', host, port }, `user-service listening at http://${host}:${port}`);
});

const shutdown = () => {
  logger.info('user-service: shutting down gracefully');
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
