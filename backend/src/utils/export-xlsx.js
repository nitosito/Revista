const ExcelJS = require('exceljs');

async function buildMonthlyReport({ inventoryRows = [], salesRows = [], expensesRows = [], summary = {} }) {
  const wb = new ExcelJS.Workbook();
  const invSheet = wb.addWorksheet('Inventario');
  invSheet.columns = [
    { header: 'SKU', key: 'sku', width: 15 },
    { header: 'Producto', key: 'name', width: 30 },
    { header: 'Ubicación', key: 'location', width: 20 },
    { header: 'Cantidad', key: 'qty', width: 12 },
    { header: 'Valor a costo', key: 'value_cost', width: 15 },
    { header: 'Valor público', key: 'value_public', width: 15 }
  ];
  inventoryRows.forEach(r => invSheet.addRow(r));

  const salesSheet = wb.addWorksheet('Ventas');
  salesSheet.columns = [
    { header: 'Fecha', key: 'date', width: 18 },
    { header: 'Punto', key: 'location', width: 18 },
    { header: 'SKU', key: 'sku', width: 12 },
    { header: 'Producto', key: 'name', width: 30 },
    { header: 'Cantidad', key: 'qty', width: 12 },
    { header: 'Valor público', key: 'value_public', width: 15 }
  ];
  salesRows.forEach(r => salesSheet.addRow(r));

  const expSheet = wb.addWorksheet('Gastos');
  expSheet.columns = [
    { header: 'Fecha', key: 'date', width: 18 },
    { header: 'Punto', key: 'location', width: 18 },
    { header: 'Categoría', key: 'category', width: 18 },
    { header: 'Monto', key: 'amount', width: 12 }
  ];
  expensesRows.forEach(r => expSheet.addRow(r));

  const summarySheet = wb.addWorksheet('Resumen');
  summarySheet.addRow(['Ventas totales', summary.total_sales || 0]);
  summarySheet.addRow(['Gastos totales', summary.total_expenses || 0]);
  summarySheet.addRow(['Neto operativo', (summary.total_sales || 0) - (summary.total_expenses || 0)]);

  return wb;
}

module.exports = { buildMonthlyReport };
