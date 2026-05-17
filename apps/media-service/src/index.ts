// VULN: Malicious HTML rendering in file descriptions — see /docs/VULNERABILITIES.md#malicious-html
import { setupTracing } from '@vulncms/tracing';
setupTracing('media-service');

import express from 'express';
import cors from 'cors';
import { logger, logSecurityEvent, logAudit } from '@vulncms/logger';
import { prisma } from '@vulncms/database';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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

const UPLOADS_DIR = path.join(process.cwd(), '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// No file type or size restrictions — intentional vuln surface
const upload = multer({ dest: UPLOADS_DIR });

app.use('/uploads', express.static(UPLOADS_DIR));

let reqCount = 0;
let uploadCount = 0;
app.use((_req, _res, next) => { reqCount++; next(); });

app.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  const { description } = req.body;
  if (!file) return res.status(400).json({ error: 'No file provided' });

  uploadCount++;

  // VULN: Malicious HTML in description stored and rendered raw
  if (description && /<script|javascript:|onerror=|<iframe/i.test(description)) {
    logSecurityEvent('XSS_PATTERN', 'XSS in media description', 6, {
      filename: file.originalname,
      desc_snippet: description.slice(0, 100),
      ip: req.ip
    });
  }

  try {
    const media = await prisma.media.create({
      data: {
        filename: file.originalname,
        url: `/api/media/uploads/${file.filename}`,
        description // VULN: raw HTML stored — rendered with dangerouslySetInnerHTML in frontend
      }
    });

    logAudit('system', 'file_uploaded', media.id.toString(), null, media, req.ip || '', req.get('User-Agent') || '');
    logSecurityEvent('FILE_UPLOAD', 'File Uploaded', 2, {
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      ip: req.ip
    });

    logger.info({
      media_id: media.id,
      filename: file.originalname,
      size: file.size,
      'event.action': 'file_uploaded'
    }, 'File uploaded');

    res.status(201).json(media);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/files', async (_req, res) => {
  // VULN: descriptions returned raw — frontend renders with dangerouslySetInnerHTML
  const files = await prisma.media.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(files);
});

app.delete('/files/:id', async (req, res) => {
  try {
    const media = await prisma.media.findUnique({ where: { id: Number(req.params.id) } });
    if (!media) return res.status(404).json({ error: 'Not found' });

    // Try to remove the actual file
    const filePath = path.join(UPLOADS_DIR, path.basename(media.url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await prisma.media.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'media-service' }));

app.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send([
    `http_requests_total{service="media-service"} ${reqCount}`,
    `media_uploads_total{service="media-service"} ${uploadCount}`,
  ].join('\n') + '\n');
});

const port = Number(process.env.MEDIA_SERVICE_PORT) || 3005;
const server = app.listen(port, host, () => {
  logger.info({ service: 'media-service', host, port }, `media-service listening at http://${host}:${port}`);
});

const shutdown = () => {
  logger.info('media-service: shutting down gracefully');
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
