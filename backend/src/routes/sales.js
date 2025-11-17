const express = require('express');
const router = express.Router();

// body: { location_id, customer_name, items: [{ product_id, quantity, unit_price }] }
router.post('/', async (req, res) => {
  const knex = req.db;
  const { location_id, customer_name, items } = req.body;
  const userId = req.user ? req.user.id : null;

  if (!items || items.length === 0) return res.status(400).json({ error: 'No hay items' });

  try {
    await knex.transaction(async trx => {
      let total_amount = 0;
      let total_cost = 0;
      const [sale] = await trx('sales').insert({ sale_date: knex.fn.now(), location_id, customer_name, total_amount: 0, total_cost: 0, created_by: userId }).returning(['id']);
      const saleId = sale.id || sale;

      for (const it of items) {
        const product = await trx('products').where('id', it.product_id).first();
        if (!product) throw new Error('Producto no encontrado: ' + it.product_id);

        const unit_cost = product.cost_price;
        const unit_price = it.unit_price;

        await trx('sale_items').insert({ sale_id: saleId, product_id: it.product_id, quantity: it.quantity, unit_price, unit_cost });

        await trx('stock_movements').insert({ product_id: it.product_id, from_location_id: location_id, to_location_id: null, quantity: it.quantity, movement_type: 'SALE', unit_cost, unit_price_public: unit_price, created_by: userId });

        total_amount += parseFloat(it.quantity) * parseFloat(unit_price);
        total_cost += parseFloat(it.quantity) * parseFloat(unit_cost);
      }

      await trx('sales').where('id', saleId).update({ total_amount, total_cost });
      res.json({ success: true, saleId });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al crear la venta' });
  }
});

module.exports = router;
