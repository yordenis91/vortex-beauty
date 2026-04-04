import React, { useState } from 'react';
import { useInvoices, useClients, useProjects, useProducts, useCreateInvoice, useUpdateInvoice, useDeleteInvoice } from '../hooks/useQueries';
import type { Invoice, InvoiceItem } from '../types';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import InvoiceForm from '../components/InvoiceForm';
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Search,
  Calendar,
  DollarSign,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle
} from 'lucide-react';

const Invoices: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  interface InvoiceFormData {
    invoiceNumber: string;
    clientId: string;
    projectId?: string;
    issueDate: string;
    dueDate: string;
    status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    notes?: string;
    items: Array<{ description: string; quantity: number; unitPrice: number }>;
  }

  const handleInvoiceSubmit = async (data: InvoiceFormData, editId?: string) => {
    try {
      const payload = {
        ...data,
        projectId: data.projectId ? data.projectId : undefined,
        items: data.items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      };

      if (editId) {
        await updateInvoice.mutateAsync({ id: editId, invoiceData: payload });
      } else {
        await createInvoice.mutateAsync(payload);
      }
      setShowCreateModal(false);
      setEditingInvoice(null);
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Error al guardar la factura. Por favor, inténtalo de nuevo.');
    }
  };

  // Use React Query hooks
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const createInvoice = useCreateInvoice({
    onSuccess: () => toast.success('Factura creada correctamente'),
  });
  const updateInvoice = useUpdateInvoice({
    onSuccess: () => toast.success('Factura actualizada correctamente'),
  });
  const deleteInvoice = useDeleteInvoice({
    onSuccess: () => toast.success('Factura eliminada correctamente'),
  });

  const loading = invoicesLoading || clientsLoading || projectsLoading || productsLoading;

  const filteredInvoices = invoices.filter(invoice =>
    invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.project?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      await deleteInvoice.mutateAsync(itemToDelete);
    } catch (error) {
      console.error('Error deleting record:', error);
    } finally {
      setItemToDelete(null);
    }
  };

  const cancelDelete = () => {
    setItemToDelete(null);
  };

  const openEditModal = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setShowCreateModal(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'PENDING':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'OVERDUE':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'CANCELLED':
        return <XCircle className="h-5 w-5 text-gray-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

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
            Facturas
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Crea y gestiona tus facturas
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button
            onClick={() => {
              setEditingInvoice(null);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Invoice
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {filteredInvoices.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new invoice.</p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Invoice
              </button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredInvoices.map((invoice) => (
              <li key={invoice.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {getStatusIcon(invoice.status)}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {invoice.invoiceNumber}
                      </div>
                      <div className="text-sm text-gray-500">
                        {invoice.client?.name}
                      </div>
                      {invoice.project && (
                        <div className="text-sm text-gray-500">
                          {invoice.project.name}
                        </div>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          Due: {new Date(invoice.dueDate).toLocaleDateString()}
                        </div>
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-1" />
                          ${Number(invoice.totalAmount).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="p-1 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => openEditModal(invoice)}
                        className="p-1 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(invoice.id)}
                        className="p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-gray-100"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 transition-opacity flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">
                Invoice {selectedInvoice.invoiceNumber}
              </h3>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-blue-100 hover:text-white transition"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="p-8 space-y-8">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-200">Client & Invoice Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Client Information</h5>
                    <p className="text-sm font-medium text-gray-900">{selectedInvoice.client?.name}</p>
                    <p className="text-sm text-gray-600">{selectedInvoice.client?.email}</p>
                    {selectedInvoice.client?.phone && (
                      <p className="text-sm text-gray-600">{selectedInvoice.client.phone}</p>
                    )}
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Invoice Details</h5>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium text-gray-900">Issue Date:</span> {new Date(selectedInvoice.issueDate).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium text-gray-900">Due Date:</span> {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium text-gray-900">Status:</span>{' '}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedInvoice.status)}`}>
                          {selectedInvoice.status}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-200">Line Items</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Qty
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Unit Price
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedInvoice.items?.map((item: InvoiceItem, index: number) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                            {item.quantity}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                            ${Number(item.unitPrice).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                            ${(item.quantity * Number(item.unitPrice)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                          Total:
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                          ${Number(selectedInvoice.totalAmount).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-200">Notes</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{selectedInvoice.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <InvoiceForm
        isOpen={showCreateModal || !!editingInvoice}
        onClose={() => {
          setShowCreateModal(false);
          setEditingInvoice(null);
        }}
        invoiceToEdit={editingInvoice}
        clients={clients}
        projects={projects}
        products={products}
        onSubmitInvoice={handleInvoiceSubmit}
      />

      <ConfirmModal
        isOpen={itemToDelete !== null}
        title="Eliminar Factura"
        message="¿Estás seguro de que quieres eliminar esta factura? Esta acción no se puede deshacer."
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

export default Invoices;