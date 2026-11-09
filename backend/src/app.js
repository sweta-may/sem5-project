const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const healthRoutes = require('./routes/healthRoutes');
const hostRoutes = require('./routes/hostRoutes');
const recordRoutes = require('./routes/recordRoutes');
const alertRoutes = require('./routes/alertRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const simulationRoutes = require('./routes/simulationRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.LOG_LEVEL || 'dev'));
}

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/hosts', hostRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/simulation', simulationRoutes);

// Serve frontend static build if available
const path = require('path');
const fs = require('fs');
const frontendDist = path.join(__dirname, '../../frontend/dist');

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.originalUrl.startsWith('/api')) {
      return res.sendFile(path.join(frontendDist, 'index.html'));
    }
    next();
  });
} else {
  // Root fallback route
  app.get('/', (req, res) => {
    res.status(200).json({
      message: 'Network Bandwidth Usage Monitoring and Threshold Alert API is running.',
      documentation: '/api/health'
    });
  });
}

// Centralized Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
