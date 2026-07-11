const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const xssClean = require('xss-clean');
const hpp = require('hpp');

const authRoutes = require('./routes/auth.routes');
const shopRoutes = require('./routes/shop.routes');
const productRoutes = require('./routes/product.routes');
const promoRoutes = require('./routes/promo.routes');
const orderRoutes = require('./routes/order.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const orderController = require('./controllers/order.controller');

const app = express();

// --- Sécurité de base ---
app.set('trust proxy', 1); // nécessaire derrière le proxy Render
app.use(helmet());
app.use(xssClean()); // protection XSS basique sur req.body/query/params
app.use(hpp());      // protection contre la pollution de paramètres HTTP

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// --- Webhook Stripe : DOIT recevoir le body brut, donc placé AVANT express.json() ---
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  orderController.stripeWebhook
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Rate limit global (anti-flood, en plus du rate limit spécifique sur /auth)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// --- Routes ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'CecaShop API' }));
app.use('/api/auth', authRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/products', productRoutes);
app.use('/api/promo-codes', promoRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable.' });
});

// Gestionnaire d'erreurs global
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Erreur interne du serveur.' : err.message,
  });
});

module.exports = app;
