const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const accountController = require('../controllers/accountController');
const accountRateLimit = require('../middlewares/accountRateLimit');
const { authenticateToken, isAdmin } = require("../middlewares/authMiddleware");

router.post("/login", authController.login);
router.post("/register", authController.register);
router.get("/profile", authenticateToken, authController.profile);
router.put('/profile', authenticateToken, accountController.updateProfile);
router.put('/password', authenticateToken, accountRateLimit, accountController.changePassword);
router.post('/forgot-password', accountRateLimit, accountController.forgotPassword);
router.post('/reset-password', accountRateLimit, accountController.resetPassword);
router.delete('/account', authenticateToken, accountRateLimit, accountController.deleteAccount);
router.get("/admin-session", authenticateToken, isAdmin, (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            name: req.user.name,
            apellido: req.user.apellido,
            role: req.user.role
        }
    });
});

module.exports = router;
