import React, { useState } from 'react';
import { useInvoices, useClients, useProjects, useCreateInvoice, useUpdateInvoice, useDeleteInvoice } from '../hooks/useQueries';
import type { Invoice, InvoiceItem } from '../types';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
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
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    invoiceNumber: string;
    clientId: string;
    projectId: string;
    issueDate: string;
    dueDate: string;
    status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    notes: string;
    items: InvoiceItem[];
  }>({
    invoiceNumber: '',
    clientId: '',
    projectId: '',
    issueDate: '',
    dueDate: '',
    status: 'PENDING',
    notes: '',
    items: [],
  });
  const [newItem, setNewItem] = useState({
    description: '',
    quantity: 1,
    unitPrice: 0,
  });

  // Use React Query hooks
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const createInvoice = useCreateInvoice({
    onSuccess: () => toast.success('Factura creada correctamente'),
  });
  const updateInvoice = useUpdateInvoice({
    onSuccess: () => toast.success('Factura actualizada correctamente'),
  });
  const deleteInvoice = useDeleteInvoice({
    onSuccess: () => toast.success('Factura eliminada correctamente'),
  });

  const loading = invoicesLoading || clientsLoading || projectsLoading;

  const filteredInvoices = invoices.filter(invoice =>
    invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.project?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      invoiceNumber: '',
      clientId: '',
      projectId: '',
      issueDate: '',
      dueDate: '',
      status: 'PENDING',
      notes: '',
      items: [],
    });
    setNewItem({
      description: '',
      quantity: 1,
      unitPrice: 0,
    });
  };

  const calculateTotal = (items: InvoiceItem[]) => {
    return items.reduce((total, item) => total + (item.quantity * Number(item.unitPrice)), 0);
  };

  const addItem = () => {
    if (!newItem.description || newItem.quantity <= 0 || newItem.unitPrice <= 0) return;

    const item: InvoiceItem = {
      id: Date.now().toString(), // Temporary ID for frontend
      description: newItem.description,
      quantity: newItem.quantity,
      unitPrice: newItem.unitPrice,
      total: newItem.quantity * newItem.unitPrice,
      invoiceId: '', // Will be set when invoice is saved
    };

    setFormData({
      ...formData,
      items: [...formData.items, item],
    });

    setNewItem({
      description: '',
      quantity: 1,
      unitPrice: 0,
    });
  };

  const removeItem = (index: number) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      items: updatedItems,
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar que haya al menos un item
    if (formData.items.length === 0) {
      alert('Please add at least one item to the invoice');
      return;
    }

    // Validar campos requeridos
    if (!formData.invoiceNumber || !formData.clientId || !formData.issueDate || !formData.dueDate) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const dataToSend: any = {
        invoiceNumber: formData.invoiceNumber,
        clientId: formData.clientId,
        projectId: formData.projectId || undefined,
        issueDate: formData.issueDate,
        dueDate: formData.dueDate,
        status: formData.status,
        notes: formData.notes,
        taxRate: 0, // Por defecto sin tax; backend calculará subtotal y totalAmount
        items: formData.items.map(item => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      };
      
      if (!dataToSend.projectId) {
        delete dataToSend.projectId;
      }
      
      console.log('Sending data:', dataToSend);
      await createInvoice.mutateAsync(dataToSend);
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Error creating invoice. Please try again.');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;

    // Validar que haya al menos un item
    if (formData.items.length === 0) {
      alert('Please add at least one item to the invoice');
      return;
    }

    // Validar campos requeridos
    if (!formData.invoiceNumber || !formData.clientId || !formData.issueDate || !formData.dueDate) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const dataToSend: any = {
        invoiceNumber: formData.invoiceNumber,
        clientId: formData.clientId,
        projectId: formData.projectId || undefined,
        issueDate: formData.issueDate,
        dueDate: formData.dueDate,
        status: formData.status,
        notes: formData.notes,
        taxRate: 0, // Por defecto sin tax; backend calculará subtotal y totalAmount
        items: formData.items.map(item => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      };
      
      if (!dataToSend.projectId) {
        delete dataToSend.projectId;
      }
      
      console.log('Sending update data:', dataToSend);
      await updateInvoice.mutateAsync({ id: editingInvoice.id, invoiceData: dataToSend });
      setEditingInvoice(null);
      resetForm();
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast.error('Error actualizando la factura. Por favor, inténtalo de nuevo.');
    }
  };

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
    setFormData({
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      projectId: invoice.projectId || '',
      issueDate: new Date(invoice.issueDate).toISOString().split('T')[0],
      dueDate: new Date(invoice.dueDate).toISOString().split('T')[0],
      status: invoice.status,
      notes: invoice.notes || '',
      items: invoice.items || [],
    });
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
            Invoices
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage your invoices
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button
            onClick={() => setShowCreateModal(true)}
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
        <div className="fixed inset-0 bg-black/50 transition-opacity overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Invoice {selectedInvoice.invoiceNumber}
                </h3>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Client Information</h4>
                  <p className="text-sm text-gray-600">{selectedInvoice.client?.name}</p>
                  <p className="text-sm text-gray-600">{selectedInvoice.client?.email}</p>
                  {selectedInvoice.client?.phone && (
                    <p className="text-sm text-gray-600">{selectedInvoice.client.phone}</p>
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Invoice Details</h4>
                  <p className="text-sm text-gray-600">
                    Issue Date: {new Date(selectedInvoice.issueDate).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Due Date: {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600">Status: {selectedInvoice.status}</p>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-4">Items</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Qty
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Unit Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.quantity}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ${Number(item.unitPrice).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ${(item.quantity * Number(item.unitPrice)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                          Total:
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ${Number(selectedInvoice.totalAmount).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm text-gray-600">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingInvoice) && (
        <div className="fixed inset-0 bg-black/50 transition-opacity overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white max-h-screen">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
              </h3>
              <form onSubmit={editingInvoice ? handleEdit : handleCreate} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Invoice Number *</label>
                    <input
                      type="text"
                      required
                      value={formData.invoiceNumber}
                      onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="PAID">Paid</option>
                      <option value="OVERDUE">Overdue</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Client *</label>
                    <select
                      required
                      value={formData.clientId}
                      onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Project</label>
                    <select
                      value={formData.projectId}
                      onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a project (optional)</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Issue Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.issueDate}
                      onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Due Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Invoice Items */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-4">Invoice Items</h4>

                  {/* Add Item Form */}
                  <div className="grid grid-cols-12 gap-2 mb-4 p-4 bg-gray-50 rounded-md">
                    <div className="col-span-5">
                      <input
                        type="text"
                        placeholder="Description"
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Unit Price"
                        value={newItem.unitPrice}
                        onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })}
                        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={addItem}
                        className="w-full inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Items List */}
                  {formData.items.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Description
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Qty
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Unit Price
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {formData.items.map((item, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.description}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {item.quantity}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                ${Number(item.unitPrice).toFixed(2)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                ${(item.quantity * Number(item.unitPrice)).toFixed(2)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <button
                                  type="button"
                                  onClick={() => removeItem(index)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={3} className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                              Total:
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              ${calculateTotal(formData.items).toFixed(2)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingInvoice(null);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    {editingInvoice ? 'Update' : 'Create'} Invoice
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
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