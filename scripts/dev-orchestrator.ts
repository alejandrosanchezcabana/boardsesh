import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');

const DEFAULT_BACKEND_PORT = 8080;
const DEFAULT_WEB_PORT = 3000;
const HEALTH_CHECK_TIMEOUT_MS = 5000;
const HEALTH_CHECK_INTERVAL_MS = 500;
const HEALTH_CHECK_MAX_ATTEMPTS = HEALTH_CHECK_TIMEOUT_MS / HEALTH_CHECK_INTERVAL_MS;

interface ProcessRef {
  process: ReturnType<typeof spawn> | null;
  isManaged: boolean; // Did we start it?
}

const processes: { backend: ProcessRef; web: ProcessRef } = {
  backend: { process: null, isManaged: false },
  web: { process: null, isManaged: false },
};

let backendHealthy = false;

/**
 * Find the first existing ref from a preference list (e.g. origin/main → main).
 */
function resolveBaseRef(): string | null {
  for (const ref of ['origin/main', 'main']) {
    const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', ref], {
      cwd: ROOT_DIR,
    });
    if (result.status === 0) return ref;
  }
  return null;
}

/**
 * Returns true if packages/backend differs from the merge base with origin/main (or main).
 * Covers committed, staged, and unstaged changes.
 */
function hasBackendChanges(): { changed: boolean; baseRef: string | null } {
  try {
    const baseRef = resolveBaseRef();
    if (!baseRef) return { changed: false, baseRef: null };

    const mergeBase = execFileSync('git', ['merge-base', 'HEAD', baseRef], {
      cwd: ROOT_DIR,
      encoding: 'utf8',
    }).trim();

    // `git diff <mergeBase> -- <path>` compares working tree to merge base; --quiet exits 1 on diff.
    const result = spawnSync('git', ['diff', '--quiet', mergeBase, '--', 'packages/backend'], {
      cwd: ROOT_DIR,
    });
    return { changed: result.status === 1, baseRef };
  } catch {
    return { changed: false, baseRef: null };
  }
}

/**
 * Check if backend is already running and healthy
 */
async function checkBackendHealth(port: number): Promise<boolean> {
  for (let attempt = 0; attempt < HEALTH_CHECK_MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      const response = await fetch(`http://localhost:${port}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.info(`[dev] ✓ Backend is already running on port ${port}`);
        return true;
      }
    } catch {
      // Not ready yet, try again
    }

    await delay(HEALTH_CHECK_INTERVAL_MS);
  }

  return false;
}

/**
 * Check if a port is in use by attempting a TCP connection
 */
async function isPortInUse(port: number, timeout = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: 'localhost' }, () => {
      socket.destroy();
      resolve(true);
    });

    socket.setTimeout(timeout);
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Find an available port by incrementing from the base port
 */
async function findAvailablePort(basePort: number, maxAttempts = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = basePort + i;
    const inUse = await isPortInUse(port);
    if (!inUse) {
      if (i > 0) {
        console.info(`[dev] Port ${basePort} in use, using ${port} instead`);
      }
      return port;
    }
  }

  console.error(`[dev] Could not find available port starting from ${basePort}`);
  process.exit(1);
}

/**
 * Start the backend in the background
 */
function startBackend(port: number): ReturnType<typeof spawn> {
  console.info(`[dev] Starting backend on port ${port}...`);

  const backendProcess = spawn('bun', ['run', '--filter=boardsesh-backend', 'dev'], {
    cwd: ROOT_DIR,
    stdio: ['inherit', 'inherit', 'inherit'],
    env: {
      ...process.env,
      PORT: String(port),
    },
  });

  backendProcess.on('error', (error) => {
    console.error(`[dev] Backend failed to start:`, error);
    process.exit(1);
  });

  backendProcess.on('exit', (code, signal) => {
    if (signal) {
      console.info(`[dev] Backend terminated by signal ${signal}`);
    } else if (code !== 0) {
      console.error(`[dev] Backend exited with code ${code}`);
    }
  });

  return backendProcess;
}

/**
 * Start the Next.js development server
 */
function startWeb(port: number, backendPort: number): ReturnType<typeof spawn> {
  console.info(`[dev] Starting web on port ${port}...`);

  const webProcess = spawn('bun', ['run', 'dev'], {
    cwd: join(ROOT_DIR, 'packages/web'),
    stdio: ['inherit', 'inherit', 'inherit'],
    env: {
      ...process.env,
      PORT: String(port),
      BACKEND_PORT: String(backendPort),
    },
  });

  webProcess.on('error', (error) => {
    console.error(`[dev] Web failed to start:`, error);
    process.exit(1);
  });

  webProcess.on('exit', (code, signal) => {
    if (signal) {
      console.info(`[dev] Web terminated by signal ${signal}`);
    } else if (code !== 0) {
      console.error(`[dev] Web exited with code ${code}`);
    }
  });

  return webProcess;
}

/**
 * Cleanup handler for graceful shutdown
 */
async function shutdown() {
  console.info('\n[dev] Shutting down...');

  // Only kill processes we started
  if (processes.backend.isManaged && processes.backend.process) {
    console.info('[dev] Stopping backend...');
    processes.backend.process.kill('SIGTERM');
  } else if (processes.backend.process) {
    console.info('[dev] Backend was already running, leaving it as-is');
  }

  if (processes.web.process) {
    console.info('[dev] Stopping web...');
    processes.web.process.kill('SIGTERM');
  }

  // Give processes time to shut down gracefully
  await delay(1000);

  // Force kill if still running
  if (processes.backend.isManaged && processes.backend.process && !processes.backend.process.killed) {
    processes.backend.process.kill('SIGKILL');
  }

  if (processes.web.process && !processes.web.process.killed) {
    processes.web.process.kill('SIGKILL');
  }

  process.exit(0);
}

/**
 * Main orchestrator
 */
async function main(): Promise<void> {
  // Parse command line args
  const args = process.argv.slice(2);
  const explicitNewBackend = args.includes('--be');
  const { changed: backendChanged, baseRef } = hasBackendChanges();
  const forceNewBackend = explicitNewBackend || backendChanged;

  if (backendChanged && !explicitNewBackend) {
    console.info(`[dev] Detected changes in packages/backend vs ${baseRef} — starting a fresh backend`);
  }

  const requestedBackendPort = parseInt(process.env.BACKEND_PORT || String(DEFAULT_BACKEND_PORT), 10);
  const requestedWebPort = parseInt(process.env.PORT || String(DEFAULT_WEB_PORT), 10);

  // Determine backend port
  let backendPort = requestedBackendPort;
  let shouldStartBackend = false;

  // Check if the default backend port has a healthy instance
  if (!forceNewBackend && !process.env.BACKEND_PORT) {
    backendHealthy = await checkBackendHealth(DEFAULT_BACKEND_PORT);
    if (backendHealthy) {
      backendPort = DEFAULT_BACKEND_PORT;
      console.info(`[dev] Reusing existing backend on port ${backendPort}`);
    } else {
      shouldStartBackend = true;
    }
  } else if (forceNewBackend) {
    // Find available port for new backend
    backendPort = await findAvailablePort(requestedBackendPort);
    shouldStartBackend = true;
  } else {
    // Explicit BACKEND_PORT set via env
    shouldStartBackend = true;
  }

  // Find available port for web (always auto-increment)
  const webPort = process.env.PORT ? requestedWebPort : await findAvailablePort(requestedWebPort);

  console.info(`[dev] Boardsesh Development Orchestrator`);
  console.info(`[dev] Backend port: ${backendPort}${forceNewBackend ? ' (new instance)' : ''}`);
  console.info(`[dev] Web port: ${webPort}`);
  console.info();

  // Start backend if needed
  if (shouldStartBackend && !backendHealthy) {
    const portInUse = await isPortInUse(backendPort);

    if (portInUse && process.env.BACKEND_PORT) {
      // Port is explicitly set and in use but not responding to health check
      console.warn(`[dev] ⚠ Port ${backendPort} is in use but backend is not responding`);
      console.warn(`[dev] ⚠ Try running 'lsof -i :${backendPort}' to check what's using the port`);
      console.warn(`[dev] ⚠ You may need to kill the process manually`);
      process.exit(1);
    }

    // Start backend
    console.info(`[dev] Starting backend on port ${backendPort}...`);
    processes.backend.process = startBackend(backendPort);
    processes.backend.isManaged = true;

    // Wait for backend to be healthy
    console.info(`[dev] Waiting for backend to be healthy...`);
    backendHealthy = await checkBackendHealth(backendPort);

    if (!backendHealthy) {
      console.error(`[dev] ✗ Backend failed to start or become healthy`);
      process.exit(1);
    }

    console.info(`[dev] ✓ Backend is healthy`);
  }

  // Start web
  processes.web.process = startWeb(webPort, backendPort);

  // Graceful shutdown
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[dev] Fatal error:', error);
  process.exit(1);
});
