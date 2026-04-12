import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

interface ReviewNote {
  section: string;
  fragment: string;
  note: string;
}

interface ReviewBody {
  status: 'review';
  notes: ReviewNote[];
}

export async function reviewRoutes(fastify: FastifyInstance) {
  // POST /api/review — Save review notes
  fastify.post<{ Body: ReviewBody }>('/api/review', async (request, reply) => {
    const { status, notes } = request.body;
    const guideDir = join(fastify.config.projectDir, '.planwright');
    const reviewFile = join(guideDir, 'review-notes.json');

    await mkdir(guideDir, { recursive: true });
    await writeFile(reviewFile, JSON.stringify({ status, notes }, null, 2), 'utf-8');

    return reply.status(200).send({ ok: true });
  });

  // POST /api/approve — Approve the plan
  fastify.post('/api/approve', async (_request, reply) => {
    const guideDir = join(fastify.config.projectDir, '.planwright');
    const reviewFile = join(guideDir, 'review-notes.json');

    await mkdir(guideDir, { recursive: true });
    await writeFile(
      reviewFile,
      JSON.stringify({ status: 'approved', timestamp: new Date().toISOString() }, null, 2),
      'utf-8'
    );

    return reply.status(200).send({ ok: true });
  });

  // GET /api/review — Read current review status
  fastify.get('/api/review', async (_request, reply) => {
    const reviewFile = join(fastify.config.projectDir, '.planwright', 'review-notes.json');

    try {
      const content = await readFile(reviewFile, 'utf-8');
      return reply.status(200).send(JSON.parse(content));
    } catch {
      return reply.status(200).send({ status: 'none' });
    }
  });
}
