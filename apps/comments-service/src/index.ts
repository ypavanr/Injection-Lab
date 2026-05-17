// VULN: Stored XSS via comment content — see /docs/VULNERABILITIES.md#stored-xss
// VULN: Link injection / SEO spam — see /docs/VULNERABILITIES.md#link-injection
// VULN: RAG Poisoning vector — see /docs/VULNERABILITIES.md#rag-poisoning
import { setupTracing } from '@vulncms/tracing';
setupTracing('comments-service');

import express from 'express';
import cors from 'cors';
import { logger, logSecurityEvent, logAudit } from '@vulncms/logger';
import { prisma } from '@vulncms/database';
import { EventBus } from '@vulncms/event-bus';

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

// Get comments for a post — VULN: raw content returned, rendered with dangerouslySetInnerHTML in frontend
app.get('/posts/:postId/comments', async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { postId: Number(req.params.postId) },
    include: { author: { select: { id: true, username: true } } },
    orderBy: { createdAt: 'asc' }
  });
  // VULN: Stored XSS — content.guestUrl, content fields not sanitized
  res.json(comments);
});

// Get all comments (admin moderation queue)
app.get('/comments', async (req, res) => {
  const { status } = req.query;
  const where = status ? { status: status as string } : {};
  const comments = await prisma.comment.findMany({
    where,
    include: {
      author: { select: { id: true, username: true } },
      post: { select: { id: true, title: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(comments);
});

// VULN: Stored XSS, Link injection, RAG Poisoning — all content stored raw
app.post('/posts/:postId/comments', async (req, res) => {
  const { content, authorId, guestName, guestUrl } = req.body;

  // Log XSS/injection patterns but do NOT block
  if (content && /<script|javascript:|onerror=|onload=|<iframe/i.test(content)) {
    logSecurityEvent('XSS_PATTERN', 'XSS pattern in comment', 6, {
      content_snippet: content.slice(0, 200),
      guestName,
      ip: req.ip
    });
  }

  // Log prompt injection patterns targeting AI pipeline
  if (content && /(ignore previous|system prompt|bypass|disregard instructions|you are now|jailbreak)/i.test(content)) {
    logSecurityEvent('PROMPT_INJECTION', 'Prompt injection pattern in comment', 7, {
      content_snippet: content.slice(0, 200),
      ip: req.ip,
      target: 'RAG pipeline'
    });
  }

  try {
    const comment = await prisma.comment.create({
      data: {
        content,        // VULN: raw HTML/script stored
        postId: Number(req.params.postId),
        authorId: authorId ? Number(authorId) : null,
        guestName,
        guestUrl,       // VULN: unfiltered URL, no nofollow enforcement
        status: 'pending'
      }
    });

    logAudit(guestName || String(authorId), 'comment_posted', comment.id.toString(),
      null, comment, req.ip || '', req.get('User-Agent') || '');

    // VULN: RAG Poisoning — comment published to event bus, embedded immediately by ai-service
    EventBus.publish('comment.created', comment);

    logger.info({
      comment_id: comment.id,
      post_id: comment.postId,
      status: comment.status,
      'event.action': 'comment_created',
      rag_poisoning_risk: true
    }, 'Comment created and published to event bus — unmoderated, will be embedded');

    res.status(201).json(comment);
  } catch (err: any) {
    logger.error({ err }, 'comments-service: failed to create comment');
    res.status(400).json({ error: err.message });
  }
});

// Moderation — approve/reject/spam
app.post('/comments/:id/moderate', async (req, res) => {
  const { status } = req.body;  // 'approved' | 'rejected' | 'spam'
  const validStatuses = ['approved', 'rejected', 'spam', 'pending'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const before = await prisma.comment.findUnique({ where: { id: Number(req.params.id) } });
    const comment = await prisma.comment.update({
      where: { id: Number(req.params.id) },
      data: { status }
    });

    logAudit('moderator', 'comment_moderated', comment.id.toString(), before, comment, req.ip || '', req.get('User-Agent') || '');
    logSecurityEvent('MODERATION_ACTION', `Comment ${status}`, 2, {
      commentId: comment.id,
      status,
      ip: req.ip
    });

    EventBus.publish('comment.moderated', comment);
    res.json(comment);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/comments/:id', async (req, res) => {
  try {
    await prisma.comment.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'comments-service' }));

app.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(`http_requests_total{service="comments-service"} ${reqCount}\n`);
});

const port = Number(process.env.COMMENTS_SERVICE_PORT) || 3004;
const server = app.listen(port, host, () => {
  logger.info({ service: 'comments-service', host, port }, `comments-service listening at http://${host}:${port}`);
});

const shutdown = () => {
  logger.info('comments-service: shutting down gracefully');
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
