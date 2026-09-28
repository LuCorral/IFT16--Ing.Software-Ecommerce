const Pedido = require('../models/Pedido');
const DetallePedido = require('../models/DetallePedido');
const Producto = require('../models/Producto');
const sequelize = require('../config/database');

const getOwnerTag = (user) => `demo-user:${user.id}:${user.email}`;
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
        let total = 0;
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
          total += subtotal;
          lineas.push({ producto, cantidad, subtotal });
        }

        const pedido = await Pedido.create({
          cliente: req.user?.id ? getOwnerTag(req.user) : 'Compra de demostración',
          fecha: new Date().toISOString().split('T')[0],
          estado: 'Pendiente',
          total,
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
        return pedido;
      });

      const detalles = await DetallePedido.findAll({ where: { pedidoId: pedidoCreado.id } });
      res.status(201).json({ mensaje: 'Pedido creado correctamente', pedido: pedidoCreado, detalles });
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

        const detalles = await DetallePedido.findAll({ where: { pedidoId: pedidoActual.id }, transaction });
        for (const detalle of detalles) {
          const producto = await Producto.findByPk(detalle.productoId, { transaction });
          if (producto) {
            await producto.update({ stock: producto.stock + detalle.cantidad }, { transaction });
          }
        }
        await pedidoActual.update({ estado: 'Cancelado' }, { transaction });
        return pedidoActual;
      });
      res.json({ mensaje: 'Pedido cancelado y stock restituido', pedido });
    } catch (error) {
      res.status(error.status || 500).json({ mensaje: error.status ? error.message : 'Error al cancelar el pedido', error: error.message });
    }
  },

  update: async (req, res) => {
    try {
      const pedido = await Pedido.findByPk(req.params.id);

      if (!pedido) {
        return res.status(404).json({ mensaje: 'Pedido no encontrado' });
      }

      if (String(req.body.estado || '').toLowerCase() === 'cancelado') {
        return res.status(400).json({ mensaje: 'Usá la acción explícita de cancelación para restituir el stock' });
      }

      await pedido.update({
        cliente: req.body.cliente || pedido.cliente,
        estado: req.body.estado || pedido.estado
      });

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