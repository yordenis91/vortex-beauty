import React from 'react';
import { Link } from 'react-router-dom';
import { useClients, useProjects, useInvoices } from '../hooks/useQueries';
import {
  Users,
  FolderOpen,
  FileText,
  DollarSign,
  Calendar,
  Package,
  Zap,
  BookOpen,
  ArrowRight
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices();

  // Calculate stats
  const totalRevenue = invoices
    .filter(inv => inv.status === 'PAID')
    .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);

  const stats = {
    clients: clients.length,
    projects: projects.length,
    invoices: invoices.length,
    totalRevenue,
  };

  const recentInvoices = invoices.slice(0, 5);

  const loading = clientsLoading || projectsLoading || invoicesLoading;

  const statCards = [
    {
      name: 'Total Clients',
      value: stats.clients,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      name: 'Active Projects',
      value: stats.projects,
      icon: FolderOpen,
      color: 'bg-green-500',
    },
    {
      name: 'Total Invoices',
      value: stats.invoices,
      icon: FileText,
      color: 'bg-purple-500',
    },
    {
      name: 'Revenue',
      value: `$${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-yellow-500',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'OVERDUE':
        return 'bg-red-100 text-red-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Dashboard
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your business management system
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`p-3 rounded-md ${stat.color}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {stat.name}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stat.value}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Access */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Gestión Rápida
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Acceso directo a las funciones principales de tu plataforma SaaS
          </p>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Link
              to="/admin/products"
              className="relative block w-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white hover:from-blue-600 hover:to-blue-700 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <Package className="h-8 w-8 mb-2 opacity-90" />
                  <h3 className="text-lg font-semibold">Productos</h3>
                  <p className="text-blue-100 text-sm mt-1">
                    Gestiona tus productos y servicios SaaS
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
              </div>
            </Link>

            <Link
              to="/admin/subscriptions"
              className="relative block w-full bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white hover:from-green-600 hover:to-green-700 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <Zap className="h-8 w-8 mb-2 opacity-90" />
                  <h3 className="text-lg font-semibold">Suscripciones</h3>
                  <p className="text-green-100 text-sm mt-1">
                    Administra las suscripciones de clientes
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
              </div>
            </Link>

            <Link
              to="/admin/knowledge-base"
              className="relative block w-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white hover:from-purple-600 hover:to-purple-700 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <BookOpen className="h-8 w-8 mb-2 opacity-90" />
                  <h3 className="text-lg font-semibold">Knowledge Base</h3>
                  <p className="text-purple-100 text-sm mt-1">
                    Gestiona artículos de ayuda y soporte
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Recent Invoices
            </h3>
            <div className="flex items-center text-sm text-gray-500">
              <Calendar className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
              Last 5 invoices
            </div>
          </div>
        </div>
        <ul className="divide-y divide-gray-200">
          {recentInvoices.length === 0 ? (
            <li className="px-4 py-8 text-center text-gray-500">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new invoice.</p>
            </li>
          ) : (
            recentInvoices.map((invoice) => (
              <li key={invoice.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <FileText className="h-8 w-8 text-gray-400" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {invoice.invoiceNumber}
                      </div>
                      <div className="text-sm text-gray-500">
                        {invoice.client?.name} • {new Date(invoice.issueDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-sm font-medium text-gray-900">
                      ${Number(invoice.totalAmount).toLocaleString()}
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Quick Actions
          </h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Link
              to="/admin/clients"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Users className="mr-2 h-5 w-5" />
              Add Client
            </Link>
            <Link
              to="/admin/projects"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <FolderOpen className="mr-2 h-5 w-5" />
              New Project
            </Link>
            <Link
              to="/admin/invoices"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              <FileText className="mr-2 h-5 w-5" />
              Create Invoice
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;