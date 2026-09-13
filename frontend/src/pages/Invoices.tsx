import React, { useState } from 'react';
import { useInvoices, useClients, useProjects, useProducts, useCreateInvoice, useUpdateInvoice, useDeleteInvoice } from '../hooks/useQueries';
import type { Invoice, InvoiceItem } from '../types';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import InvoiceForm from '../components/InvoiceForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
        return <XCircle className="h-5 w-5 text-muted-foreground" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
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
        return 'bg-muted text-foreground';
      default:
        return 'bg-muted text-foreground';
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
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
            Facturas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
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
      <div className="bg-card shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-border rounded-md leading-5 bg-card placeholder:text-muted-foreground focus:outline-none focus:placeholder:text-muted-foreground focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Grid de Facturas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredInvoices.length === 0 ? (
          <div className="col-span-full bg-card rounded-xl shadow-sm border border-border px-4 py-12 text-center text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="mt-2 text-lg font-medium text-foreground">No hay facturas</h3>
            <p className="mt-1 text-sm text-muted-foreground">Comienza creando una nueva factura.</p>
            <div className="mt-6">
              <button
                onClick={() => {
                  setEditingInvoice(null);
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                Crear Factura
              </button>
            </div>
          </div>
        ) : (
          filteredInvoices.map((invoice) => (
            <div key={invoice.id} className="bg-card rounded-xl shadow-sm border border-border p-5 flex flex-col transition hover:shadow-md relative overflow-hidden">
              {/* Barra de color superior según estado */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${
                invoice.status === 'PAID' ? 'bg-green-500' : 
                invoice.status === 'OVERDUE' ? 'bg-red-500' : 
                invoice.status === 'CANCELLED' ? 'bg-gray-400' : 'bg-yellow-400'
              }`}></div>

              <div className="flex justify-between items-start mb-4 mt-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 p-2 bg-muted rounded-lg">
                    {getStatusIcon(invoice.status)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-foreground truncate">{invoice.invoiceNumber}</h3>
                    <p className="text-sm text-muted-foreground truncate">{invoice.client?.name}</p>
                  </div>
                </div>
                <div className="flex space-x-1 shrink-0 ml-2">
                  <button onClick={() => setSelectedInvoice(invoice)} className="p-2 text-muted-foreground hover:text-blue-600 rounded-full hover:bg-blue-50 transition" title="Ver detalles">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button onClick={() => openEditModal(invoice)} className="p-2 text-muted-foreground hover:text-blue-600 rounded-full hover:bg-blue-50 transition" title="Editar">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(invoice.id)} className="p-2 text-muted-foreground hover:text-red-600 rounded-full hover:bg-red-50 transition" title="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-3">
                {invoice.project && (
                  <div className="text-sm text-muted-foreground truncate bg-muted px-3 py-2 rounded-md">
                    <span className="font-medium text-foreground">Proyecto:</span> {invoice.project.name}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-4 flex-wrap">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                    Vence: {new Date(invoice.dueDate).toLocaleDateString()}
                  </div>
                  <div className="flex items-center text-lg font-bold text-foreground">
                    <DollarSign className="h-5 w-5 text-muted-foreground shrink-0" />
                    {Number(invoice.totalAmount).toLocaleString()}
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${getStatusColor(invoice.status)}`}>
                  {invoice.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Invoice Detail Modal */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => { if (!open) setSelectedInvoice(null); }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedInvoice && (
          <>
            <DialogHeader>
              <DialogTitle>
                Invoice {selectedInvoice.invoiceNumber}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-8">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-4 pb-3 border-b border-border">Client & Invoice Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Client Information</h5>
                    <p className="text-sm font-medium text-foreground">{selectedInvoice.client?.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedInvoice.client?.email}</p>
                    {selectedInvoice.client?.phone && (
                      <p className="text-sm text-muted-foreground">{selectedInvoice.client.phone}</p>
                    )}
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Invoice Details</h5>
                    <div className="space-y-2">
                      <p className="text-sm text-foreground">
                        <span className="font-medium text-foreground">Issue Date:</span> {new Date(selectedInvoice.issueDate).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-foreground">
                        <span className="font-medium text-foreground">Due Date:</span> {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-foreground">
                        <span className="font-medium text-foreground">Status:</span>{' '}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedInvoice.status)}`}>
                          {selectedInvoice.status}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-4 pb-3 border-b border-border">Line Items</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Qty
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Unit Price
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {selectedInvoice.items?.map((item: InvoiceItem, index: number) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {item.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-foreground">
                            {item.quantity}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-foreground">
                            ${Number(item.unitPrice).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-foreground">
                            ${(item.quantity * Number(item.unitPrice)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted">
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-sm font-semibold text-foreground text-right">
                          Total:
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-foreground text-right">
                          ${Number(selectedInvoice.totalAmount).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-4 pb-3 border-b border-border">Notes</h4>
                  <p className="text-sm text-foreground leading-relaxed">{selectedInvoice.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-6 border-t border-border">
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="px-6 py-2 text-foreground bg-muted rounded-lg hover:bg-muted transition font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </>
          )}
        </DialogContent>
      </Dialog>

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