import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Invoice, Product } from '../types';
import { Edit2, Copy, Trash2 } from 'lucide-react';
import ProductCategorySelect from './ProductCategorySelect';

const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price must be 0 or greater'),
});

const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  clientId: z.string().min(1, 'Client is required'),
  projectId: z.string().optional(),
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'Add at least one item'),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

interface InvoiceFormProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceToEdit?: Invoice | null;
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  products: Product[];
  onSubmitInvoice: (data: InvoiceFormValues, editId?: string) => Promise<void>;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({
  isOpen,
  onClose,
  invoiceToEdit,
  clients,
  projects,
  products,
  onSubmitInvoice,
}) => {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoiceNumber: '',
      clientId: '',
      projectId: '',
      issueDate: '',
      dueDate: '',
      status: 'PENDING',
      notes: '',
      items: [{ description: '', quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove, update, insert } = useFieldArray({
    control,
    name: 'items',
  });

  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = React.useState('');
  const [newItem, setNewItem] = React.useState({
    description: '',
    quantity: 1,
    unitPrice: 0,
  });
  const [newItemError, setNewItemError] = React.useState<string | null>(null);

  const addNewItem = () => {
    if (!newItem.description.trim()) {
      setNewItemError('Description is required');
      return;
    }
    if (newItem.quantity < 1) {
      setNewItemError('Quantity must be at least 1');
      return;
    }
    if (newItem.unitPrice < 0) {
      setNewItemError('Unit price must be 0 or greater');
      return;
    }

    const itemToSave = {
      description: newItem.description.trim(),
      quantity: newItem.quantity,
      unitPrice: newItem.unitPrice,
    };

    if (editingIndex !== null) {
      update(editingIndex, itemToSave);
      setEditingIndex(null);
    } else {
      append(itemToSave);
    }

    setNewItem({ description: '', quantity: 1, unitPrice: 0 });
    setSelectedProductId('');
    setNewItemError(null);
  };

  useEffect(() => {
    if (invoiceToEdit) {
      const formatDateForInput = (dateString: string): string => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
      };

      reset({
        invoiceNumber: invoiceToEdit.invoiceNumber || '',
        clientId: invoiceToEdit.clientId || '',
        projectId: invoiceToEdit.projectId || '',
        issueDate: formatDateForInput(invoiceToEdit.issueDate),
        dueDate: formatDateForInput(invoiceToEdit.dueDate),
        status: invoiceToEdit.status || 'PENDING',
        notes: invoiceToEdit.notes || '',
        items: invoiceToEdit.items?.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
        })) || [],
      });
    } else {
      reset({
        invoiceNumber: '',
        clientId: '',
        projectId: '',
        issueDate: '',
        dueDate: '',
        status: 'PENDING',
        notes: '',
        items: [],
      });
    }
  }, [invoiceToEdit, reset]);

  const submitHandler = async (data: InvoiceFormValues) => {
    await onSubmitInvoice(data, invoiceToEdit?.id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 transition-opacity flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-white">
            {invoiceToEdit ? 'Edit Invoice' : 'Create New Invoice'}
          </h3>
          <button
            onClick={onClose}
            className="text-blue-100 hover:text-white transition"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(submitHandler)} className="p-8 space-y-8">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-200">Invoice Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Number <span className="text-red-500">*</span></label>
                <input
                  {...register('invoiceNumber')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="INV-001"
                />
                {errors.invoiceNumber && (<span className="text-sm text-red-500 mt-1 block">{errors.invoiceNumber.message}</span>)}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  {...register('status')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                >
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-200">Client & Project</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client <span className="text-red-500">*</span></label>
                <select
                  {...register('clientId')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
                {errors.clientId && (<span className="text-sm text-red-500 mt-1 block">{errors.clientId.message}</span>)}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
                <select
                  {...register('projectId')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                >
                  <option value="">Select a project (optional)</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-200">Dates</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Issue Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  {...register('issueDate')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
                {errors.issueDate && (<span className="text-sm text-red-500 mt-1 block">{errors.issueDate.message}</span>)}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  {...register('dueDate')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
                {errors.dueDate && (<span className="text-sm text-red-500 mt-1 block">{errors.dueDate.message}</span>)}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-200">Invoice Items</h4>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar producto existente o escribir manualmente</label>
              <ProductCategorySelect
                value={selectedProductId}
                onChange={(id) => {
                  setSelectedProductId(id);
                  if (id) {
                    const product = products.find((p) => p.id === id);
                    if (product) {
                      setNewItem({
                        description: product.name,
                        quantity: 1,
                        unitPrice: Number(product.price) || 0,
                      });
                    }
                  } else {
                    setNewItem({ description: '', quantity: 1, unitPrice: 0 });
                  }
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[5fr_1fr_1fr_auto] gap-3 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newItem.description}
                  onChange={(e) => {
                    setSelectedProductId('');
                    setNewItem((prev) => ({ ...prev, description: e.target.value }));
                  }}
                  placeholder="New item description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qty</label>
                <input
                  type="number"
                  value={newItem.quantity}
                  min={1}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
                <input
                  type="number"
                  value={newItem.unitPrice}
                  min={0}
                  step={0.01}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, unitPrice: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addNewItem}
                  className={`h-10 px-4 text-white rounded-lg transition ${editingIndex !== null ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {editingIndex !== null ? 'Update Item' : 'Add Item'}
                </button>
                {editingIndex !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingIndex(null);
                      setSelectedProductId('');
                      setNewItem({ description: '', quantity: 1, unitPrice: 0 });
                      setNewItemError(null);
                    }}
                    className="h-10 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
            {newItemError && <div className="text-sm text-red-500 mt-2">{newItemError}</div> }

            <div className="overflow-x-auto mt-4">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-md">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {fields.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">No items added yet</td>
                    </tr>
                  ) : (
                    fields.map((field, index) => {
                      const item = field as { description: string; quantity: number; unitPrice: number };
                      const unitPrice = Number(item.unitPrice);
                      const total = item.quantity * unitPrice;
                      return (
                        <tr key={field.id}>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">{item.quantity}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">${unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">${total.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingIndex(index);
                                setSelectedProductId('');
                                setNewItem({
                                  description: item.description,
                                  quantity: item.quantity,
                                  unitPrice: item.unitPrice,
                                });
                              }}
                              className="p-1 rounded hover:bg-blue-50 text-blue-600"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => insert(index + 1, { ...item })}
                              className="p-1 rounded hover:bg-green-50 text-green-600"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="p-1 rounded hover:bg-red-50 text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3}></td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      Total: ${fields.reduce((sum, item) => sum + item.quantity * Number(item.unitPrice), 0).toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-200">Notes</h4>
            <textarea
              {...register('notes')}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {invoiceToEdit ? 'Update' : 'Create'} Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InvoiceForm;
