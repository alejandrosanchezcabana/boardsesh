import 'dotenv/config';
import { startServer } from './server';
import { redisClientManager } from './redis/client';
import { closePool } from '@boardsesh/db/client';

async function main() {
  const { wss, httpServer, cleanupIntervals, shutdownServices } = await startServer();

  let shuttingDown = false;

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log('\nShutting down Boardsesh Daemon...');

    // Force exit after 10 seconds if graceful shutdown stalls
    const forceTimer = setTimeout(() => {
      console.log('Forcing shutdown...');
      process.exit(1);
    }, 10000);
    forceTimer.unref();

    // Stop periodic tasks first
    cleanupIntervals();

    // Shutdown EventBroker + RoomManager (flushes pending writes)
    await shutdownServices();

    // Close WebSocket connections
    wss.clients.forEach((client) => {
      client.close(1000, 'Server shutting down');
    });

    // Wait for WS and HTTP servers to close before touching the DB pool
    await new Promise<void>((resolve) => {
      wss.close(() => {
        console.log('WebSocket server closed');
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      httpServer.close(() => {
        console.log('HTTP server closed');
        resolve();
      });
    });

    // Disconnect from Redis
    await redisClientManager.disconnect();

    // Close database connection pool
    try {
      await closePool();
      console.log('Database pool closed');
    } catch (error) {
      console.warn('Error closing database pool:', error);
    }

    console.log('Shutdown complete');
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
