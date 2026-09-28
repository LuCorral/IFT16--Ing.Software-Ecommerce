const express = require('express');
const router = express.Router();

const pedidoController = require('../controllers/pedidoController');
const { authenticateToken, isAdmin } = require('../middlewares/authMiddleware');

router.get('/', authenticateToken, pedidoController.getAll);
router.get('/:id', authenticateToken, pedidoController.getById);
router.post('/demo', pedidoController.create);
router.post('/', authenticateToken, pedidoController.create);
router.patch('/:id/cancelar', authenticateToken, pedidoController.cancel);
router.put('/:id', authenticateToken, isAdmin, pedidoController.update);
router.delete('/:id', authenticateToken, isAdmin, pedidoController.remove);

module.exports = router;