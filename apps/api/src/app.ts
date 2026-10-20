import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { generalLimiter } from './middleware/rate-limit';
import { csrfProtection } from './middleware/csrf';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { demoRouter } from './routes/demo';
import { profitRouter } from './routes/profit';
import { cashRouter } from './routes/cash';
import { financingRouter } from './routes/financing';
import { evidenceRouter } from './routes/evidence';
import { briefRouter } from './routes/brief';
import { recommendationsRouter, approvalsRouter } from './routes/recommendations';
import { auditRouter } from './routes/audit';
import { sourcesRouter } from './routes/sources';
import { importsRouter } from './routes/imports';
import { assistantRouter } from './routes/assistant';
import { dashboardRouter } from './routes/dashboard';
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
      redact: { paths: ['req.headers.cookie', 'req.headers.authorization', 'req.body.password', 'req.body.email'], censor: '[REDACTED]' }
    })
  );
  app.use(generalLimiter);

  app.use(healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/auth/demo', demoRouter);
  app.use(csrfProtection);
  app.use('/api/profit', profitRouter);
  app.use('/api/cash', cashRouter);
  app.use('/api/financing', financingRouter);
  app.use('/api/evidence', evidenceRouter);
  app.use('/api/brief', briefRouter);
  app.use('/api/recommendations', recommendationsRouter);
  app.use('/api/approvals', approvalsRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/sources', sourcesRouter);
  app.use('/api/imports', importsRouter);
  app.use('/api/assistant', assistantRouter);
  app.use('/api/dashboard', dashboardRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
