const Producto = require("../models/Producto");
const { Op } = require("sequelize");
const {
  getPaginationParams,
  buildPaginatedResponse,
} = require("../utils/pagination");

function validateProductData(body, includeOptionalDefaults = false) {
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const categoria = typeof body.categoria === "string" ? body.categoria.trim() : "";
  const precio = body.precio === "" || body.precio === null ? NaN : Number(body.precio);
  const stock = body.stock === "" || body.stock === null ? NaN : Number(body.stock);

  if (!nombre || !categoria || !Number.isFinite(precio) || precio < 0 || !Number.isInteger(stock) || stock < 0) {
    return {
      error: "Ingresá nombre y categoría, un precio válido no negativo y un stock entero no negativo.",
    };
  }

  const data = { nombre, categoria, precio, stock };
  if (includeOptionalDefaults || body.descripcion !== undefined) {
    data.descripcion = String(body.descripcion ?? "").trim();
  }
  if (includeOptionalDefaults || body.image !== undefined) {
    data.image = String(body.image ?? "").trim() || null;
  }

  return { data };
}

const productosController = {
  getAll: async (req, res) => {
    try {
      const { categoria, nombre } = req.query;
      const sortBy = ['precio', 'nombre'].includes(req.query.sortBy)
        ? req.query.sortBy
        : 'id';
      const sortOrder = ['asc', 'desc'].includes(String(req.query.sortOrder).toLowerCase())
        ? String(req.query.sortOrder).toUpperCase()
        : 'ASC';
      const { page, limit, offset } = getPaginationParams(req.query, 6);
      const today = new Date();

      const whereCondition = {
        validFrom: { [Op.lte]: today },
        validTo: { [Op.gte]: today },
      };

      if (categoria && categoria.trim()) {
        whereCondition.categoria = categoria.trim();
      }

      if (nombre && nombre.trim()) {
        whereCondition.nombre = {
          [Op.like]: `%${nombre.trim()}%`,
        };
      }

      const { count, rows: productos } = await Producto.findAndCountAll({
        where: whereCondition,
        order: [[sortBy, sortOrder]],
        limit,
        offset,
      });

      const productosFormateados = productos.map((producto) => ({
        id: producto.id,
        name: producto.nombre,
        nombre: producto.nombre,
        price: producto.precio,
        precio: producto.precio,
        stock: producto.stock,
        categoria: producto.categoria,
        descripcion: producto.descripcion,
        image: producto.image,
        rating: producto.rating,
        reviews: producto.reviews,
        validFrom: producto.validFrom,
        validTo: producto.validTo,
      }));

      res.json(buildPaginatedResponse(count, page, limit, productosFormateados));
    } catch (error) {
      console.error("ERROR REAL EN getAll PRODUCTOS:", error);
      res.status(500).json({
        error: "Error al consultar la base de datos",
        detalle: error.message,
      });
    }
  },

  getById: async (req, res) => {
  try {
    const today = new Date();

    const producto = await Producto.findByPk(req.params.id);

    if (!producto) {
      return res.status(404).json({
        error: "Producto no encontrado o no vigente",
      });
    }

    res.json({
      id: producto.id,
      name: producto.nombre,
      nombre: producto.nombre,
      price: producto.precio,
      precio: producto.precio,
      stock: producto.stock,
      categoria: producto.categoria,
      descripcion: producto.descripcion,
      image: producto.image,
      rating: producto.rating,
      reviews: producto.reviews,
      validFrom: producto.validFrom,
      validTo: producto.validTo,
    });
  } catch (error) {
    console.error("ERROR REAL EN getById PRODUCTOS:", error);
    res.status(500).json({
      error: "Error en el servidor",
      detalle: error.message,
    });
  }
},

  create: async (req, res) => {
    try {
      const validated = validateProductData(req.body, true);
      if (validated.error) {
        return res.status(400).json({ error: validated.error });
      }

      const categoryExists = await Producto.findOne({
        where: { categoria: validated.data.categoria },
      });
      if (!categoryExists) {
        return res.status(400).json({ error: "Seleccioná una categoría existente." });
      }

      const nuevoProducto = await Producto.create(validated.data);

      res.status(201).json({
        mensaje: "Producto creado con éxito",
        producto: nuevoProducto,
      });
    } catch (error) {
      console.error("ERROR REAL AL CREAR PRODUCTO:", error);

      res.status(400).json({
        error: "Datos inválidos o incompletos",
        detalle: error.message,
      });
    }
  },

  update: async (req, res) => {
    try {
      const validated = validateProductData(req.body);
      if (validated.error) {
        return res.status(400).json({ error: validated.error });
      }

      const producto = await Producto.findByPk(req.params.id);
      if (!producto) {
        return res.status(404).json({
          error: "No se encontró el producto a actualizar",
        });
      }

      const categoryExists = await Producto.findOne({
        where: { categoria: validated.data.categoria },
      });
      if (!categoryExists) {
        return res.status(400).json({ error: "Seleccioná una categoría existente." });
      }

      const productoActualizado = await producto.update(validated.data);

      res.json({
        mensaje: "Producto actualizado correctamente",
        producto: productoActualizado,
      });
    } catch (error) {
      console.error("ERROR REAL AL ACTUALIZAR PRODUCTO:", error);
      res.status(500).json({
        error: "Error al actualizar",
        detalle: error.message,
      });
    }
  },

  delete: async (req, res) => {
    try {
      const borrados = await Producto.destroy({
        where: { id: req.params.id },
      });

      if (borrados === 0) {
        return res.status(404).json({
          error: "El producto no existe",
        });
      }

      res.json({
        mensaje: "Producto eliminado correctamente",
      });
    } catch (error) {
      console.error("ERROR REAL AL ELIMINAR PRODUCTO:", error);
      res.status(500).json({
        error: "Error al intentar eliminar",
        detalle: error.message,
      });
    }
  },
};

module.exports = productosController;
