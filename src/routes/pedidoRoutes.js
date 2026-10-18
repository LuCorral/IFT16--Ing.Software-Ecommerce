const express = require('express');
const router = express.Router();

const pedidoController = require('../controllers/pedidoController');
const { authenticateToken, isAdmin } = require('../middlewares/authMiddleware');

router.get('/', authenticateToken, pedidoController.getAll);
router.post('/:id/pagar', authenticateToken, pedidoController.pay);
router.get('/:id/comprobante', authenticateToken, pedidoController.getReceipt);
router.get('/:id', authenticateToken, pedidoController.getById);
router.post('/', authenticateToken, pedidoController.create);
router.patch('/:id/cancelar', authenticateToken, pedidoController.cancel);
router.put('/:id', authenticateToken, isAdmin, pedidoController.update);
router.delete('/:id', authenticateToken, isAdmin, pedidoController.remove);

module.exports = router;