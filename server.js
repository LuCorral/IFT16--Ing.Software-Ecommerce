// server.js - Versión corregida
require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");

const sequelize = require("./src/config/database");

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

app.get('/html/contacto.html', (req, res) => res.redirect('/'));

// Servir solo assets públicos. No exponer .env, SQLite, package.json ni scripts internos.
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/img', express.static(path.join(__dirname, 'img')));
app.get('/html/admin.html', (req, res) => res.redirect('/admin.html'));
app.use('/html', express.static(path.join(__dirname, 'html')));

// Redirecciones para páginas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'html', 'admin.html'));
});

app.get('/productos.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'html', 'productos.html'));
});

app.get('/cart.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'html', 'cart.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'html', 'login.html'));
});

app.get('/profile.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'html', 'profile.html'));
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
