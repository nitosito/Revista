const express = require('express');
const router = express.Router();
const { buildMonthlyReport } = require('../utils/export-xlsx');
const { renderPdfBuffer } = require('../utils/export-pdf');

// GET /api/reports/monthly?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/monthly', async (req, res) => {
  const knex = req.db;
  const { start, end } = req.query;
  try {
    // Inventory: expected qty per product in warehouse
    const inventory = await knex.raw(
      `SELECT p.sku, p.name, l.name as location_name,
        COALESCE(SUM(CASE WHEN sm.to_location_id = l.id THEN sm.quantity
                 WHEN sm.from_location_id = l.id THEN -sm.quantity ELSE 0 END),0) AS expected_qty,
        p.cost_price, p.public_price
      FROM products p CROSS JOIN locations l
      LEFT JOIN stock_movements sm ON sm.product_id = p.id AND sm.created_at <= ?
      GROUP BY p.id, l.id, l.name`, [end || knex.fn.now()]
    );

    // Sales rows in period
    const sales = await knex('sale_items as si')
      .select('s.sale_date as date', 'loc.name as location', 'p.sku', 'p.name', knex.raw('SUM(si.quantity) as qty'), knex.raw('SUM(si.quantity*si.unit_price) as value_public'))
      .join('sales as s', 'si.sale_id', 's.id')
      .leftJoin('locations as loc', 's.location_id', 'loc.id')
      .join('products as p', 'si.product_id', 'p.id')
      .whereBetween('s.sale_date', [start || '1970-01-01', end || knex.fn.now()])
      .groupBy('s.sale_date', 'loc.name', 'p.sku', 'p.name')
      .orderBy('s.sale_date');

    // Expenses rows in period
    const expenses = await knex('expenses as e')
      .select('e.expense_date as date', 'loc.name as location', 'e.category', 'e.amount')
      .leftJoin('locations as loc', 'e.location_id', 'loc.id')
      .whereBetween('e.expense_date', [start || '1970-01-01', end || knex.fn.now()])
      .orderBy('e.expense_date');

    // Summary
    const totalSales = await knex('sales').whereBetween('sale_date', [start || '1970-01-01', end || knex.fn.now()]).sum('total_amount as total');
    const totalExpenses = await knex('expenses').whereBetween('expense_date', [start || '1970-01-01', end || knex.fn.now()]).sum('amount as total');

    res.json({ inventory: inventory.rows || inventory, sales, expenses, summary: { total_sales: totalSales[0].total || 0, total_expenses: totalExpenses[0].total || 0 } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/monthly/xlsx?start=&end=
router.get('/monthly/xlsx', async (req, res) => {
  const knex = req.db;
  const { start, end } = req.query;
  try {
    // reuse same queries as above but simplified for workbook
    const inventoryRows = await knex.raw(`SELECT p.sku, p.name, l.name as location_name, COALESCE(SUM(CASE WHEN sm.to_location_id = l.id THEN sm.quantity WHEN sm.from_location_id = l.id THEN -sm.quantity ELSE 0 END),0) AS expected_qty, p.cost_price, p.public_price FROM products p CROSS JOIN locations l LEFT JOIN stock_movements sm ON sm.product_id = p.id AND sm.created_at <= ? GROUP BY p.id, l.id, l.name`, [end || knex.fn.now()]);

    const salesRows = await knex('sale_items as si')
      .select('s.sale_date as date', 'loc.name as location', 'p.sku', 'p.name', knex.raw('SUM(si.quantity) as qty'), knex.raw('SUM(si.quantity*si.unit_price) as value_public'))
      .join('sales as s', 'si.sale_id', 's.id')
      .leftJoin('locations as loc', 's.location_id', 'loc.id')
      .join('products as p', 'si.product_id', 'p.id')
      .whereBetween('s.sale_date', [start || '1970-01-01', end || knex.fn.now()])
      .groupBy('s.sale_date', 'loc.name', 'p.sku', 'p.name')
      .orderBy('s.sale_date');

    const expensesRows = await knex('expenses as e')
      .select('e.expense_date as date', 'loc.name as location', 'e.category', 'e.amount')
      .leftJoin('locations as loc', 'e.location_id', 'loc.id')
      .whereBetween('e.expense_date', [start || '1970-01-01', end || knex.fn.now()])
      .orderBy('e.expense_date');

    const totalSales = await knex('sales').whereBetween('sale_date', [start || '1970-01-01', end || knex.fn.now()]).sum('total_amount as total');
    const totalExpenses = await knex('expenses').whereBetween('expense_date', [start || '1970-01-01', end || knex.fn.now()]).sum('amount as total');

    const summary = { total_sales: totalSales[0].total || 0, total_expenses: totalExpenses[0].total || 0 };

    const invRows = (inventoryRows.rows || inventoryRows).map(r => ({ sku: r.sku, name: r.name, location: r.location_name, qty: r.expected_qty, value_cost: (r.expected_qty * parseFloat(r.cost_price || 0)).toFixed(2), value_public: (r.expected_qty * parseFloat(r.public_price || 0)).toFixed(2) }));
    const sRows = salesRows.map(r => ({ date: r.date, location: r.location, sku: r.sku, name: r.name, qty: r.qty, value_public: r.value_public }));
    const eRows = expensesRows.map(r => ({ date: r.date, location: r.location, category: r.category, amount: r.amount }));

    const wb = await buildMonthlyReport({ inventoryRows: invRows, salesRows: sRows, expensesRows: eRows, summary });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=vaquero_report_${start||'start'}_${end||'end'}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/monthly/pdf?start=&end=
router.get('/monthly/pdf', async (req, res) => {
  const knex = req.db;
  const { start, end } = req.query;
  try {
    // Build data (reuse simplified queries)
    const salesRows = await knex('sale_items as si')
      .select('s.sale_date as date', 'loc.name as location', 'p.sku', 'p.name', knex.raw('SUM(si.quantity) as qty'), knex.raw('SUM(si.quantity*si.unit_price) as value_public'))
      .join('sales as s', 'si.sale_id', 's.id')
      .leftJoin('locations as loc', 's.location_id', 'loc.id')
      .join('products as p', 'si.product_id', 'p.id')
      .whereBetween('s.sale_date', [start || '1970-01-01', end || knex.fn.now()])
      .groupBy('s.sale_date', 'loc.name', 'p.sku', 'p.name')
      .orderBy('s.sale_date');

    const expensesRows = await knex('expenses as e')
      .select('e.expense_date as date', 'loc.name as location', 'e.category', 'e.amount')
      .leftJoin('locations as loc', 'e.location_id', 'loc.id')
      .whereBetween('e.expense_date', [start || '1970-01-01', end || knex.fn.now()])
      .orderBy('e.expense_date');

    const totalSales = await knex('sales').whereBetween('sale_date', [start || '1970-01-01', end || knex.fn.now()]).sum('total_amount as total');
    const totalExpenses = await knex('expenses').whereBetween('expense_date', [start || '1970-01-01', end || knex.fn.now()]).sum('amount as total');

    const summary = { total_sales: totalSales[0].total || 0, total_expenses: totalExpenses[0].total || 0 };

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Vaquero Report</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"></head><body><div class="container"><h1>Vaquero - Informe mensual</h1><p>Periodo: ${start||'inicio'} → ${end||'hoy'}</p><h2>Resumen</h2><table class="table"><tbody><tr><td>Ventas totales</td><td>${summary.total_sales}</td></tr><tr><td>Gastos totales</td><td>${summary.total_expenses}</td></tr><tr><td>Neto</td><td>${(summary.total_sales||0)-(summary.total_expenses||0)}</td></tr></tbody></table><h2>Ventas</h2><table class="table table-sm table-striped"><thead><tr><th>Fecha</th><th>Punto</th><th>SKU</th><th>Producto</th><th>Cantidad</th><th>Valor público</th></tr></thead><tbody>${salesRows.map(r=>`<tr><td>${r.date}</td><td>${r.location||'--'}</td><td>${r.sku}</td><td>${r.name}</td><td>${r.qty}</td><td>${r.value_public}</td></tr>`).join('')}</tbody></table><h2>Gastos</h2><table class="table table-sm table-striped"><thead><tr><th>Fecha</th><th>Punto</th><th>Categoría</th><th>Monto</th></tr></thead><tbody>${expensesRows.map(r=>`<tr><td>${r.date}</td><td>${r.location||'--'}</td><td>${r.category}</td><td>${r.amount}</td></tr>`).join('')}</tbody></table></div></body></html>`;

    const pdfBuffer = await renderPdfBuffer(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=vaquero_report_${start||'start'}_${end||'end'}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;