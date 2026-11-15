const { randomUUID } = require('node:crypto');
const { Op } = require('sequelize');
const nodemailer = require('nodemailer');
const NotificacionCorreo = require('../models/NotificacionCorreo');
const Detalle = require('../models/DetallePedido');
const mail = require('./accountMail');

const ESTADOS_NOTIFICABLES = ['pagado', 'enviado', 'entregado', 'cancelado'];
const normalizarEstado = (estado) => String(estado || '').trim().toLowerCase();
const money = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value || 0));
const subjects = { pendiente: 'Recibimos tu pedido', pagado: 'Pago confirmado', enviado: 'Tu pedido está en camino', entregado: 'Pedido entregado', cancelado: 'Pedido cancelado' };
function construirMensaje(estado, pedido, detalles = [], tipo = 'estado') {
  const state = normalizarEstado(estado);
  if (!subjects[state]) return null;
  const lines = [`Pedido #${pedido.id}`, `Estado: ${estado}`];
  if (['pendiente', 'pagado'].includes(state)) {
    lines.push(`Fecha: ${pedido.fecha || new Date(pedido.createdAt || Date.now()).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`);
    for (const detail of detalles) lines.push(`${detail.nombreProducto} x ${detail.cantidad} — ${money(detail.subtotal)}`);
    lines.push(`Total: ${money(pedido.total)}`, `Crédito corporativo aplicado: ${money(Number(pedido.creditUsedCents || 0) / 100)}`);
  }
  if (state === 'pagado') lines.push('Demostración académica: aprobación de pago simulado, sin acreditación bancaria real. El crédito corporativo sí se registra en el saldo de esta aplicación.');
  return { asunto: `${tipo === 'recepcion' ? 'Recibimos tu pedido' : subjects[state]} #${pedido.id}`, cuerpo: lines.join('\n') };
}

// Persist the event atomically, but never contact SMTP before a successful commit.
async function crearNotificacion({ pedido, estado, destinatario, transaction, tipo = 'estado' }) {
  if (!destinatario) return null;
  const detalles = await Detalle.findAll({ where: { pedidoId: pedido.id }, transaction });
  const mensaje = construirMensaje(estado, pedido, detalles, tipo);
  if (!mensaje) return null;
  const registro = await NotificacionCorreo.create({ pedido_id: pedido.id, destinatario, ...mensaje, estado_pedido: estado, fecha: new Date(), eventKey: randomUUID(), deliveryStatus: 'en_cola' }, { transaction });
  if (transaction) transaction.afterCommit(() => deliver(registro.id));
  else await deliver(registro.id);
  return registro.toJSON();
}

async function deliver(id) {
  let claimed = false;
  try {
    const [updated] = await NotificacionCorreo.update({ deliveryStatus: 'enviando', attempts: require('../config/database').literal('attempts + 1'), lastError: null }, { where: { id, deliveryStatus: { [Op.in]: ['en_cola', 'fallo'] } } });
    if (!updated) return;
    claimed = true;
    const record = await NotificacionCorreo.findByPk(id);
    if (!record) return;
    const mode = process.env.ORDER_MAIL_MODE || 'demo';
    if (!['demo', 'real'].includes(mode) || !process.env.SMTP_HOST || !process.env.SMTP_FROM || (mode === 'demo' && process.env.SMTP_HOST !== 'smtp.ethereal.email')) throw Object.assign(new Error('Configuración SMTP de pedidos incompleta o incompatible con modo demo'), { code: 'ECONFIG' });
    const recipient = process.env.ORDER_MAIL_TO || record.destinatario;
    const transport = mail.createTransport();
    const result = await transport.sendMail({ from: process.env.SMTP_FROM, to: recipient, subject: record.asunto,
      text: `${mode === 'demo' ? 'Demostración académica mediante Ethereal: no se entrega correo real.\n\n' : ''}${record.cuerpo}`,
      messageId: `<${record.eventKey}@ecommerce.local>`,
    });
    if (!result.accepted?.length) throw Object.assign(new Error('SMTP no aceptó destinatarios'), { code: 'EENVELOPE' });
    const preview = mode === 'demo' ? nodemailer.getTestMessageUrl(result) : null;
    await NotificacionCorreo.update({ deliveryStatus: mode === 'demo' ? 'demo' : 'enviado', sentAt: new Date(), previewUrl: preview || null, lastError: null }, { where: { id, deliveryStatus: 'enviando' } });
  } catch (error) {
    if (!claimed) { console.error('No se pudo procesar la cola de correo', { notificationId: id }); return; }
    const definite = ['ECONFIG', 'EAUTH', 'EENVELOPE', 'EDNS'].includes(error.code) || Number(error.responseCode) >= 400;
    try { await NotificacionCorreo.update({ deliveryStatus: definite ? 'fallo' : 'incierto', lastError: definite ? `Entrega rechazada (${error.code || error.responseCode})` : 'Resultado SMTP incierto; revisar antes de reenviar' }, { where: { id, deliveryStatus: 'enviando' } }); }
    catch { console.error('No se pudo registrar el fallo de correo', { notificationId: id }); }
    console.error('Entrega de correo pendiente de revisión', { notificationId: id, code: error.code || 'SMTP' });
  }
}
module.exports = { crearNotificacion, construirMensaje, ESTADOS_NOTIFICABLES, normalizarEstado, money, deliver };
