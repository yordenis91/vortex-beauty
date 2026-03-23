"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const router = express_1.default.Router();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    name: zod_1.z.string().min(2),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = registerSchema.parse(req.body);
        const existingUser = await prismaClient_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await prismaClient_1.default.user.create({
            data: { email, password: hashedPassword, name },
            select: { id: true, email: true, name: true },
        });
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ user, token });
    }
    catch (error) { // Le decimos a TS que confíe en nosotros aquí temporalmente
        // Usamos el método interno de Zod para verificar o simplemente asumimos si tiene name
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: error.errors });
        }
        console.error(error);
        return res.status(500).json({ error: "Error interno del servidor" });
    }
});
// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const user = await prismaClient_1.default.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({
            user: { id: user.id, email: user.email, name: user.name },
            token,
        });
    }
    catch (error) { // Le decimos a TS que confíe en nosotros aquí temporalmente
        // Usamos el método interno de Zod para verificar o simplemente asumimos si tiene name
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: error.errors });
        }
        console.error(error);
        return res.status(500).json({ error: "Error interno del servidor" });
    }
});
exports.default = router;
