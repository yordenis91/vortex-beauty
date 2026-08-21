import React from 'react';
import { FileText, Calendar, DollarSign, Loader, Download } from 'lucide-react';
import { useMyInvoices } from '../hooks/useQueries';

const MyInvoices: React.FC = () => {
  const { data: invoices = [], isLoading, error } = useMyInvoices();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'OVERDUE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBarColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-500';
      case 'OVERDUE':
        return 'bg-red-500';
      case 'CANCELLED':
        return 'bg-gray-400';
      default:
        return 'bg-yellow-400';
    }
  };

  const totalPaid = invoices.reduce((sum, inv) => inv.status === 'PAID' ? sum + (inv.totalAmount || 0) : sum, 0);
  const totalPending = invoices.reduce((sum, inv) => inv.status === 'PENDING' ? sum + (inv.totalAmount || 0) : sum, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-gray-600">Cargando facturas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">Error al cargar las facturas. Por favor, intenta de nuevo.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mis Facturas</h1>
        <p className="mt-2 text-sm text-gray-600">Visualiza y descarga tus facturas</p>
      </div>

      {/* Invoices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center">
            <FileText className="h-10 w-10 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Facturas</p>
              <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center">
            <DollarSign className="h-10 w-10 text-green-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Pagado</p>
              <p className="text-2xl font-bold text-gray-900">${totalPaid.toLocaleString('es-ES', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center">
            <Calendar className="h-10 w-10 text-orange-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Pendiente</p>
              <p className="text-2xl font-bold text-gray-900">${totalPending.toLocaleString('es-ES', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {invoices.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-12 text-center text-gray-500">
            <FileText className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="mt-1 text-sm text-gray-500">No hay facturas disponibles</p>
          </div>
        ) : (
          invoices.map((invoice) => (
            <div key={invoice.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col transition hover:shadow-md relative overflow-hidden">
              {/* Barra de color superior según estado */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${getStatusBarColor(invoice.status)}`}></div>

              <div className="flex justify-between items-start mb-4 mt-2 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 p-2 bg-gray-50 rounded-lg">
                    <FileText className="h-5 w-5 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 truncate">{invoice.invoiceNumber}</h3>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${getStatusColor(invoice.status)}`}>
                  {invoice.status}
                </span>
              </div>

              <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center text-xs text-gray-500">
                    <Calendar className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                    Vence: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('es-ES') : '-'}
                  </div>
                  <div className="flex items-center text-lg font-bold text-gray-900">
                    <DollarSign className="h-5 w-5 text-gray-400 shrink-0" />
                    {(invoice.totalAmount || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <a href="#" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800">
                  <Download className="h-4 w-4" />
                  Descargar
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MyInvoices;
