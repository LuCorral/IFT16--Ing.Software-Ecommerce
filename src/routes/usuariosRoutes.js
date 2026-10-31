const express = require('express');
const router = express.Router();

const usuariosController = require('../controllers/usuariosController');
const corporateController = require('../controllers/corporateController');
const { authenticateToken, isAdmin } = require('../middlewares/authMiddleware');

router.get('/', authenticateToken, isAdmin, usuariosController.getAll);
router.put('/:id/corporativo', authenticateToken, isAdmin, corporateController.setEnabled);
router.post('/:id/credito-corporativo', authenticateToken, isAdmin, corporateController.assignCredit);
router.get('/:id/movimientos-corporativos', authenticateToken, isAdmin, corporateController.movements);

router.get('/:id', authenticateToken, isAdmin, usuariosController.getById);

router.post('/', authenticateToken, isAdmin, usuariosController.create);

router.put('/:id', authenticateToken, isAdmin, usuariosController.update);

router.delete('/:id', authenticateToken, isAdmin, usuariosController.delete);

module.exports = router;
