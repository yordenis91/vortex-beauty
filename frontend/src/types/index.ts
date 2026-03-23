// User types
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// Client types
export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  taxId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  projects?: Project[];
  invoices?: Invoice[];
}

// Project types
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED';
  budget?: string;
  startDate?: string;
  endDate?: string;
  clientId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  invoices?: Invoice[];
}

// Invoice types
export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  invoiceId: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: 'DRAFT' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  subtotal: string;
  taxRate: string;
  totalAmount: string;
  notes?: string;
  userId: string;
  clientId: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  project?: Project;
  items?: InvoiceItem[];
}

// Auth types
export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// API types
export interface ApiError {
  error: string | string[];
}