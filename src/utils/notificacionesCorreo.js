const NotificacionCorreo = require('../models/NotificacionCorreo');

const ESTADOS_NOTIFICABLES = ['pagado', 'enviado', 'entregado'];

const normalizarEstado = (estado) => String(estado || '').trim().toLowerCase();

const money = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`;

const plantillas = {
  pendiente: (pedido) => ({
    asunto: `Recibimos tu pedido #${pedido.id}`,
    cuerpo: [
      'Hola,',
      '',
      `Registramos tu pedido #${pedido.id} por un total de ${money(pedido.total)}.`,
      'Estado actual: Pendiente. Te avisaremos cuando se acredite el pago.',
      '',
      'Este es un correo simulado: no se envía ningún email real.',
    ].join('\n'),
  }),
  pagado: (pedido) => ({
    asunto: `Pago confirmado del pedido #${pedido.id}`,
    cuerpo: [
      'Hola,',
      '',
      `Aprobamos el pago de tu pedido #${pedido.id} por ${money(pedido.total)}.`,
      'Ya estamos preparando el envío.',
      '',
      'Este es un correo simulado: no se envía ningún email real.',
    ].join('\n'),
  }),
  enviado: (pedido) => ({
    asunto: `Tu pedido #${pedido.id} está en camino`,
    cuerpo: [
      'Hola,',
      '',
      `El pedido #${pedido.id} ya salió de nuestro depósito.`,
      'Te contactaremos cuando esté disponible para entrega.',
      '',
      'Este es un correo simulado: no se envía ningún email real.',
    ].join('\n'),
  }),
  entregado: (pedido) => ({
    asunto: `Pedido #${pedido.id} entregado`,
    cuerpo: [
      'Hola,',
      '',
      `El pedido #${pedido.id} fue entregado. ¡Gracias por tu compra!`,
      'Podés consultar el comprobante desde "Mis pedidos".',
      '',
      'Este es un correo simulado: no se envía ningún email real.',
    ].join('\n'),
  }),
};

function construirMensaje(estado, pedido) {
  const generar = plantillas[normalizarEstado(estado)];
  return generar ? generar(pedido) : null;
}

/**
 * Persiste el correo simulado y devuelve el objeto `correo_simulado` para la respuesta JSON.
 * Devuelve null si el estado no tiene plantilla o no hay destinatario.
 */
async function crearNotificacion({ pedido, estado, destinatario, transaction }) {
  const mensaje = construirMensaje(estado, pedido);
  if (!mensaje || !destinatario) return null;

  const registro = await NotificacionCorreo.create(
    {
      pedido_id: pedido.id,
      destinatario,
      asunto: mensaje.asunto,
      cuerpo: mensaje.cuerpo,
      estado_pedido: estado,
      fecha: new Date(),
    },
    { transaction },
  );

  return {
    id: registro.id,
    pedido_id: registro.pedido_id,
    destinatario: registro.destinatario,
    asunto: registro.asunto,
    cuerpo: registro.cuerpo,
    estado_pedido: registro.estado_pedido,
    fecha: registro.fecha,
  };
}

module.exports = {
  crearNotificacion,
  construirMensaje,
  ESTADOS_NOTIFICABLES,
  normalizarEstado,
  money,
};
