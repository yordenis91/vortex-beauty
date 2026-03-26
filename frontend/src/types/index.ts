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
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  subtotal: number;
  taxRate: number;
  totalAmount: number;
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

// ================= HostBilling Types =================

// Category types
export interface Category {
  id: string;
  name: string;
  description?: string;
  type: 'PRODUCT' | 'TICKET' | 'KNOWLEDGE_BASE';
  color?: string;
  icon?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    products: number;
    tickets: number;
    articles: number;
  };
}

// Product types
export interface Product {
  id: string;
  name: string;
  description?: string;
  type: 'SAAS' | 'WEB_DEVELOPMENT' | 'SUPPORT' | 'MAINTENANCE' | 'CUSTOM_DEVELOPMENT' | 'CONSULTING';
  price: number;
  currency: string;
  billingCycle: 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'YEARLY';
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  isPublic: boolean;
  stock?: number;
  categoryId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  subscriptions?: Subscription[];
  orderItems?: OrderItem[];
  _count?: {
    subscriptions: number;
    orderItems: number;
  };
}

// Subscription types
export interface Subscription {
  id: string;
  subscriptionNumber: string;
  status: 'ACTIVE' | 'PENDING' | 'CANCELLED' | 'EXPIRED' | 'SUSPENDED';
  startDate: string;
  endDate?: string;
  nextBilling?: string;
  cancelledAt?: string;
  autoRenew: boolean;
  notes?: string;
  productId: string;
  clientId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  client?: Client;
}

// Order types (for one-time purchases)
export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  invoiceId?: string;
  createdAt: string;
  product?: Product;
  invoice?: Invoice;
}

// Ticket types
export interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_CLIENT' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  categoryId: string;
  clientId?: string;
  assignedToId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  client?: Client;
  assignedTo?: User;
  user?: User;
  messages?: TicketMessage[];
  _count?: {
    messages: number;
  };
}

export interface TicketMessage {
  id: string;
  message: string;
  isInternal: boolean;
  ticketId: string;
  userId: string;
  createdAt: string;
  user?: User;
}

// Knowledge Base types
export interface KnowledgeBase {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  isPublic: boolean;
  categoryId: string;
  userId: string;
  views: number;
  helpful: number;
  notHelpful: number;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  user?: User;
}

// Request/Response types for new APIs
export interface CreateProductRequest {
  name: string;
  description?: string;
  type: Product['type'];
  price: number;
  currency?: string;
  billingCycle: Product['billingCycle'];
  categoryId: string;
  isPublic?: boolean;
  stock?: number;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  type: Category['type'];
  color?: string;
  icon?: string;
  order?: number;
}

export interface CreateSubscriptionRequest {
  productId: string;
  clientId: string;
  startDate?: string;
  notes?: string;
  autoRenew?: boolean;
}

export interface CreateTicketRequest {
  subject: string;
  description: string;
  categoryId: string;
  priority?: Ticket['priority'];
}

export interface CreateTicketMessageRequest {
  message: string;
  isInternal?: boolean;
}

export interface CreateKnowledgeBaseRequest {
  title: string;
  content: string;
  excerpt?: string;
  categoryId: string;
  isPublic?: boolean;
}

export interface VoteRequest {
  helpful: boolean;
}