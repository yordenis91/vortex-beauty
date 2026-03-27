import React from 'react';
import { Zap, Calendar, AlertCircle, Loader } from 'lucide-react';
import { useMySubscriptions } from '../hooks/useQueries';

const MySubscriptions: React.FC = () => {
  const { data: subscriptions = [], isLoading, error } = useMySubscriptions();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-gray-600">Cargando suscripciones...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">Error al cargar las suscripciones. Por favor, intenta de nuevo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mis Suscripciones</h1>
        <p className="mt-2 text-sm text-gray-600">Gestiona tus suscripciones activas y próximas renovaciones</p>
      </div>

      {/* Subscriptions Grid */}
      <div className="grid grid-cols-1 gap-6">
        {subscriptions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">No hay suscripciones activas</p>
          </div>
        ) : (
          subscriptions.map((sub) => (
            <div key={sub.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <Zap className="h-6 w-6 text-blue-500" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{sub.product?.name || 'Producto'}</h3>
                      <p className="text-sm text-gray-500">{sub.subscriptionNumber || `SUB-${sub.id.slice(0, 6).toUpperCase()}`}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Estado</p>
                      <span className={`inline-block mt-1 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(sub.status)}`}>
                        {sub.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Próxima Renovación</p>
                      <div className="mt-1 flex items-center text-sm text-gray-700">
                        <Calendar className="h-4 w-4 mr-1" />
                        {sub.nextBilling ? new Date(sub.nextBilling).toLocaleDateString('es-ES') : '-'}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Precio Mensual</p>
                      <p className="mt-1 font-semibold text-gray-900">${(sub.product?.price || 0).toLocaleString('es-ES', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                    </div>
                  </div>
                </div>

                <button className="ml-4 px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 text-sm font-medium">
                  Cancelar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info Box */}
      {subscriptions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-900">Recuerda renovar a tiempo</h4>
            <p className="text-sm text-blue-700 mt-1">
              Tus suscripciones se renovarán automáticamente en la fecha indicada. Puedes cancelar en cualquier momento.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MySubscriptions;
