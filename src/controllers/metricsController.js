const { QueryTypes } = require('sequelize');
const db = require('../config/database');
const zone = 'America/Argentina/Buenos_Aires';
const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
function monthStart(year, month) {
  const target = Date.UTC(year, month - 1, 1);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
    guess += target - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  }
  return new Date(guess);
}
module.exports = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (Object.keys(req.query).some((key) => !['month', 'year'].includes(key))) return res.status(400).json({ message: 'Usá los filtros month y year' });
  const now = Object.fromEntries(formatter.formatToParts(new Date()).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
  const parse = (value, fallback) => value === undefined ? fallback : typeof value === 'string' && /^\d{1,4}$/.test(value) ? Number(value) : NaN;
  const month = parse(req.query.month, now.month), year = parse(req.query.year, now.year);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) return res.status(400).json({ message: 'Indicá mes de 1 a 12 y año de 2000 a 2100' });
  const start = monthStart(year, month), end = monthStart(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);
  try {
    const result = await db.transaction(async (transaction) => {
      const options = { replacements: { start: start.toISOString().replace('T', ' ').replace('Z', ' +00:00'), end: end.toISOString().replace('T', ' ').replace('Z', ' +00:00') }, type: QueryTypes.SELECT, transaction };
      const [totals] = await db.query(`SELECT COUNT(*) AS totalOrders,
        COALESCE(SUM(CASE WHEN lower(estado) IN ('pagado','enviado','entregado') AND EXISTS (SELECT 1 FROM Pagos WHERE Pagos.pedidoId = Pedidos.id AND Pagos.estado = 'Aprobado') THEN total ELSE 0 END),0) AS totalSales,
        COALESCE(SUM(CASE WHEN lower(estado) IN ('pagado','enviado','entregado') AND EXISTS (SELECT 1 FROM Pagos WHERE Pagos.pedidoId = Pedidos.id AND Pagos.estado = 'Aprobado') THEN 1 ELSE 0 END),0) AS paidOrders
        FROM Pedidos WHERE createdAt >= :start AND createdAt < :end`, options);
      const states = await db.query('SELECT estado, COUNT(*) AS count FROM Pedidos WHERE createdAt >= :start AND createdAt < :end GROUP BY estado', options);
      const [stock] = await db.query('SELECT COALESCE(SUM(CASE WHEN stock BETWEEN 1 AND 5 THEN 1 ELSE 0 END),0) AS lowStock, COALESCE(SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END),0) AS outOfStock FROM Productos', { type: QueryTypes.SELECT, transaction });
      const byStatus = { Pendiente: 0, Pagado: 0, Enviado: 0, Entregado: 0, Cancelado: 0 };
      for (const state of states) {
        const key = Object.keys(byStatus).find((s) => s.toLowerCase() === state.estado.toLowerCase()) || state.estado;
        Object.defineProperty(byStatus, key, { value: (Object.hasOwn(byStatus, key) ? byStatus[key] : 0) + Number(state.count), writable: true, enumerable: true, configurable: true });
      }
      const totalSales = Math.round(Number(totals.totalSales) * 100) / 100;
      return { totalOrders: Number(totals.totalOrders), paidOrders: Number(totals.paidOrders), totalSales, averageTicket: totals.paidOrders ? Math.round(totalSales / Number(totals.paidOrders) * 100) / 100 : 0, byStatus, lowStock: Number(stock.lowStock), outOfStock: Number(stock.outOfStock) };
    });
    res.json({ ...result, lowStockThreshold: 5, period: { month, year, timeZone: zone, start: start.toISOString(), endExclusive: end.toISOString(), dateField: 'createdAt' } });
  } catch { res.status(500).json({ message: 'No se pudieron calcular las métricas' }); }
};
