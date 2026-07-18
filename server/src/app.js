import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { env } from './config/env.js';
import routes from './routes/index.js';
import errorMiddleware from './middlewares/error.middleware.js';
import notFoundMiddleware from './middlewares/notFound.middleware.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendBuildPath = path.resolve(__dirname, '../public');

app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 10000 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many requests, please try again later.',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 10000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many authentication attempts, please try again later.',
  },
});

app.use(limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(compression());

app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', routes);

if (env.NODE_ENV === 'production') {
  app.use(
    express.static(frontendBuildPath, {
      index: false,
      maxAge: '1d',
    }),
  );

  app.use((req, res, next) => {
    const isGetRequest = req.method === 'GET';
    const acceptsHTML = req.accepts('html');
    const isAPIRequest = req.path.startsWith('/api');
    const isHealthRequest = req.path === '/health';

    if (
      isGetRequest &&
      acceptsHTML &&
      !isAPIRequest &&
      !isHealthRequest
    ) {
      return res.sendFile(path.join(frontendBuildPath, 'index.html'));
    }

    next();
  });
}

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;