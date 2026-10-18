const jwt = require("jsonwebtoken");
const { col, fn, where } = require("sequelize");
const User = require("../models/User");

const authController = {
    profile: async (req, res) => {
        try {
            const user = await User.findByPk(req.user.id, {
                attributes: ["id", "name", "apellido", "email"]
            });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "Usuario no encontrado"
                });
            }

            res.json({
                success: true,
                user: {
                    id: user.id,
                    name: user.name,
                    apellido: user.apellido,
                    email: user.email
                }
            });
        } catch (error) {
            console.error("Error al consultar el perfil:", error);
            res.status(500).json({
                success: false,
                message: "Error al consultar el perfil"
            });
        }
    },

    login: async (req, res) => {
        try {
            const { email, password } = req.body;

            const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
            if (!normalizedEmail || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Email y password son obligatorios"
                });
            }

            const user = await User.findOne({
                where: where(fn("lower", col("email")), normalizedEmail)
            });

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "Credenciales inválidas"
                });
            }

            const passwordOk = await user.comparePassword(password);

            if (!passwordOk) {
                return res.status(401).json({
                    success: false,
                    message: "Credenciales inválidas"
                });
            }

            const payload = {
                id: user.id,
                name: user.name,
                apellido: user.apellido,
                email: user.email,
                role: user.role
            };

            const token = jwt.sign(payload, process.env.JWT_SECRET, {
                expiresIn: "2h"
            });

            res.json({
                success: true,
                message: "Login exitoso",
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    apellido: user.apellido,
                    email: user.email,
                    telefono: user.telefono,
                    role: user.role
                }
            });

        } catch (error) {
            console.error("Error en login:", error);

            res.status(500).json({
                success: false,
                message: "Error interno al iniciar sesión",
                detalle: error.message
            });
        }
    },

    register: async (req, res) => {
        try {
            const { name, apellido, email, password, telefono } = req.body || {};
            const normalizedName = typeof name === "string" ? name.trim() : "";
            const normalizedApellido = typeof apellido === "string" ? apellido.trim() : "";
            const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

            if (!normalizedName || !normalizedApellido || !normalizedEmail || typeof password !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Nombre, apellido, email y contraseña son obligatorios"
                });
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
                return res.status(400).json({ success: false, message: "Ingresá un email válido" });
            }

            if (password.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: "La contraseña debe tener al menos 8 caracteres"
                });
            }

            if (telefono && !/^[0-9]+$/.test(String(telefono))) {
                return res.status(400).json({ success: false, message: "El teléfono debe contener solo números" });
            }

            const existeUsuario = await User.findOne({
                where: where(fn("lower", col("email")), normalizedEmail)
            });
            if (existeUsuario) {
                return res.status(409).json({ success: false, message: "El correo electrónico ya está registrado" });
            }

            const usuario = await User.create({
                name: normalizedName,
                apellido: normalizedApellido,
                email: normalizedEmail,
                password,
                telefono: telefono ? String(telefono).trim() : null,
                role: "client"
            });

            res.status(201).json({
                success: true,
                message: "Usuario registrado con éxito. Ya podés iniciar sesión.",
                user: {
                    id: usuario.id,
                    name: usuario.name,
                    apellido: usuario.apellido,
                    email: usuario.email,
                    role: usuario.role
                }
            });

        } catch (error) {
            if (error.name === "SequelizeUniqueConstraintError") {
                return res.status(409).json({
                    success: false,
                    message: "El correo electrónico ya está registrado"
                });
            }

            console.error("Error en registro:", error);
            res.status(500).json({ success: false, message: "Error al registrar el usuario" });
        }
    }
};

module.exports = authController;
