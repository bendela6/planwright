import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { FastifyInstance } from 'fastify';

export async function planRoutes(fastify: FastifyInstance) {
  // GET /api/plan — Read and return the plan markdown file
  fastify.get('/api/plan', async (_request, reply) => {
    const planFile = fastify.config.planFile;

    if (!planFile) {
      return reply.status(404).send({ error: 'No plan file configured' });
    }

    try {
      const content = await readFile(planFile, 'utf-8');
      return { content, filename: basename(planFile) };
    } catch {
      return reply.status(404).send({ error: 'Plan file not found' });
    }
  });

  // GET /api/plan/metadata — Return parsed plan metadata
  fastify.get('/api/plan/metadata', async (_request, reply) => {
    const planFile = fastify.config.planFile;

    if (!planFile) {
      return reply.status(404).send({ error: 'No plan file configured' });
    }

    let content: string;
    try {
      content = await readFile(planFile, 'utf-8');
    } catch {
      return reply.status(404).send({ error: 'Plan file not found' });
    }

    const lines = content.split('\n');
    let title = '';
    const sections: string[] = [];
    const tasks: string[] = [];
    let pendingSteps = 0;
    let completedSteps = 0;

    for (const line of lines) {
      if (!title && line.startsWith('# ')) {
        title = line.slice(2).trim();
      } else if (line.startsWith('## ')) {
        sections.push(line.slice(3).trim());
      } else if (line.startsWith('### Task ')) {
        tasks.push(line.slice(4).trim());
      }

      if (line.includes('- [ ]')) {
        pendingSteps++;
      } else if (line.includes('- [x]') || line.includes('- [X]')) {
        completedSteps++;
      }
    }

    return {
      title,
      sections,
      taskCount: tasks.length,
      completedSteps,
      totalSteps: pendingSteps + completedSteps,
    };
  });
}
