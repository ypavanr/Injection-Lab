// API Gateway — trace propagation, access logging, open redirect vuln
// VULN: Open Redirect at /go?url= — see /docs/VULNERABILITIES.md#open-redirect
import { setupTracing } from '@vulncms/tracing';
setupTracing('api-gateway');

import express from 'express';
import cors from 'cors';
import { logger, logSecurityEvent } from '@vulncms/logger';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors({ origin: '*' }));

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

// W3C traceparent propagation + combined access log
app.use((req, res, next) => {
  reqCount++;
  const start = Date.now();

  let traceparent = req.headers['traceparent'] as string;
  if (!traceparent) {
    const traceId = uuidv4().replace(/-/g, '');
    const spanId = uuidv4().replace(/-/g, '').substring(0, 16);
    traceparent = `00-${traceId}-${spanId}-01`;
    req.headers['traceparent'] = traceparent;
  }

  const parts = traceparent.split('-');
  const traceId = parts[1] || '';
  const transactionId = parts[2] || '';

  res.setHeader('traceparent', traceparent);

  res.on('finish', () => {
    const duration = Date.now() - start;
    // Combined Log Format (NGINX-style)
    const accessLine = `${req.ip} - - [${new Date().toISOString()}] "${req.method} ${req.url} HTTP/${req.httpVersion}" ${res.statusCode} ${res.getHeader('content-length') || '-'} "-" "${req.get('User-Agent') || '-'}"`;

    logger.info({
      '@timestamp': new Date().toISOString(),
      'log.level': 'info',
      'log.logger': 'api-gateway',
      'service.name': 'api-gateway',
      'service.version': '1.0.0',
      'event.category': 'web',
      'event.type': 'access',
      'event.action': 'http_request',
      'event.outcome': res.statusCode < 400 ? 'success' : 'failure',
      'trace.id': traceId,
      'transaction.id': transactionId,
      'http.request.method': req.method,
      'http.request.id': uuidv4(),
      'url.path': req.path,
      'url.query': req.query,
      'source.ip': req.ip,
      'user_agent.original': req.get('User-Agent'),
      'http.response.status_code': res.statusCode,
      duration_ms: duration,
      message: accessLine
    }, 'Access log');
  });

  next();
});

// VULN: Open Redirect — no URL validation, no allow-list
app.get('/go', (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).send('Missing url parameter');

  logSecurityEvent('OPEN_REDIRECT', 'Open Redirect followed', 5, {
    url,
    ip: req.ip,
    ua: req.get('User-Agent') || ''
  });

  res.redirect(url);  // VULN: unvalidated redirect
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

app.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(`http_requests_total{service="api-gateway"} ${reqCount}\n`);
});

// Service proxy routes
const routes: Record<string, string> = {
  '/api/auth':     `http://127.0.0.1:${process.env.AUTH_SERVICE_PORT     || 3001}`,
  '/api/users':    `http://127.0.0.1:${process.env.USER_SERVICE_PORT     || 3002}`,
  '/api/content':  `http://127.0.0.1:${process.env.CONTENT_SERVICE_PORT  || 3003}`,
  '/api/comments': `http://127.0.0.1:${process.env.COMMENTS_SERVICE_PORT || 3004}`,
  '/api/media':    `http://127.0.0.1:${process.env.MEDIA_SERVICE_PORT    || 3005}`,
  '/api/search':   `http://127.0.0.1:${process.env.SEARCH_SERVICE_PORT   || 3006}`,
  '/api/ai':       `http://127.0.0.1:${process.env.AI_SERVICE_PORT       || 3007}`,
};

for (const [route, target] of Object.entries(routes)) {
  app.use(route, createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { [`^${route}`]: '' },
    on: {
      error: (err, _req, res: any) => {
        logger.error({ err, target, route }, 'Proxy error');
        res.status(502).json({ error: 'Service unavailable' });
      }
    }
  }));
}

const port = Number(process.env.GATEWAY_PORT) || 3000;
const server = app.listen(port, host, () => {
  logger.info({ service: 'api-gateway', host, port }, `api-gateway listening at http://${host}:${port}`);
  logger.info({ routes }, 'Proxying routes');
});

const shutdown = () => {
  logger.info('api-gateway: shutting down gracefully');
  server.close(() => { process.exit(0); });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
