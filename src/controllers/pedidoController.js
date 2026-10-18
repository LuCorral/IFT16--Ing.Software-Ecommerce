const Pedido = require('../models/Pedido');
const DetallePedido = require('../models/DetallePedido');
const Producto = require('../models/Producto');
const Cupon = require('../models/Cupon');
const Pago = require('../models/Pago');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

const getOwnerTag = (user) => `demo-user:${user.id}:${user.email}`;
const roundMoney = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;
const canAccessOrder = (user, pedido) =>
  user.role === 'admin' || pedido.cliente === getOwnerTag(user);

const pedidoController = {
  getAll: async (req, res) => {
    try {
      const where = req.user.role === 'admin'
        ? {}
        : { cliente: getOwnerTag(req.user) };
      const pedidos = await Pedido.findAll({ where, order: [['id', 'DESC']] });
      const pedidosConDetalles = await Promise.all(pedidos.map(async (pedido) => ({
        ...pedido.toJSON(),
        detalles: await DetallePedido.findAll({ where: { pedidoId: pedido.id } }),
      })));
      res.json(pedidosConDetalles);
    } catch (error) {
      res.status(500).json({ mensaje: 'Error al consultar los pedidos', error: error.message });
    }
  },

  getById: async (req, res) => {
    try {
      const pedido = await Pedido.findByPk(req.params.id);

      if (!pedido) {
        return res.status(404).json({ mensaje: 'Pedido no encontrado' });
      }

      if (!canAccessOrder(req.user, pedido)) {
        return res.status(404).json({ mensaje: 'Pedido no encontrado' });
      }

      const detalles = await DetallePedido.findAll({
        where: { pedidoId: req.params.id }
      });

      res.json({
        ...pedido.toJSON(),
        detalles
      });
    } catch (error) {
      res.status(500).json({ mensaje: 'Error al consultar el pedido', error: error.message });
    }
  },

  create: async (req, res) => {
    try {
      if (!Array.isArray(req.body.productos) || req.body.productos.length === 0) {
        return res.status(400).json({ mensaje: 'El pedido debe incluir productos válidos' });
      }

      const couponCode = typeof req.body.cupon === 'string'
        ? req.body.cupon.trim().toUpperCase()
        : '';
      if (req.body.cupon !== undefined && typeof req.body.cupon !== 'string') {
        return res.status(400).json({ mensaje: 'El código del cupón debe ser texto' });
      }

      const cantidades = new Map();
      for (const item of req.body.productos) {
        const productoId = Number(item.productoId);
        const cantidad = Number(item.cantidad);
        if (!Number.isInteger(productoId) || productoId <= 0 || !Number.isInteger(cantidad) || cantidad <= 0) {
          return res.status(400).json({ mensaje: 'Cada producto debe tener id válido y cantidad entera mayor a 0' });
        }
        cantidades.set(productoId, (cantidades.get(productoId) || 0) + cantidad);
      }

      const pedidoCreado = await sequelize.transaction(async (transaction) => {
        const lineas = [];
        let subtotal = 0;
        for (const [productoId, cantidad] of cantidades) {
          const producto = await Producto.findByPk(productoId, { transaction });
          if (!producto) {
            const error = new Error(`Producto ${productoId} no encontrado`);
            error.status = 404;
            throw error;
          }
          if (producto.stock < cantidad) {
            const error = new Error(`Stock insuficiente para ${producto.nombre}`);
            error.status = 400;
            throw error;
          }
          const subtotal = producto.precio * cantidad;
          lineas.push({ producto, cantidad, subtotal });
        }

        subtotal = roundMoney(lineas.reduce((sum, linea) => sum + linea.subtotal, 0));
        let cupon = null;
        let descuento = 0;
        if (couponCode) {
          cupon = await Cupon.findOne({
            where: { codigo: couponCode },
            transaction,
          });
          if (!cupon || !cupon.esValido()) {
            const error = new Error('El cupón no existe, está vencido, inactivo o agotado');
            error.status = 400;
            throw error;
          }
          descuento = roundMoney(subtotal - cupon.aplicarDescuento(subtotal));
        }
        const total = roundMoney(subtotal - descuento);
        const pedido = await Pedido.create({
          cliente: getOwnerTag(req.user),
          fecha: new Date().toISOString().split('T')[0],
          estado: 'Pendiente',
          total,
          subtotal,
          descuento,
          cuponCodigo: cupon?.codigo || null,
        }, { transaction });

        for (const linea of lineas) {
          await DetallePedido.create({
            pedidoId: pedido.id,
            productoId: linea.producto.id,
            nombreProducto: linea.producto.nombre,
            cantidad: linea.cantidad,
            precioUnitario: linea.producto.precio,
            subtotal: linea.subtotal,
          }, { transaction });
          await linea.producto.update({ stock: linea.producto.stock - linea.cantidad }, { transaction });
        }

        if (cupon) {
          const [usageUpdated] = await Cupon.update(
            { usos_actuales: sequelize.literal('"usos_actuales" + 1') },
            {
              where: {
                id: cupon.id,
                activo: true,
                fecha_vencimiento: { [Op.gte]: new Date().toISOString().split('T')[0] },
                usos_actuales: { [Op.lt]: sequelize.col('limite_stock') },
              },
              transaction,
            },
          );
          if (!usageUpdated) {
            const error = new Error('El cupón ya no tiene usos disponibles');
            error.status = 400;
            throw error;
          }
        }

        return pedido;
      });

      const detalles = await DetallePedido.findAll({ where: { pedidoId: pedidoCreado.id } });
      res.status(201).json({
        mensaje: 'Pedido creado correctamente',
        pedido: pedidoCreado,
        detalles,
        subtotal: pedidoCreado.getDataValue('subtotal'),
        descuento: pedidoCreado.getDataValue('descuento'),
        cupon: pedidoCreado.cuponCodigo,
        total: pedidoCreado.total,
      });
    } catch (error) {
      res.status(error.status || 500).json({ mensaje: error.status ? error.message : 'Error al crear el pedido', error: error.message });
    }
  },

  cancel: async (req, res) => {
    try {
      const pedido = await sequelize.transaction(async (transaction) => {
        const pedidoActual = await Pedido.findByPk(req.params.id, { transaction });
        if (!pedidoActual) {
          const error = new Error('Pedido no encontrado');
          error.status = 404;
          throw error;
        }
        if (!canAccessOrder(req.user, pedidoActual)) {
          const error = new Error('Pedido no encontrado');
          error.status = 404;
          throw error;
        }
        if (String(pedidoActual.estado).toLowerCase() !== 'pendiente') {
          const error = new Error('Solo se pueden cancelar pedidos pendientes');
          error.status = 400;
          throw error;
        }

        const [actualizado] = await Pedido.update(
          { estado: 'Cancelado' },
          {
            where: {
              id: pedidoActual.id,
              estado: pedidoActual.estado,
            },
            transaction,
          },
        );
        if (!actualizado) {
          const error = new Error('Solo se pueden cancelar pedidos pendientes');
          error.status = 400;
          throw error;
        }

        const detalles = await DetallePedido.findAll({ where: { pedidoId: pedidoActual.id }, transaction });
        for (const detalle of detalles) {
          const producto = await Producto.findByPk(detalle.productoId, { transaction });
          if (!producto) {
            const error = new Error(`No se pudo restituir el stock del producto ${detalle.productoId}`);
            error.status = 409;
            throw error;
          }
          await producto.update({ stock: producto.stock + detalle.cantidad }, { transaction });
        }
        pedidoActual.estado = 'Cancelado';
        return pedidoActual;
      });
      res.json({ mensaje: 'Pedido cancelado y stock restituido', pedido });
    } catch (error) {
      res.status(error.status || 500).json({ mensaje: error.status ? error.message : 'Error al cancelar el pedido', error: error.message });
    }
  },

  pay: async (req, res) => {
    const { metodo, resultadoSimulado = 'aprobado' } = req.body || {};
    const metodosValidos = ['tarjeta', 'transferencia'];
    const resultadosValidos = ['aprobado', 'rechazado'];

    if (req.user.role !== 'client') {
      return res.status(403).json({ mensaje: 'Solo los clientes pueden pagar pedidos' });
    }
    if (!metodosValidos.includes(String(metodo).toLowerCase())) {
      return res.status(400).json({ mensaje: 'Elegí Tarjeta o Transferencia como método de pago' });
    }
    if (!resultadosValidos.includes(String(resultadoSimulado).toLowerCase())) {
      return res.status(400).json({ mensaje: 'Resultado simulado inválido' });
    }

    try {
      const result = await sequelize.transaction(async (transaction) => {
        const pedido = await Pedido.findByPk(req.params.id, { transaction });
        if (!pedido || !canAccessOrder(req.user, pedido)) {
          const error = new Error('Pedido no encontrado');
          error.status = 404;
          throw error;
        }
        if (pedido.estado !== 'Pendiente') {
          const error = new Error('Solo se pueden pagar pedidos pendientes');
          error.status = 400;
          throw error;
        }

        const aprobado = String(resultadoSimulado).toLowerCase() === 'aprobado';
        const estadoPago = aprobado ? 'Aprobado' : 'Rechazado';
        const metodoPago = String(metodo).toLowerCase() === 'tarjeta' ? 'Tarjeta' : 'Transferencia';
        const pago = await Pago.create({
          pedidoId: pedido.id,
          metodo: metodoPago,
          monto: pedido.total,
          estado: estadoPago,
          fecha: new Date(),
        }, { transaction });

        let comprobante = null;
        if (aprobado) {
          const [updated] = await Pedido.update(
            { estado: 'Pagado' },
            { where: { id: pedido.id, estado: 'Pendiente' }, transaction },
          );
          if (!updated) {
            const error = new Error('El pedido ya no está pendiente de pago');
            error.status = 400;
            throw error;
          }

          const user = await User.findByPk(req.user.id, { transaction });
          if (!user) {
            const error = new Error('No se encontró el cliente asociado a la sesión');
            error.status = 401;
            throw error;
          }
          const detalles = await DetallePedido.findAll({
            where: { pedidoId: pedido.id },
            transaction,
          });
          const receiptSubtotal = Number(pedido.subtotal) || roundMoney(
            detalles.reduce((sum, detalle) => sum + Number(detalle.subtotal), 0),
          );
          const receiptDiscount = Number(pedido.descuento) || roundMoney(
            Math.max(0, receiptSubtotal - Number(pedido.total)),
          );
          comprobante = await Ticket.create({
            id_pedido: pedido.id,
            fecha_emision: new Date(),
            tipo_factura: 'Comprobante no fiscal',
            total: pedido.total,
            CAE: null,
            subtotal: receiptSubtotal,
            descuento: receiptDiscount,
            cuponCodigo: pedido.cuponCodigo,
            cliente: [user.name, user.apellido, user.email].filter(Boolean).join(' '),
            detalles: JSON.stringify(detalles.map((detalle) => ({
              nombreProducto: detalle.nombreProducto,
              cantidad: detalle.cantidad,
              precioUnitario: detalle.precioUnitario,
              subtotal: detalle.subtotal,
            }))),
            metodo_pago: metodoPago,
            estado_pago: estadoPago,
          }, { transaction });
        }

        return { pago, comprobante, estadoPedido: aprobado ? 'Pagado' : 'Pendiente' };
      });

      res.status(200).json({
        mensaje: result.pago.estado === 'Aprobado' ? 'Pago aprobado' : 'Pago rechazado; el pedido continúa pendiente',
        pago: result.pago,
        estadoPedido: result.estadoPedido,
        comprobante: result.comprobante
          ? { id: result.comprobante.id, numero: `COMP-${String(result.comprobante.id).padStart(8, '0')}` }
          : null,
      });
    } catch (error) {
      res.status(error.status || 500).json({
        mensaje: error.status ? error.message : 'Error al procesar el pago simulado',
        error: error.message,
      });
    }
  },

  getReceipt: async (req, res) => {
    try {
      const pedido = await Pedido.findByPk(req.params.id);
      if (!pedido || !canAccessOrder(req.user, pedido)) {
        return res.status(404).json({ mensaje: 'Comprobante no encontrado' });
      }
      if (pedido.estado !== 'Pagado') {
        return res.status(404).json({ mensaje: 'El pedido todavía no tiene comprobante pagado' });
      }

      const comprobante = await Ticket.findOne({ where: { id_pedido: pedido.id } });
      if (!comprobante || comprobante.estado_pago !== 'Aprobado') {
        return res.status(404).json({ mensaje: 'Comprobante no encontrado' });
      }

      res.json({
        id: comprobante.id,
        numero: `COMP-${String(comprobante.id).padStart(8, '0')}`,
        pedidoId: pedido.id,
        fecha: comprobante.fecha_emision,
        cliente: comprobante.cliente,
        productos: JSON.parse(comprobante.detalles),
        subtotal: comprobante.subtotal,
        descuento: comprobante.descuento,
        cupon: comprobante.cuponCodigo,
        total: comprobante.total,
        metodoPago: comprobante.metodo_pago,
        estadoPago: comprobante.estado_pago,
      });
    } catch (error) {
      res.status(500).json({ mensaje: 'Error al consultar el comprobante', error: error.message });
    }
  },

  update: async (req, res) => {
    try {
      const pedido = await Pedido.findByPk(req.params.id);

      if (!pedido) {
        return res.status(404).json({ mensaje: 'Pedido no encontrado' });
      }

      const transiciones = {
        Pagado: 'Enviado',
        Enviado: 'Entregado',
      };
      const siguienteEstado = transiciones[pedido.estado];
      if (!siguienteEstado || req.body.estado !== siguienteEstado) {
        return res.status(400).json({
          mensaje: `Transición de estado no permitida desde ${pedido.estado}`,
        });
      }

      await pedido.update({ estado: siguienteEstado });

      res.json({
        mensaje: 'Pedido actualizado correctamente',
        pedido
      });
    } catch (error) {
      res.status(500).json({ mensaje: 'Error al actualizar el pedido', error: error.message });
    }
  },

  remove: async (req, res) => {
    try {
      const pedido = await Pedido.findByPk(req.params.id);

      if (!pedido) {
        return res.status(404).json({ mensaje: 'Pedido no encontrado' });
      }

      await DetallePedido.destroy({
        where: { pedidoId: req.params.id }
      });

      await pedido.destroy();

      res.json({ mensaje: 'Pedido eliminado correctamente' });
    } catch (error) {
      res.status(500).json({ mensaje: 'Error al eliminar el pedido', error: error.message });
    }
  }
};

module.exports = pedidoController;