require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const authRoutes = require('./routes/auth');
const reconciliationRoutes = require('./routes/reconciliation');
const historyRoutes = require('./routes/history');
const settingsRoutes = require('./routes/settings');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy for cloud deployments (required for rate limiting behind reverse proxy)
if (isProduction) {
    app.set('trust proxy', 1);
}

// Compression for production
if (isProduction) {
    app.use(compression());
}

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP
    message: {
        error: 'Too many requests',
        message: 'You have exceeded the rate limit. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => !isProduction && req.path.startsWith('/api/') === false
});

app.use('/api/', limiter);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://www.gstatic.com",
                "https://cdnjs.cloudflare.com"
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://fonts.googleapis.com"
            ],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com"
            ],
            connectSrc: [
                "'self'",
                "https://*.firebaseio.com",
                "https://*.googleapis.com",
                "https://identitytoolkit.googleapis.com",
                "https://securetoken.googleapis.com"
            ],
            imgSrc: ["'self'", "data:", "https:"],
            frameSrc: ["https://*.firebaseapp.com"]
        }
    }
}));

// CORS configuration
const corsOptions = {
    origin: isProduction
        ? (process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [])
        : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Logging
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Home page (landing page) - MUST be before static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/home.html'));
});

// App page (requires auth - handled client-side)
app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Static files - index option false prevents auto-serving index.html for /
app.use(express.static(path.join(__dirname, '../public'), { index: false }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/reconciliation', reconciliationRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/settings', settingsRoutes);

// Health check endpoint (for load balancers and monitoring)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: require('../package.json').version,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Readiness check (for Kubernetes/cloud deployments)
app.get('/api/ready', async (req, res) => {
    try {
        // Check Firebase connection
        const { db } = require('./config/firebase');
        if (db) {
            await db.collection('_health').doc('check').get();
        }
        res.json({ ready: true });
    } catch (error) {
        res.status(503).json({ ready: false, error: 'Database not ready' });
    }
});

// Catch-all for SPA routes - serve landing page
app.get('*', (req, res) => {
    // Check if it's an asset request that wasn't found
    if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        return res.status(404).send('Not found');
    }
    res.sendFile(path.join(__dirname, '../public/home.html'));
});

// Error handling
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
    console.log(`\n[SERVER] ${signal} received. Shutting down gracefully...`);
    server.close(() => {
        console.log('[SERVER] HTTP server closed.');
        process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
        console.error('[SERVER] Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

// Start server
const server = app.listen(PORT, () => {
    const env = process.env.NODE_ENV || 'development';
    if (isProduction) {
        console.log(`[SERVER] Municipal Bank Reconciliation System started`);
        console.log(`[SERVER] Port: ${PORT} | Environment: ${env}`);
    } else {
        console.log(`
╔════════════════════════════════════════════════════════════╗
║     Municipal Bank Reconciliation System                   ║
║     Server running on http://localhost:${PORT}                ║
║     Environment: ${env}                          ║
╚════════════════════════════════════════════════════════════╝
        `);
    }
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
