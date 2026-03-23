# Vortex - Business Management System

A modern, full-stack business management system built with React, Node.js, Prisma, and PostgreSQL.

## Features

- **Dashboard**: Overview with key metrics and recent activity
- **Client Management**: Create, read, update, and delete client information
- **Project Management**: Track projects with status, budget, and client relationships
- **Invoice Management**: Generate and manage invoices with detailed line items
- **Authentication**: Secure login and registration system
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS v4.2.2** for styling
- **React Router** for navigation
- **Axios** for API communication
- **Lucide React** for icons

### Backend
- **Node.js 20** with Express
- **TypeScript** for type safety
- **Prisma 7.5.0** with PostgreSQL adapter
- **PostgreSQL 15** database
- **JWT** for authentication
- **bcryptjs** for password hashing
- **Zod** for request validation

### Infrastructure
- **Docker & Docker Compose** for containerization
- **Health checks** for service monitoring

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- npm or yarn

### Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vortex
   ```

2. **Start the services**
   ```bash
   docker-compose up -d
   ```

3. **The application will be available at:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

### Development Setup

1. **Backend Setup**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Database Setup**
   ```bash
   # Make sure PostgreSQL is running via Docker
   docker-compose up -d db

   # Run migrations
   cd backend
   npx prisma migrate dev
   ```

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user

### Clients
- `GET /clients` - Get all clients
- `POST /clients` - Create a new client
- `PUT /clients/:id` - Update a client
- `DELETE /clients/:id` - Delete a client

### Projects
- `GET /projects` - Get all projects
- `POST /projects` - Create a new project
- `PUT /projects/:id` - Update a project
- `DELETE /projects/:id` - Delete a project

### Invoices
- `GET /invoices` - Get all invoices
- `POST /invoices` - Create a new invoice
- `PUT /invoices/:id` - Update an invoice
- `DELETE /invoices/:id` - Delete an invoice

## Database Schema

The application uses the following main entities:

- **User**: System users with authentication
- **Client**: Business clients with contact information
- **Project**: Projects associated with clients
- **Invoice**: Invoices with line items
- **InvoiceItem**: Individual items within invoices

## Testing

### API Testing
Run the automated API test suite:
```bash
cd backend
chmod +x scripts/api-matrix-test.sh
./scripts/api-matrix-test.sh
```

### Manual Testing
1. Register a new account or login
2. Create clients from the Clients page
3. Add projects linked to clients
4. Generate invoices with multiple line items
5. View dashboard statistics

## Project Structure

```
vortex/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server setup
│   │   ├── prismaClient.ts       # Prisma client configuration
│   │   ├── routes/               # API route handlers
│   │   └── middleware/           # Authentication middleware
│   ├── prisma/
│   │   └── schema.prisma         # Database schema
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   ├── pages/                # Page components
│   │   ├── contexts/             # React contexts
│   │   ├── lib/                  # Utilities and API client
│   │   └── types/                # TypeScript type definitions
│   ├── index.html
│   └── package.json
├── docker-compose.yml             # Docker services configuration
└── README.md
```

## Environment Variables

### Backend (.env)
```
DATABASE_URL="postgresql://user:password@localhost:5432/vortex"
JWT_SECRET="your-secret-key"
PORT=3000
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3000
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

This project is licensed under the MIT License.