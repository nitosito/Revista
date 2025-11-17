require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const knexConfig = require('../knexfile').development;
const knex = require('knex')(knexConfig);
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const reportsRoutes = require('./routes/reports');

const app = express();
app.use(bodyParser.json());

// attach db to req for simple access
app.use((req, res, next) => {
  req.db = knex;
  next();
});

// simple auth middleware (scaffold)
const jwt = require('jsonwebtoken');
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const token = auth.slice(7);
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret_dev_jwt');
      req.user = { id: payload.userId, username: payload.username };
    } catch (e) {
      // ignore invalid token in scaffold
    }
  }
  next();
});

// routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/sales', salesRoutes);
// reports route will be added later; keeping placeholder
app.use('/api/reports', reportsRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`${process.env.APP_NAME || 'Vaquero'} backend listening on port ${PORT}`);
});