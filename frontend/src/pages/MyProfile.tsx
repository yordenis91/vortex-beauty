import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Edit, LogOut, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMyProfile } from '../hooks/useQueries';

const MyProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = React.useState(false);
  const { data: profileData, isLoading } = useMyProfile();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-gray-600">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  const companyInfo = profileData?.client || {
    name: 'Empresa',
    email: 'contact@company.com',
    phone: 'N/A',
    address: 'N/A',
    city: 'N/A',
    country: 'N/A',
    taxId: 'N/A',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="mt-2 text-sm text-gray-600">Información de tu cuenta y empresa</p>
      </div>

      {/* User Info Card */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{user?.name}</h2>
              <p className="text-gray-600">{user?.email}</p>
              <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                {user?.role?.toUpperCase() || 'CLIENT'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Edit className="h-4 w-4 mr-2" />
            {isEditing ? 'Cancelar' : 'Editar'}
          </button>
        </div>

        {!isEditing && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Personal</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre completo</label>
                <p className="mt-1 text-gray-900">{user?.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-gray-900">{user?.email}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Company Info Card */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Información de la Empresa</h3>
        
        {!isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre de empresa</label>
              <p className="mt-1 text-gray-900 font-medium">{companyInfo.name || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email corporativo</label>
              <p className="mt-1 text-gray-900">{companyInfo.email || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Teléfono</label>
              <p className="mt-1 text-gray-900">{companyInfo.phone || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tax ID / RFC</label>
              <p className="mt-1 text-gray-900">{companyInfo.taxId || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Dirección</label>
              <p className="mt-1 text-gray-900">{companyInfo.address || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Ciudad / País</label>
              <p className="mt-1 text-gray-900">{companyInfo.city || 'N/A'}, {companyInfo.country || 'N/A'}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">La edición de perfil está en construcción. Contacta a soporte para cambios.</p>
          </div>
        )}
      </div>

      {/* Billing Address */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Dirección de Facturación</h3>
        <div className="space-y-2 text-gray-600">
          <p>{companyInfo.name || 'Empresa'}</p>
          <p>{companyInfo.address || 'N/A'}</p>
          <p>{companyInfo.city || 'N/A'}, {companyInfo.country || 'N/A'}</p>
          <p>Tax ID: {companyInfo.taxId || 'N/A'}</p>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Seguridad</h3>
        <div className="space-y-4">
          <button className="w-full text-left px-4 py-3 border border-gray-300 rounded-md hover:bg-gray-50">
            <p className="text-sm font-medium text-gray-900">Cambiar contraseña</p>
            <p className="text-xs text-gray-500">Última cambio hace 3 meses</p>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between px-4 py-3 border border-red-300 rounded-md text-red-700 hover:bg-red-50"
          >
            <span className="text-sm font-medium">Cerrar sesión</span>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
