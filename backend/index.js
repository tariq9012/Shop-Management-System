// index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const supplierRoutes = require('./routes/suppliers');
const customerRoutes = require('./routes/customers');
const salesRoutes = require('./routes/sales');
const purchaseOrderRoutes = require('./routes/purchaseOrders');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const usersRoutes = require('./routes/users');

const { notFound, errorHandler } = require('./middleware/errorHandler');
const db = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${
        Date.now() - start
      }ms`
    );
  });

  next();
});

// Serve uploaded product images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health checks
app.get('/', (req, res) => {
  res.json({
    status: 'Shop Management API is running',
  });
});

app.get('/api/health', async (req, res) => {
  try {
    await db.ping();

    res.json({
      status: 'ok',
      database: 'connected',
      provider: 'Neon PostgreSQL',
    });
  } catch (err) {
    console.error('Database health check failed:', err.message);

    res.status(503).json({
      status: 'error',
      database: 'disconnected',
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', usersRoutes);

// 404 + centralized error handling
app.use(notFound);
app.use(errorHandler);

// Export Express app for Vercel.
// Locally, start HTTP server only when this file is run directly.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;