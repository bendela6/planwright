#!/usr/bin/env node
/**
 * Startup script that:
 * 1. Finds two free ports (one for Vite, one for Fastify)
 * 2. Spawns both processes with those ports via env vars
 * 3. Prints the URLs clearly
 * 4. Forwards SIGTERM/SIGINT to children
 */
import net from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

const [webPort, apiPort] = await Promise.all([findFreePort(), findFreePort()]);

console.log('\n┌─────────────────────────────────────┐');
console.log('│     Plan Reviewer starting...       │');
console.log('├─────────────────────────────────────┤');
console.log(`│  Web UI:  http://localhost:${String(webPort).padEnd(8)} │`);
console.log(`│  API:     http://localhost:${String(apiPort).padEnd(8)} │`);
console.log('└─────────────────────────────────────┘\n');

const env = {
  ...process.env,
  WEB_PORT: String(webPort),
  API_PORT: String(apiPort),
};

const vite = spawn('pnpm', ['exec', 'vite'], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
});

const server = spawn('pnpm', ['exec', 'tsx', 'server/index.ts'], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
});

function cleanup() {
  vite.kill('SIGTERM');
  server.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

vite.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Vite exited with code ${code}`);
    server.kill('SIGTERM');
    process.exit(code);
  }
});

server.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Server exited with code ${code}`);
    vite.kill('SIGTERM');
    process.exit(code);
  }
});
