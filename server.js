const path = require("node:path");
const fs = require("node:fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");

const sequelize = require("./src/config/database");
const { validateEnvironment } = require("./src/config/env");
const { initializeDatabase } = require("./src/config/migrations");
require("./src/models");

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

// Middleware
if (process.env.NODE_ENV !== "production") {
  app.use(cors());
}
app.use(express.json());

function getReleaseCommit() {
  const commitFile = path.join(__dirname, "DEPLOY_COMMIT");
  return fs.existsSync(commitFile)
    ? fs.readFileSync(commitFile, "utf8").trim()
    : "local";
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", commit: getReleaseCommit() });
});

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

async function startServer() {
  const { host, port } = validateEnvironment();
  await initializeDatabase(sequelize);

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      console.info(`Ecommerce listening on ${host}:${port} (commit ${getReleaseCommit()})`);
      resolve(server);
    });
    server.once("error", reject);
  });
}

if (require.main === module) {
  startServer().catch(async (error) => {
    console.error(`Ecommerce startup failed: ${error.message}`);
    await sequelize.close();
    process.exitCode = 1;
  });
}

module.exports = { app, startServer };
