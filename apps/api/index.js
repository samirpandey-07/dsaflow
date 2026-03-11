const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const apiRoutes = require('./src/routes/api');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const helmet = require('helmet');
const { initJobs } = require('./src/jobs/index');


const app = express();
const PORT = process.env.PORT || 3001;

// Swagger configuration
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'DSAFlow API',
            version: '1.0.0',
            description: 'API documentation for DSAFlow problem tracking and analytics',
            contact: { name: 'DSAFlow Dev' },
            servers: [`http://localhost:${PORT}`]
        },
    },
    apis: ['./src/routes/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Rate limiting: relax in development/testing (max 1000/15min), strict in production (100/15min)
const isProd = process.env.NODE_ENV === 'production';
const limiter = require('express-rate-limit')({
    windowMs: 15 * 60 * 1000,
    max: isProd ? 100 : 1000,
    message: { status: 'error', message: 'Too many requests from this IP, please try again after 15 minutes' }
});

app.use(helmet()); // Security headers
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('dev'));
app.use(express.json());
app.use('/api', limiter);

// Health check endpoint for production monitoring
app.get('/healthz', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
    res.send('Welcome to the DSAFlow API! Everything is running smoothly.');
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Global JSON error handler
app.use((err, req, res, next) => {
    console.error(`[Error] ${err.stack}`);
    res.status(err.status || 500).json({
        status: 'error',
        message: process.env.NODE_ENV === 'production'
            ? 'Internal Server Error'
            : err.message
    });
});

app.listen(PORT, () => {
    console.log(`Backend API running on port ${PORT}`);
    // Start background jobs (only if REDIS_URL is configured)
    initJobs();
});

