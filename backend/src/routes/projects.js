"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const projectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    status: zod_1.z.enum(['PLANNING', 'ACTIVE', 'COMPLETED', 'ON_HOLD']).optional(),
    clientId: zod_1.z.string(),
});
// GET /api/projects - List all projects
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const projects = await prismaClient_1.default.project.findMany({
            where: { userId: req.userId },
            include: { client: true, invoices: true },
        });
        res.json(projects);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/projects - Create new project
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const data = projectSchema.parse(req.body);
        const project = await prismaClient_1.default.project.create({
            data: { ...data, userId: req.userId },
            include: { client: true },
        });
        res.status(201).json(project);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=projects.js.map