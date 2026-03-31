import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User, Phone, Mail, Heart, Loader, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClientProfile, useUpdateClientProfile } from '../../hooks/useQueries';

const ClientProfile: React.FC = () => {
  const { user, setUser } = useAuth();
  const { data: profileData, isLoading } = useClientProfile();
  const updateProfileMutation = useUpdateClientProfile();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const clientInfo = {
    name: profileData?.client?.name || user?.name || 'N/A',
    email: profileData?.client?.email || user?.email || 'N/A',
    phone: profileData?.client?.phone || 'N/A',
    address: profileData?.client?.address || 'N/A',
    imageUrl: imageUrl || profileData?.client?.imageUrl || user?.imageUrl || null,
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setImageUrl(base64);
        updateProfileMutation.mutate({ imageUrl: base64 }, {
          onSuccess: () => {
            if (user && setUser) {
              setUser({ ...user, imageUrl: base64 });
            }
            toast.success('Foto de perfil actualizada correctamente');
          },
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
    updateProfileMutation.mutate({ imageUrl: null }, {
      onSuccess: () => {
        if (user && setUser) {
          setUser({ ...user, imageUrl: undefined });
        }
        toast.success('Foto de perfil eliminada correctamente');
      },
    });
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="mt-2 text-sm text-gray-600">Información personal y preferencias</p>
      </div>

      {/* Personal Info Card */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-start space-x-4">
          <div className="relative">
            {clientInfo.imageUrl || imageUrl ? (
              <img
                src={imageUrl || clientInfo.imageUrl}
                alt="Foto de perfil"
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-pink-100 flex items-center justify-center">
                <User className="h-8 w-8 text-pink-600" />
              </div>
            )}
            <div className="absolute -bottom-2 -right-2 flex space-x-1">
              <label className="bg-blue-500 text-white p-1 rounded-full cursor-pointer hover:bg-blue-600">
                <Upload className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
              {(clientInfo.imageUrl || imageUrl) && (
                <button
                  onClick={handleRemoveImage}
                  className="bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{clientInfo.name}</h2>
            <p className="text-gray-600">{clientInfo.email}</p>
            <span className="inline-block mt-2 px-3 py-1 bg-pink-100 text-pink-800 text-xs font-semibold rounded-full">
              CLIENTA
            </span>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Información de Contacto</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-gray-400" />
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-gray-900">{clientInfo.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Phone className="h-5 w-5 text-gray-400" />
              <div>
                <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                <p className="mt-1 text-gray-900">{clientInfo.phone || 'No especificado'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 md:col-span-2">
              <User className="h-5 w-5 text-gray-400" />
              <div>
                <label className="block text-sm font-medium text-gray-700">Dirección</label>
                <p className="mt-1 text-gray-900">{clientInfo.address || 'No especificada'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences Card */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Heart className="h-6 w-6 text-pink-600" />
          <h3 className="text-lg font-semibold text-gray-900">Preferencias de Manicura</h3>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-gray-600 text-sm">
            Esta sección está en desarrollo. Pronto podrás configurar tus preferencias de estilo,
            colores favoritos y tratamientos preferidos para una experiencia personalizada.
          </p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-pink-600 font-semibold">?</span>
              </div>
              <p className="text-sm text-gray-700">Estilos Favoritos</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-pink-600 font-semibold">?</span>
              </div>
              <p className="text-sm text-gray-700">Colores Preferidos</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-pink-600 font-semibold">?</span>
              </div>
              <p className="text-sm text-gray-700">Tratamientos</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientProfile;