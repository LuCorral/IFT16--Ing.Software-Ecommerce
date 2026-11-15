const Ticket = require('../models/Ticket');
const Detalle = require('../models/DetallePedido');
module.exports = async function createReceipt(pedido, user, metodo, transaction) {
  const detalles = await Detalle.findAll({ where: { pedidoId: pedido.id }, transaction });
  return Ticket.create({
    id_pedido: pedido.id, fecha_emision: new Date(), tipo_factura: 'Comprobante no fiscal', total: pedido.total, CAE: null,
    subtotal: pedido.subtotal, descuento: pedido.descuento, cuponCodigo: pedido.cuponCodigo,
    cliente: [user.name, user.apellido, user.email].filter(Boolean).join(' '),
    detalles: JSON.stringify(detalles.map((d) => ({ nombreProducto: d.nombreProducto, cantidad: d.cantidad, precioUnitario: d.precioUnitario, subtotal: d.subtotal }))),
    metodo_pago: metodo, estado_pago: 'Aprobado',
  }, { transaction });
};
