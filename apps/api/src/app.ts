import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { generalLimiter } from './middleware/rate-limit';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { errorHandler, notFoundHandler } from './middleware/error';

export function createApp(): express.Express {
  const app = express();

  // Behind Render/Railway/Vercel proxies we need the real client IP for rate limits.
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.WEB_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' },
      redact: { paths: ['req.headers.cookie', 'req.headers.authorization'], censor: '[REDACTED]' }
    })
  );
  app.use(generalLimiter);

  app.use(healthRouter);
  app.use('/api/auth', authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
