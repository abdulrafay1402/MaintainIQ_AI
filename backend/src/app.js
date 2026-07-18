const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());
app.use(morgan('dev'));

// Allowed origins: the deployed frontend (and its Vercel preview builds),
// CLIENT_URL, plus local dev origins — localhost and any device on the same
// private WiFi (phone testing / QR scan demos).
const allowedOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  const allowed = [
    'https://maintain-iq-ai.vercel.app',
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean);
  const isVercelPreview = /^https:\/\/maintain-iq-ai[a-z0-9-]*\.vercel\.app$/.test(origin);
  const isPrivateLan = /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)[\d.]+:5173$/.test(origin);
  if (allowed.includes(origin) || isVercelPreview || isPrivateLan) {
    return callback(null, true);
  }
  return callback(new Error('Not allowed by CORS'));
};

app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/api/health', async (req, res) => {
  const { getGeminiStatus, checkGeminiConnection } = require('./services/triageService');
  let gemini = getGeminiStatus();
  // On serverless the startup check never ran — do it lazily on the first
  // health hit so the endpoint reports the real AI status.
  if (!gemini.checkedAt && process.env.GEMINI_API_KEY) {
    gemini = await checkGeminiConnection();
  }
  res.json({ status: 'ok', ai: gemini.connected ? 'connected' : 'fallback', aiReason: gemini.connected ? undefined : gemini.reason });
});

app.get('/', (req, res) => {
  res.json({
    message: 'MaintainIQ API Server is running',
    status: 'ok',
    frontend: process.env.CLIENT_URL || 'http://localhost:5173',
  });
});

app.use('/api', routes);
app.use(errorHandler);

module.exports = app;