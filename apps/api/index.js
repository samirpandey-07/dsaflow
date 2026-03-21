const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const apiRoutes = require('./src/routes');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

function corsOrigin(origin, callback) {
    if (!origin) {
        return callback(null, true);
    }

    if (!isProd) {
        return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
        return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
}

const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'DSAFlow API',
            version: '1.0.0',
            description: 'API documentation for DSAFlow problem tracking and analytics',
            contact: { name: 'DSAFlow Dev' },
            servers: [process.env.API_BASE_URL || `http://localhost:${PORT}`],
        },
    },
    apis: ['./src/routes/*.routes.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

const limiter = require('express-rate-limit')({
    windowMs: 15 * 60 * 1000,
    max: isProd ? 100 : 1000,
    message: { status: 'error', message: 'Too many requests from this IP, please try again after 15 minutes' },
});

app.use(helmet());
app.use(cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan('dev'));
app.use(express.json());
app.use('/api', limiter);

// Health check routes moved to src/routes/index.js under /api

app.use('/api', apiRoutes);

app.get('/', (_req, res) => {
    res.send('Welcome to the DSAFlow API! Everything is running smoothly.');
});

// Handled by /api router

app.use((err, _req, res, _next) => {
    console.error(`[Error] ${err.stack}`);
    res.status(err.status || 500).json({
        status: 'error',
        message: process.env.NODE_ENV === 'production'
            ? 'Internal Server Error'
            : err.message,
    });
});

app.listen(PORT, () => {
    console.log(`Backend API running on port ${PORT}`);
    if (isProd && allowedOrigins.length === 0) {
        console.warn('[CORS] ALLOWED_ORIGINS is empty in production; browser clients will be blocked until it is configured.');
    }
});
