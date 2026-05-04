// Sentry initialization. MUST be imported before anything else in the backend
// entry point so OpenTelemetry can patch HTTP/Postgres/Redis/etc. modules
// before they're loaded. See https://docs.sentry.io/platforms/javascript/guides/node/install/
import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development.local', override: true });

import * as Sentry from '@sentry/node';

const isProduction = process.env.NODE_ENV === 'production';

Sentry.init({
  dsn: 'https://f55e6626faf787ae5291ad75b010ea14@o4510644927660032.ingest.us.sentry.io/4510644930150400',
  enabled: isProduction,
  enableLogs: true,
  sendDefaultPii: true,
  environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV ?? 'development',
  serverName: 'boardsesh-backend',
});

process.on('unhandledRejection', (reason) => {
  Sentry.captureException(reason);
});

process.on('uncaughtException', (error) => {
  Sentry.captureException(error);
});
