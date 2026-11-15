const express = require("express");
const router = express.Router();

const productosController = require("../controllers/productosController");
const { authenticateToken, isAdmin } = require("../middlewares/authMiddleware");

// Rutas públicas
router.get('/inventario', authenticateToken, isAdmin, (req, res) => {
  req.inventoryAdmin = true;
  return productosController.getAll(req, res);
});
router.get("/", productosController.getAll);
router.get("/:id", productosController.getById);

// Rutas protegidas: solo administradores autenticados
router.post("/", authenticateToken, isAdmin, productosController.create);
router.put("/:id", authenticateToken, isAdmin, productosController.update);
router.delete("/:id", authenticateToken, isAdmin, productosController.delete);

module.exports = router;
