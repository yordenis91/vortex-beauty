import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Invoice } from '../types';

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
  onSubmitInvoice: (data: InvoiceFormValues, editId?: string) => Promise<void>;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({
  isOpen,
  onClose,
  invoiceToEdit,
  clients,
  projects,
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

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  useEffect(() => {
    if (invoiceToEdit) {
      reset({
        invoiceNumber: invoiceToEdit.invoiceNumber || '',
        clientId: invoiceToEdit.clientId || '',
        projectId: invoiceToEdit.projectId || '',
        issueDate: invoiceToEdit.issueDate || '',
        dueDate: invoiceToEdit.dueDate || '',
        status: invoiceToEdit.status || 'PENDING',
        notes: invoiceToEdit.notes || '',
        items: invoiceToEdit.items?.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })) || [{ description: '', quantity: 1, unitPrice: 0 }],
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
        items: [{ description: '', quantity: 1, unitPrice: 0 }],
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
            <div className="space-y-4">
              {errors.items?.message && <span className="text-sm text-red-500 block">{errors.items.message}</span>}
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="md:col-span-5">
                    <input
                      {...register(`items.${index}.description` as const)}
                      placeholder="Description"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                    {errors.items?.[index]?.description && (<span className="text-sm text-red-500 mt-1 block">{errors.items[index]?.description?.message}</span>)}
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="number"
                      {...register(`items.${index}.quantity` as const, { valueAsNumber: true })}
                      min={1}
                      placeholder="Qty"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                    {errors.items?.[index]?.quantity && (<span className="text-sm text-red-500 mt-1 block">{errors.items[index]?.quantity?.message}</span>)}
                  </div>
                  <div className="md:col-span-3">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      {...register(`items.${index}.unitPrice` as const, { valueAsNumber: true })}
                      placeholder="Unit Price"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                    {errors.items?.[index]?.unitPrice && (<span className="text-sm text-red-500 mt-1 block">{errors.items[index]?.unitPrice?.message}</span>)}
                  </div>
                  <div className="md:col-span-2 flex items-start">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Add Item
              </button>
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
