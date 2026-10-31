const User = require('../models/User');
const {
  getPaginationParams,
  buildPaginatedResponse,
} = require('../utils/pagination');

const usuariosController = {
  getAll: async (req, res) => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query, 10);

      const { count, rows: usuarios } = await User.findAndCountAll({
        attributes: {
          exclude: ['password', 'carrito', 'sessionVersion', 'resetTokenHash', 'resetTokenExpires'],
        },
        order: [['id', 'ASC']],
        limit,
        offset,
      });

      res.json(buildPaginatedResponse(count, page, limit, usuarios));
    } catch (error) {
      console.error('Error al obtener usuarios:', error);

      res.status(500).json({
        success: false,
        message: 'Error al obtener usuarios',
        detalle: error.message,
      });
    }
  },
  getById: async (req, res) => {
    try {
      const usuario = await User.findByPk(req.params.id, {
        attributes: {
          exclude: ['password', 'carrito', 'sessionVersion', 'resetTokenHash', 'resetTokenExpires'],
        },
      });

      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
        });
      }

      res.json(usuario);
    } catch (error) {
      console.error('Error al obtener usuario:', error);

      res.status(500).json({
        success: false,
        message: 'Error al obtener usuario',
        detalle: error.message,
      });
    }
  },
  create: async (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Nombre, email y contraseña son obligatorios',
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña debe tener al menos 6 caracteres',
        });
      }

      const roleValido = role || 'client';

      if (!['admin', 'client'].includes(roleValido)) {
        return res.status(400).json({
          success: false,
          message: 'El rol debe ser admin o client',
        });
      }

      const usuarioExistente = await User.findOne({
        where: { email },
      });

      if (usuarioExistente) {
        return res.status(400).json({
          success: false,
          message: 'El correo electrónico ya está registrado',
        });
      }

      const usuario = await User.create({
        name,
        email,
        password,
        role: roleValido,
      });

      res.status(201).json({
        success: true,
        message: 'Usuario creado correctamente',
        usuario: {
          id: usuario.id,
          name: usuario.name,
          email: usuario.email,
          role: usuario.role,
        },
      });
    } catch (error) {
      console.error('Error al crear usuario:', error);

      res.status(500).json({
        success: false,
        message: 'Error al crear usuario',
        detalle: error.message,
      });
    }
  },
  update: async (req, res) => {
    try {
      const usuario = await User.findByPk(req.params.id);

      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
        });
      }

      const { name, email, role } = req.body;

      if (!name || !email || !role) {
        return res.status(400).json({
          success: false,
          message: 'Nombre, email y rol son obligatorios',
        });
      }

      if (!['admin', 'client'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'El rol debe ser admin o client',
        });
      }

      const usuarioConMismoEmail = await User.findOne({
        where: { email },
      });

      if (usuarioConMismoEmail && usuarioConMismoEmail.id !== usuario.id) {
        return res.status(400).json({
          success: false,
          message: 'El correo electrónico ya está registrado',
        });
      }

      await usuario.update({
        name,
        email,
        role,
      });

      const usuarioActualizado = await User.findByPk(usuario.id, {
        attributes: {
          exclude: ['password', 'carrito', 'sessionVersion', 'resetTokenHash', 'resetTokenExpires'],
        },
      });

      res.json({
        success: true,
        message: 'Usuario actualizado correctamente',
        usuario: usuarioActualizado,
      });
    } catch (error) {
      console.error('Error al actualizar usuario:', error);

      res.status(500).json({
        success: false,
        message: 'Error al actualizar usuario',
        detalle: error.message,
      });
    }
  },
  delete: async (req, res) => {
    try {
      const usuario = await User.findByPk(req.params.id);

      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
        });
      }

      if (usuario.id === req.user.id) {
        return res.status(400).json({
          success: false,
          message:
            'No podés eliminar tu propio usuario mientras estás conectado',
        });
      }

      await usuario.destroy();

      res.json({
        success: true,
        message: 'Usuario eliminado correctamente',
      });
    } catch (error) {
      console.error('Error al eliminar usuario:', error);

      res.status(500).json({
        success: false,
        message: 'Error al eliminar usuario',
        detalle: error.message,
      });
    }
  },
};

module.exports = usuariosController;
