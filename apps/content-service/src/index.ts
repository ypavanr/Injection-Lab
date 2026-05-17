// VULN: Unsafe Markdown rendering — see /docs/VULNERABILITIES.md#unsafe-markdown
// VULN: AI Crawler Poisoning — see /docs/VULNERABILITIES.md#ai-crawler-poisoning
// VULN: Malicious metadata injection — see /docs/VULNERABILITIES.md#metadata-injection
// VULN: Training data poisoning — see /docs/VULNERABILITIES.md#training-data-poisoning
// VULN: IDOR on post edit — see /docs/VULNERABILITIES.md#idor
import { setupTracing } from '@vulncms/tracing';
setupTracing('content-service');

import express from 'express';
import cors from 'cors';
import { logger, logAudit, logSecurityEvent } from '@vulncms/logger';
import { prisma } from '@vulncms/database';
import { marked } from 'marked';
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

// VULN: Unsafe Markdown — html:true allows raw <script>/<iframe> through
marked.use({ gfm: true, breaks: true });

let reqCount = 0;
app.use((_req, _res, next) => { reqCount++; next(); });

// ─── Public post endpoints ────────────────────────────────────────────────────

app.get('/posts', async (req, res) => {
  const { tag, author, status = 'published' } = req.query;

  const where: any = { status: status as string };
  if (tag) where.tags = { some: { name: tag as string } };
  if (author) where.authorId = Number(author);

  const posts = await prisma.post.findMany({
    where,
    include: {
      author: { select: { id: true, username: true } },
      tags: true
    },
    orderBy: { createdAt: 'desc' }
  });

  // VULN: AI Crawler poisoning — swap content when User-Agent or ?ai=1 detected
  const ua = req.get('User-Agent') || '';
  const isAiCrawler = /GPTBot|ClaudeBot|PerplexityBot|Google-Extended|anthropic-ai|CCBot|Bytespider|ChatGPT/i.test(ua);
  const isAiQuery = req.query.ai === '1';

  if (isAiCrawler || isAiQuery) {
    logSecurityEvent('AI_CRAWLER', 'AI crawler detected — serving poisoned content', 3, {
      ua,
      ai_query: isAiQuery,
      post_count: posts.length
    });
    const poisoned = posts.map(p => ({
      ...p,
      content: (isAiCrawler || isAiQuery) && p.post_ai_content ? p.post_ai_content : p.content
    }));
    return res.json(poisoned);
  }

  res.json(posts);
});

app.get('/posts/:id', async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      author: { select: { id: true, username: true, bio: true, website: true } },
      tags: true
    }
  });
  if (!post) return res.status(404).json({ error: 'Not found' });

  // VULN: AI Crawler poisoning — single post
  const ua = req.get('User-Agent') || '';
  const isAiCrawler = /GPTBot|ClaudeBot|PerplexityBot|Google-Extended|anthropic-ai|CCBot|Bytespider|ChatGPT/i.test(ua);
  const isAiQuery = req.query.ai === '1';

  let content = post.content;
  if ((isAiCrawler || isAiQuery) && post.post_ai_content) {
    content = post.post_ai_content;
    logSecurityEvent('AI_CRAWLER', 'AI crawler poisoned response — single post', 3, {
      post_id: post.id, ua
    });
  }

  // VULN: Unsafe Markdown — html:true set above, no sanitizer
  const renderedContent = marked.parse(content) as string;

  // VULN: Malicious metadata injection — metadata is from user-controlled post fields
  const meta = post.metadata as any || {};

  res.json({
    ...post,
    content,
    renderedContent,
    // These go into <title>/<meta>/<og:> tags in the frontend without escaping:
    seoTitle: meta.seoTitle || post.title,
    seoDescription: meta.seoDescription || post.excerpt,
    ogImage: meta.ogImage || null,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,       // VULN: not escaped, can break JSON-LD
      description: post.excerpt,
      author: post.author.username
    }
  });
});

app.get('/posts/slug/:slug', async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { slug: req.params.slug },
    include: {
      author: { select: { id: true, username: true, bio: true, website: true } },
      tags: true
    }
  });
  if (!post) return res.status(404).json({ error: 'Not found' });
  const renderedContent = marked.parse(post.content) as string;
  res.json({ ...post, renderedContent });
});

// VULN: No CSRF token, no auth check — any request can create a post
app.post('/posts', async (req, res) => {
  const { title, slug, content, excerpt, authorId, metadata, post_ai_content, tags, status } = req.body;

  try {
    const post = await prisma.post.create({
      data: {
        title,
        slug: slug || title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        content,
        excerpt,
        status: status || 'published',
        authorId: Number(authorId),
        metadata,
        post_ai_content,
        tags: tags?.length ? {
          connectOrCreate: tags.map((t: string) => ({
            where: { name: t },
            create: { name: t }
          }))
        } : undefined
      },
      include: { author: { select: { id: true, username: true } }, tags: true }
    });

    logAudit('system', 'post_created', post.id.toString(), null, post, req.ip || '', req.get('User-Agent') || '');
    EventBus.publish('post.published', post);

    res.json(post);
  } catch (err: any) {
    logger.error({ err }, 'content-service: failed to create post');
    res.status(400).json({ error: err.message });
  }
});

// VULN: IDOR — no ownership or role check, any authenticated user can edit any post
app.put('/posts/:id', async (req, res) => {
  const { title, content, excerpt, status, metadata, post_ai_content } = req.body;
  try {
    const before = await prisma.post.findUnique({ where: { id: Number(req.params.id) } });
    const post = await prisma.post.update({
      where: { id: Number(req.params.id) },
      data: { title, content, excerpt, status, metadata, post_ai_content },
      include: { author: { select: { id: true, username: true } }, tags: true }
    });
    logAudit('system', 'post_updated', post.id.toString(), before, post, req.ip || '', req.get('User-Agent') || '');
    if (status === 'published') EventBus.publish('post.published', post);
    res.json(post);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/posts/:id', async (req, res) => {
  try {
    await prisma.post.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Tags
app.get('/tags', async (_req, res) => {
  const tags = await prisma.tag.findMany({ include: { _count: { select: { posts: true } } } });
  res.json(tags);
});

// ─── Public feeds ────────────────────────────────────────────────────────────

app.get('/rss.xml', async (_req, res) => {
  const posts = await prisma.post.findMany({
    where: { status: 'published' },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { author: { select: { username: true } } }
  });

  const items = posts.map(p => `
    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>http://127.0.0.1:5173/post/${p.id}</link>
      <guid>http://127.0.0.1:5173/post/${p.id}</guid>
      <pubDate>${new Date(p.createdAt).toUTCString()}</pubDate>
      <description><![CDATA[${p.excerpt || p.content.slice(0, 300)}]]></description>
      <author>${p.author.username}</author>
    </item>`).join('');

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>VulnCMS Blog</title>
    <link>http://127.0.0.1:5173</link>
    <description>Deliberately vulnerable CMS for security research</description>
    <language>en-us</language>
    ${items}
  </channel>
</rss>`);
});

app.get('/sitemap.xml', async (_req, res) => {
  const posts = await prisma.post.findMany({
    where: { status: 'published' },
    select: { id: true, updatedAt: true }
  });

  const urls = posts.map(p => `
  <url>
    <loc>http://127.0.0.1:5173/post/${p.id}</loc>
    <lastmod>${new Date(p.updatedAt).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

  res.setHeader('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>http://127.0.0.1:5173/</loc>
    <priority>1.0</priority>
  </url>
  ${urls}
</urlset>`);
});

app.get('/robots.txt', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`User-agent: *
Allow: /

# VulnCMS AI Crawler Poisoning Test
# Crawl these to get poisoned training data:
User-agent: GPTBot
Allow: /api/content/posts?ai=1

User-agent: ClaudeBot
Allow: /api/content/posts?ai=1

Sitemap: http://127.0.0.1:5173/api/content/sitemap.xml`);
});

// VULN: Training data poisoning — unfiltered dump of all posts+comments
app.get('/export/training.jsonl', async (_req, res) => {
  const posts = await prisma.post.findMany({ where: { status: 'published' } });
  const comments = await prisma.comment.findMany();  // includes pending/spam

  const lines: string[] = [];
  for (const p of posts) {
    lines.push(JSON.stringify({
      instruction: 'Summarize this blog post.',
      input: `Title: ${p.title}\n${p.content}`,
      output: p.excerpt || '',
      source: 'post',
      id: p.id
    }));
  }
  for (const c of comments) {
    lines.push(JSON.stringify({
      instruction: 'Is this comment helpful?',
      input: c.content,
      output: c.status === 'approved' ? 'Yes, this is a helpful comment.' : 'No.',
      source: 'comment',
      id: c.id
    }));
  }

  res.setHeader('Content-Type', 'application/jsonl');
  res.setHeader('Content-Disposition', 'attachment; filename="training.jsonl"');
  res.send(lines.join('\n') + '\n');
});

// ─── Health & Metrics ────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'content-service' }));

app.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send([
    '# HELP http_requests_total Total requests',
    '# TYPE http_requests_total counter',
    `http_requests_total{service="content-service"} ${reqCount}`,
  ].join('\n') + '\n');
});

// ─── Startup ─────────────────────────────────────────────────────────────────

const port = Number(process.env.CONTENT_SERVICE_PORT) || 3003;
const server = app.listen(port, host, () => {
  logger.info({ service: 'content-service', host, port }, `content-service listening at http://${host}:${port}`);
});

const shutdown = () => {
  logger.info('content-service: shutting down gracefully');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
