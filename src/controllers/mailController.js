const Mail = require('../models/NotificacionCorreo');
const { deliver } = require('../utils/notificacionesCorreo');
const { getPaginationParams, buildPaginatedResponse } = require('../utils/pagination');
module.exports = {
  list: async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const { page } = getPaginationParams(req.query, 10);
      const { rows, count } = await Mail.findAndCountAll({ order: [['id', 'DESC']], limit: 10, offset: (page - 1) * 10 });
      res.json(buildPaginatedResponse(count, page, 10, rows));
    } catch { res.status(500).json({ message: 'No se pudo consultar la cola de correos' }); }
  },
  retry: async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ message: 'Notificación inválida' });
    try {
      const record = await Mail.findByPk(req.params.id);
      if (!record) return res.status(404).json({ message: 'Notificación no encontrada' });
      if (!['en_cola', 'fallo'].includes(record.deliveryStatus)) return res.status(409).json({ message: 'Solo se reintentan correos en cola o con fallo confirmado. Revisá manualmente resultados inciertos o en proceso.' });
      await deliver(record.id);
      res.json(await record.reload());
    } catch { res.status(500).json({ message: 'No se pudo recuperar la notificación' }); }
  },
};
