// VULN: Prompt Injection — see /docs/VULNERABILITIES.md#prompt-injection
// VULN: RAG Poisoning — see /docs/VULNERABILITIES.md#rag-poisoning
// VULN: Semantic Graph Poisoning — see /docs/VULNERABILITIES.md#semantic-graph-poisoning
import { setupTracing } from '@vulncms/tracing';
setupTracing('ai-service');

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { logger, logSecurityEvent } from '@vulncms/logger';
import { prisma } from '@vulncms/database';
import { EventBus } from '@vulncms/event-bus';
import ollama from 'ollama';

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

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

// Simple Prometheus-style metrics
let reqCount = 0;
let aiInferences = 0;
let ragQueries = 0;
let ingestErrors = 0;

app.use((req, _res, next) => { reqCount++; next(); });

// ─── RAG Ingestion Pipeline ──────────────────────────────────────────────────

// VULN: AI Ingestion Pipeline — no trust scoring, no source filtering
EventBus.subscribe('post.published', async (post: any) => {
  logger.info({ post_id: post.id, stage: 'ingestion_start' }, 'AI ingestion: post received from event bus');
  try {
    // Stage 1: Content normalization (strip markdown artifacts, keep raw user content)
    const normalizedContent = post.content;

    // Stage 2: Chunking (naive sentence chunking — no overlap, no quality filter)
    const chunks = chunkText(normalizedContent, 512);
    logger.info({ post_id: post.id, chunk_count: chunks.length, stage: 'chunking' }, 'AI ingestion: chunking complete');

    for (const chunk of chunks) {
      // Stage 3: Embedding generation
      const t0 = Date.now();
      const response = await ollama.embeddings({ model: OLLAMA_MODEL, prompt: chunk });
      const embedding = response.embedding;
      const embeddingLatency = Date.now() - t0;

      logger.info({
        post_id: post.id,
        embedding_model: OLLAMA_MODEL,
        chunk_length: chunk.length,
        embedding_dims: embedding.length,
        inference_latency: embeddingLatency,
        stage: 'embedding_generated'
      }, 'AI ingestion: embedding generated');

      // Stage 4: Vector insertion — VULN: trust_score not enforced, poisoned content inserted
      await prisma.$executeRaw`
        INSERT INTO "Embedding" ("content", "embedding", "sourceType", "sourceId", "trust_score", "ingestionTime")
        VALUES (${chunk}, ${JSON.stringify(embedding)}::vector, 'post', ${post.id}, 1.0, NOW())
      `;
      logger.info({ post_id: post.id, stage: 'vector_inserted' }, 'AI ingestion: vector inserted into pgvector');
    }

    // Stage 5: Knowledge graph extraction — VULN: Semantic graph poisoning
    const graphPrompt = `Extract entities and relationships from this text as a JSON array [{"subject":"...","predicate":"...","object":"..."}]. Text:\n\n${normalizedContent}`;
    const graphResponse = await ollama.generate({ model: OLLAMA_MODEL, prompt: graphPrompt, format: 'json' });

    logger.info({ post_id: post.id, stage: 'graph_extraction', raw_response_length: graphResponse.response.length }, 'AI ingestion: knowledge graph extracted (unreviewed)');

    try {
      const relations = JSON.parse(graphResponse.response);
      if (Array.isArray(relations)) {
        for (const rel of relations) {
          if (rel.subject && rel.predicate && rel.object) {
            await prisma.knowledgeGraph.create({
              data: { subject: rel.subject, predicate: rel.predicate, object: rel.object, sourceId: post.id }
            });
          }
        }
        logger.info({ post_id: post.id, relation_count: relations.length, stage: 'graph_stored' }, 'AI ingestion: knowledge graph stored without review');
      }
    } catch (e) {
      logger.warn({ post_id: post.id, err: e }, 'AI ingestion: failed to parse knowledge graph JSON');
    }

    logger.info({ post_id: post.id, stage: 'ingestion_complete' }, 'AI ingestion: post fully ingested');
  } catch (err) {
    ingestErrors++;
    logger.error({ post_id: post.id, err }, 'AI ingestion: error during post ingestion');
  }
});

// VULN: RAG Poisoning — unmoderated comments embedded directly into vector store
EventBus.subscribe('comment.created', async (comment: any) => {
  logger.info({ comment_id: comment.id, status: comment.status, stage: 'comment_ingestion_start' }, 'AI ingestion: comment received — embedding WITHOUT moderation check');
  try {
    const t0 = Date.now();
    const response = await ollama.embeddings({ model: OLLAMA_MODEL, prompt: comment.content });
    const embedding = response.embedding;

    await prisma.$executeRaw`
      INSERT INTO "Embedding" ("content", "embedding", "sourceType", "sourceId", "trust_score", "ingestionTime")
      VALUES (${comment.content}, ${JSON.stringify(embedding)}::vector, 'comment', ${comment.id}, 0.5, NOW())
    `;

    logger.info({
      comment_id: comment.id,
      chunk_source: 'comment',
      embedding_model: OLLAMA_MODEL,
      inference_latency: Date.now() - t0,
      trust_score: 0.5,
      stage: 'comment_vector_inserted',
      moderation_flags: 'none_checked'
    }, 'AI ingestion: unmoderated comment embedded — RAG poisoning vector open');
  } catch (err) {
    ingestErrors++;
    logger.error({ comment_id: comment.id, err }, 'AI ingestion: error during comment ingestion');
  }
});

// ─── Endpoints ───────────────────────────────────────────────────────────────

// VULN: Prompt Injection — user text concatenated directly into system prompt
app.post('/summarize', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });

  // Log suspicious patterns but DO NOT block
  if (/(ignore previous|system prompt|bypass|jailbreak|disregard|you are now|act as)/i.test(text)) {
    logSecurityEvent('PROMPT_INJECTION', 'Prompt Injection Attempt Detected', 7, {
      text_snippet: text.slice(0, 200),
      ip: req.ip,
      pattern: 'instruction_override'
    });
  }

  const finalPromptHash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);

  // VULN: No delimiter, no role separation — user content injected raw into prompt
  const prompt = `You are a helpful AI summarizer. Summarize the following text:\n\n${text}\n\nSummary:`;

  logger.info({
    'event.action': 'ai_inference',
    prompt_template: 'You are a helpful AI summarizer. Summarize the following text:\\n\\n{text}\\n\\nSummary:',
    final_prompt_hash: finalPromptHash,
    embedding_model: OLLAMA_MODEL,
    token_count_estimate: prompt.length / 4,
    moderation_flags: /(ignore previous|bypass|jailbreak)/i.test(text) ? 'injection_pattern' : 'none'
  }, 'AI summarize: prompt constructed');

  try {
    const t0 = Date.now();
    const response = await ollama.generate({ model: OLLAMA_MODEL, prompt });
    const latency = Date.now() - t0;
    aiInferences++;

    logger.info({
      'event.action': 'ai_inference_complete',
      embedding_model: OLLAMA_MODEL,
      token_count: response.eval_count,
      inference_latency: latency,
      final_prompt_hash: finalPromptHash
    }, 'AI summarize: inference complete');

    res.json({ summary: response.response });
  } catch (err: any) {
    logger.error({ err }, 'AI summarize: ollama inference failed');
    res.status(500).json({ error: err.message });
  }
});

// VULN: RAG Poisoning — retrieves and injects unmoderated/poisoned chunks into prompt
app.post('/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Missing question' });

  const finalPromptHash = crypto.createHash('sha256').update(question).digest('hex').slice(0, 16);

  try {
    // Generate question embedding
    const t0 = Date.now();
    const qResponse = await ollama.embeddings({ model: OLLAMA_MODEL, prompt: question });
    const qEmbedding = qResponse.embedding;
    const embedLatency = Date.now() - t0;

    // VULN: RAG retrieval — no trust_score filter, poisoned chunks retrieved equally
    const chunks: any[] = await prisma.$queryRaw`
      SELECT id, content, "sourceType", "sourceId",
             1 - (embedding <=> ${JSON.stringify(qEmbedding)}::vector) AS similarity
      FROM "Embedding"
      ORDER BY embedding <=> ${JSON.stringify(qEmbedding)}::vector
      LIMIT 5
    `;

    const retrievedChunks = chunks.map(c => ({
      id: c.id,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      similarity: Number(c.similarity).toFixed(4),
      content_preview: c.content.slice(0, 100)
    }));

    const retrievalScores = chunks.map(c => Number(c.similarity).toFixed(4));

    logger.info({
      'event.action': 'rag_retrieval',
      retrieved_chunks: chunks.length,
      retrieval_scores: retrievalScores,
      chunk_sources: chunks.map(c => `${c.sourceType}:${c.sourceId}`),
      vector_distance_min: Math.min(...chunks.map(c => 1 - Number(c.similarity))).toFixed(4),
      embedding_model: OLLAMA_MODEL,
      embedding_latency: embedLatency
    }, 'RAG retrieval: chunks retrieved — UNFILTERED (includes unmoderated comments)');

    // VULN: Poisoned context injected directly into prompt — no sanitization
    const context = chunks.map(c => `[Source: ${c.sourceType} #${c.sourceId}]\n${c.content}`).join('\n\n---\n\n');
    const prompt = `Use the following retrieved context to answer the question. Context may include user-submitted content.\n\nContext:\n${context}\n\nQuestion: ${question}\n\nAnswer:`;

    logger.info({
      'event.action': 'rag_prompt_constructed',
      prompt_template: 'Use the following retrieved context...',
      final_prompt_hash: finalPromptHash,
      context_length: context.length,
      token_count_estimate: prompt.length / 4,
      moderation_flags: 'none_applied'
    }, 'RAG query: prompt constructed with unfiltered context');

    const t1 = Date.now();
    const response = await ollama.generate({ model: OLLAMA_MODEL, prompt });
    const inferenceLatency = Date.now() - t1;
    ragQueries++;

    logger.info({
      'event.action': 'rag_query_complete',
      retrieved_chunks: chunks.length,
      retrieval_scores: retrievalScores,
      embedding_model: OLLAMA_MODEL,
      inference_latency: inferenceLatency,
      token_count: response.eval_count,
      final_prompt_hash: finalPromptHash
    }, 'RAG query: complete');

    res.json({ answer: response.response, sources: retrievedChunks });
  } catch (err: any) {
    logger.error({ err }, 'RAG query: error');
    res.status(500).json({ error: err.message });
  }
});

// Knowledge graph query (shows semantic graph poisoning results)
app.get('/graph', async (req, res) => {
  const { subject } = req.query;
  const where = subject ? { subject: { contains: subject as string } } : {};
  const nodes = await prisma.knowledgeGraph.findMany({ where, take: 100 });
  res.json(nodes);
});

// ─── Health & Metrics ────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ai-service', model: OLLAMA_MODEL });
});

app.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send([
    '# HELP ai_requests_total Total requests received',
    '# TYPE ai_requests_total counter',
    `ai_requests_total{service="ai-service"} ${reqCount}`,
    '# HELP ai_inferences_total Total LLM inference calls',
    '# TYPE ai_inferences_total counter',
    `ai_inferences_total{type="summarize"} ${aiInferences}`,
    `ai_inferences_total{type="rag"} ${ragQueries}`,
    '# HELP ai_ingest_errors_total Failed ingestion pipeline events',
    '# TYPE ai_ingest_errors_total counter',
    `ai_ingest_errors_total{service="ai-service"} ${ingestErrors}`,
  ].join('\n') + '\n');
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function chunkText(text: string, maxChars: number): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length > maxChars && current) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += ' ' + s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

// ─── Startup ─────────────────────────────────────────────────────────────────

const port = Number(process.env.AI_SERVICE_PORT) || 3007;
const server = app.listen(port, host, () => {
  logger.info({ service: 'ai-service', host, port }, `ai-service listening at http://${host}:${port}`);
});

const shutdown = () => {
  logger.info('ai-service: SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('ai-service: shutdown complete');
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
