// server.js - Versión corregida
require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const { Op } = require("sequelize");

const sequelize = require("./src/config/database");
const Producto = require("./src/models/Producto");
const Cupon = require("./src/models/Cupon");

const productosRoutes = require("./src/routes/productosRoutes");
const categoriasRoutes = require("./src/routes/categoriasRoutes");
const cuponRoutes = require("./src/routes/cuponRoutes");
const authRoutes = require("./src/routes/authRoutes");
const clientesRoutes = require("./src/routes/clientesRoutes");
const usuariosRoutes = require("./src/routes/usuariosRoutes");
const pedidoRoutes = require("./src/routes/pedidoRoutes");
const detallePedidoRoutes = require("./src/routes/detallePedidoRoutes");
const ticketsRoutes = require("./src/routes/ticketsRoutes");
const { authenticateToken, isAdmin } = require("./src/middlewares/authMiddleware");

require("./src/models/User");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

app.get('/html/admin.html', (req, res) => res.redirect('/'));
app.get('/html/login.html', (req, res) => res.redirect('/'));
app.get('/html/contacto.html', (req, res) => res.redirect('/'));

// Servir solo assets públicos. No exponer .env, SQLite, package.json ni scripts internos.
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/html', express.static(path.join(__dirname, 'html')));

// Redirecciones para páginas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin.html', (req, res) => {
  res.redirect('/');
});

app.get('/productos.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'html', 'productos.html'));
});

app.get('/cart.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'html', 'cart.html'));
});

app.get('/login.html', (req, res) => {
  res.redirect('/');
});

app.get('/contacto.html', (req, res) => {
  res.redirect('/');
});

// API Routes
app.use("/api/productos", productosRoutes);
app.use("/api/categorias", categoriasRoutes);
app.use("/api/cupones", cuponRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/pedidos", pedidoRoutes);
app.use("/api/detalles-pedido", authenticateToken, isAdmin, detallePedidoRoutes);
app.use("/api/tickets", authenticateToken, isAdmin, ticketsRoutes);

// Checkout endpoint
app.post("/api/checkout", authenticateToken, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { carrito, total, cupon_aplicado } = req.body;

    if (!carrito || !Array.isArray(carrito) || carrito.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ mensaje: "El carrito está vacío" });
    }

    const today = new Date();
    let totalCalculado = 0;

    for (const item of carrito) {
      const idProducto = Number(item.id);
      const cantidadSolicitada = Number(item.quantity || 1);

      if (!Number.isInteger(idProducto) || idProducto <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          mensaje: "El carrito contiene un producto inválido"
        });
      }

      if (!Number.isInteger(cantidadSolicitada) || cantidadSolicitada <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          mensaje: `Cantidad inválida para ${item.name || "un producto"}`
        });
      }

      const producto = await Producto.findOne({
        where: {
          id: idProducto,
          [Op.and]: [
            {
              [Op.or]: [
                { validFrom: null },
                { validFrom: { [Op.lte]: today } },
              ],
            },
            {
              [Op.or]: [
                { validTo: null },
                { validTo: { [Op.gte]: today } },
              ],
            },
          ],
        },
        transaction,
      });

      if (!producto) {
        await transaction.rollback();
        return res.status(400).json({
          mensaje: `Producto ${item.name} no está vigente`
        });
      }

      if (producto.stock < cantidadSolicitada) {
        await transaction.rollback();
        return res.status(400).json({
          mensaje: `Stock insuficiente para ${producto.nombre}`
        });
      }

      totalCalculado += producto.precio * cantidadSolicitada;

      await producto.update(
        { stock: producto.stock - cantidadSolicitada },
        { transaction },
      );
    }

    let totalFinal = totalCalculado;
    let cuponAplicado = null;

    if (cupon_aplicado) {
      const codigoCupon = String(cupon_aplicado).trim().toUpperCase();
      const cupon = await Cupon.findOne({
        where: { codigo: codigoCupon },
        transaction,
      });

      if (!cupon || !cupon.esValido()) {
        await transaction.rollback();
        return res.status(400).json({
          mensaje: "El cupón aplicado no es válido"
        });
      }

      totalFinal = cupon.aplicarDescuento(totalCalculado);
      cupon.usos_actuales += 1;
      await cupon.save({ transaction });

      cuponAplicado = {
        codigo: cupon.codigo,
        descuento: cupon.descuento,
      };
    }

    await transaction.commit();

    res.json({
      mensaje: "Compra realizada con éxito",
      total: totalFinal,
      total_original: totalCalculado,
      total_cliente: total,
      cupon_aplicado: cuponAplicado,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error en checkout:", error);
    res.status(500).json({ mensaje: "Error interno" });
  }
});

// Iniciar servidor
sequelize.sync({ alter: true })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Servidor en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Error:", error);
  });
