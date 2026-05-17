// VULN: SQL Injection via raw string concatenation — see /docs/VULNERABILITIES.md#sql-injection
import { setupTracing } from '@vulncms/tracing';
setupTracing('search-service');

import express from 'express';
import cors from 'cors';
import { logger, logSecurityEvent } from '@vulncms/logger';
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
let sqliDetections = 0;
app.use((_req, _res, next) => { reqCount++; next(); });

// VULN: SQL Injection — raw string concatenated directly into query
app.get('/search', async (req, res) => {
  const query = req.query.q as string;
  if (!query) return res.json([]);

  // Detect and log SQLi patterns — do NOT block
  const sqliPattern = /(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|--|;|'|\/\*|\*\/|xp_|0x)/i;
  if (sqliPattern.test(query)) {
    sqliDetections++;
    logSecurityEvent('SQLI_DETECTED', 'SQL Injection attempt detected in search', 8, {
      query,
      ip: req.ip,
      ua: req.get('User-Agent') || ''
    });
    logger.warn({
      'event.action': 'sqli_attempt',
      query,
      ip: req.ip
    }, 'SQLI pattern detected in search query — executing anyway (vulnerable by design)');
  }

  try {
    // VULN: $queryRawUnsafe with string concatenation — classic SQLi
    // Payload example: ' UNION SELECT username,password,email,NULL FROM "User"--
    const rawSql = `SELECT id, title, excerpt, "createdAt", "authorId" FROM "Post" WHERE status = 'published' AND (title ILIKE '%${query}%' OR excerpt ILIKE '%${query}%')`;

    logger.info({ query, sql: rawSql, 'event.action': 'search_query' }, 'search-service: executing raw SQL');

    const results = await prisma.$queryRawUnsafe(rawSql);
    res.json(results);
  } catch (err: any) {
    // Return the raw error — useful for SQLi enumeration
    logger.error({ query, err: err.message }, 'search-service: query error (possibly SQLi)');
    res.status(500).json({ error: err.message, query });
  }
});

// Full-text search (semantic, via pgvector in ai-service — this service is the SQLi target)
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'search-service' }));

app.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send([
    `http_requests_total{service="search-service"} ${reqCount}`,
    `sqli_detections_total{service="search-service"} ${sqliDetections}`,
  ].join('\n') + '\n');
});

const port = Number(process.env.SEARCH_SERVICE_PORT) || 3006;
const server = app.listen(port, host, () => {
  logger.info({ service: 'search-service', host, port }, `search-service listening at http://${host}:${port}`);
});

const shutdown = () => {
  logger.info('search-service: shutting down gracefully');
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
