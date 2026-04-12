import Fastify from 'fastify';
import cors from '@fastify/cors';
import { planRoutes } from './routes/plan.js';
import { reviewRoutes } from './routes/review.js';
import { statusRoutes } from './routes/status.js';

const PORT = Number(process.env.PORT) || 3334;
const PROJECT_DIR = process.env.PROJECT_DIR || process.cwd();
const PLAN_FILE = process.env.PLAN_FILE || '';

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: 'http://localhost:3333' });

// Make config available to routes
fastify.decorate('config', { projectDir: PROJECT_DIR, planFile: PLAN_FILE });

// Augment Fastify type
declare module 'fastify' {
  interface FastifyInstance {
    config: { projectDir: string; planFile: string };
  }
}

await fastify.register(planRoutes);
await fastify.register(reviewRoutes);
await fastify.register(statusRoutes);

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
