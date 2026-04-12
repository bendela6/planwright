import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';

interface TaskStatus {
  id: number;
  title: string;
  steps: { total: number; completed: number };
  status: 'pending' | 'in_progress' | 'completed';
}

export async function statusRoutes(fastify: FastifyInstance) {
  // GET /api/status — Parse plan for implementation progress
  fastify.get('/api/status', async (_request, reply) => {
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
    const tasks: TaskStatus[] = [];
    let currentTask: TaskStatus | null = null;

    for (const line of lines) {
      const taskMatch = line.match(/^### Task (\d+): (.+)/);
      if (taskMatch) {
        currentTask = {
          id: Number(taskMatch[1]),
          title: taskMatch[2].trim(),
          steps: { total: 0, completed: 0 },
          status: 'pending',
        };
        tasks.push(currentTask);
        continue;
      }

      if (currentTask) {
        if (line.includes('- [ ]')) {
          currentTask.steps.total++;
        } else if (line.includes('- [x]') || line.includes('- [X]')) {
          currentTask.steps.total++;
          currentTask.steps.completed++;
        }
      }
    }

    // Determine status for each task
    for (const task of tasks) {
      if (task.steps.total === 0 || task.steps.completed === 0) {
        task.status = 'pending';
      } else if (task.steps.completed === task.steps.total) {
        task.status = 'completed';
      } else {
        task.status = 'in_progress';
      }
    }

    const totalSteps = tasks.reduce((sum, t) => sum + t.steps.total, 0);
    const completedSteps = tasks.reduce((sum, t) => sum + t.steps.completed, 0);
    const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return {
      tasks,
      overall: {
        total: totalSteps,
        completed: completedSteps,
        percentage,
      },
    };
  });
}
