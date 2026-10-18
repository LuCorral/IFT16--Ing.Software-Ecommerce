const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticateToken, isAdmin } = require("../middlewares/authMiddleware");

router.post("/login", authController.login);
router.post("/register", authController.register);
router.get("/profile", authenticateToken, authController.profile);
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