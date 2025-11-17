const express = require('express');
const router = express.Router();

// List products
router.get('/', async (req, res) => {
  const knex = req.db;
  const products = await knex('products').select('*').orderBy('sku');
  res.json(products);
});

// Get single product
router.get('/:id', async (req, res) => {
  const knex = req.db;
  const p = await knex('products').where('id', req.params.id).first();
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  res.json(p);
});

// Create product
router.post('/', async (req, res) => {
  const knex = req.db;
  const { sku, name, unit, cost_price, public_price } = req.body;
  try {
    const [id] = await knex('products').insert({ sku, name, unit, cost_price, public_price }).returning('id');
    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update product
router.put('/:id', async (req, res) => {
  const knex = req.db;
  try {
    await knex('products').where('id', req.params.id).update(req.body);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
