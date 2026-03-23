"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const prismaClient_1 = __importDefault(require("./prismaClient"));
exports.prisma = prismaClient_1.default;
const auth_1 = __importDefault(require("./routes/auth"));
const clients_1 = __importDefault(require("./routes/clients"));
const projects_1 = __importDefault(require("./routes/projects"));
const invoices_1 = __importDefault(require("./routes/invoices"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Ejemplo básico usando prisma
app.get('/api/clients', async (req, res) => {
    try {
        const clients = await prismaClient_1.default.client.findMany();
        res.json(clients);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los clientes' });
    }
});
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/clients', clients_1.default);
app.use('/api/projects', projects_1.default);
app.use('/api/invoices', invoices_1.default);
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
