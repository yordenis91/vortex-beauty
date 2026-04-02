"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const prismaClient_1 = __importDefault(require("./prismaClient"));
exports.prisma = prismaClient_1.default;
const auth_1 = __importDefault(require("./routes/auth"));
const clients_1 = __importDefault(require("./routes/clients"));
const projects_1 = __importDefault(require("./routes/projects"));
const invoices_1 = __importDefault(require("./routes/invoices"));
const products_1 = __importDefault(require("./routes/products"));
const categories_1 = __importDefault(require("./routes/categories"));
const subscriptions_1 = __importDefault(require("./routes/subscriptions"));
const tickets_1 = __importDefault(require("./routes/tickets"));
const knowledgeBase_1 = __importDefault(require("./routes/knowledgeBase"));
const appointments_1 = __importDefault(require("./routes/appointments"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const portal_1 = __importDefault(require("./routes/portal"));
const overrides_1 = __importDefault(require("./routes/overrides"));
const settings_1 = __importDefault(require("./routes/settings"));
const gallery_1 = __importDefault(require("./routes/gallery"));
const closedDates_1 = __importDefault(require("./routes/closedDates"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// 1. Configuramos CORS explícitamente para tu frontend
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:5173', // Para cuando desarrollas en tu PC
        'http://localhost:3002', // Para cuando desarrollas en tu PC
        'https://deploy-vortex-frontend.wgteoi.easypanel.host' // ¡Tu frontend en producción!
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// 2. Parseo de body
app.use(express_1.default.json({ limit: '50mb', strict: true }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/clients', clients_1.default);
app.use('/api/projects', projects_1.default);
app.use('/api/invoices', invoices_1.default);
app.use('/api/products', products_1.default);
app.use('/api/categories', categories_1.default);
app.use('/api/subscriptions', subscriptions_1.default);
app.use('/api/tickets', tickets_1.default);
app.use('/api/knowledge-base', knowledgeBase_1.default);
app.use('/api/appointments', appointments_1.default);
app.use('/api/notifications', notifications_1.default);
// Portal routes (for CLIENT users)
app.use('/api/portal', portal_1.default);
// Schedule overrides routes
app.use('/api/overrides', overrides_1.default);
// Settings routes
app.use('/api/settings', settings_1.default);
// Gallery routes
app.use('/api/gallery', gallery_1.default);
// Closed dates routes
app.use('/api/closed-dates', closedDates_1.default);
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
