import Fastify from 'fastify';
import cors from '@fastify/cors';
import { planRoutes } from './routes/plan.js';
import { reviewRoutes } from './routes/review.js';
import { statusRoutes } from './routes/status.js';

const API_PORT = Number(process.env.API_PORT) || 0; // 0 = auto-pick free port
const PROJECT_DIR = process.env.PROJECT_DIR || process.cwd();
const PLAN_FILE = process.env.PLAN_FILE || '';

const fastify = Fastify({ logger: true });

// Allow any localhost origin (Vite may pick a random port)
await fastify.register(cors, { origin: /^http:\/\/localhost:\d+$/ });

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
  await fastify.listen({ port: API_PORT, host: '127.0.0.1' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
