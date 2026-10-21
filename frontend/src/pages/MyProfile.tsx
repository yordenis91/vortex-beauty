import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import MyTelegramCard from '../components/MyTelegramCard';
import api from '../lib/api';
import { setAccessToken } from '../lib/session';
import { getErrorMessage, useBookingSettings, useUpdateClientProfile } from '../hooks/useQueries';

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  STAFF: 'Profesional',
  CLIENT: 'Cliente',
};

const inputClass = 'w-full px-3 py-2 border border-border rounded-lg bg-card focus:ring-2 focus:ring-blue-500 outline-none';

/** Cuenta de quien está dentro del panel: sus datos y su contraseña. */
const MyProfile: React.FC = () => {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const { data: settings } = useBookingSettings();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const updateProfile = useUpdateClientProfile({
    onSuccess: () => {
      if (user) setUser({ ...user, name: name.trim(), email: email.trim() });
    },
  });
  const profileChanged = name.trim() !== user?.name || email.trim() !== user?.email;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const changePassword = useMutation({
    mutationFn: async () => (await api.post<{ token: string }>('/auth/change-password', { currentPassword, newPassword })).data,
    onSuccess: ({ token }) => {
      setAccessToken(token); // las demás sesiones se cierran; esta sigue abierta con credenciales nuevas
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      toast.success('Contraseña cambiada. Las demás sesiones se cerraron.');
    },
    onError: (error) => setPasswordError(getErrorMessage(error, 'No se pudo cambiar la contraseña')),
  });

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword.length < 8) return setPasswordError('La nueva contraseña debe tener al menos 8 caracteres');
    if (newPassword !== confirmPassword) return setPasswordError('Las contraseñas nuevas no coinciden');
    changePassword.mutate();
  };

  const submitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ name: name.trim(), email: email.trim() });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mi perfil</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tu cuenta{settings?.name ? ` en ${settings.name}` : ''}.</p>
      </div>

      <section className="bg-card rounded-lg shadow-md p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
            <User className="h-7 w-7 text-blue-600 dark:text-blue-300" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{user?.name}</p>
            <span className="inline-block mt-1 px-3 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
              {ROLE_LABEL[user?.role ?? ''] ?? user?.role}
            </span>
          </div>
        </div>

        <form onSubmit={submitProfile} className="space-y-4">
          <div>
            <label htmlFor="profile-name" className="block text-sm font-medium text-foreground mb-1">Nombre</label>
            <input id="profile-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </div>
          <div>
            <label htmlFor="profile-email" className="block text-sm font-medium text-foreground mb-1">Correo (es tu usuario)</label>
            <input id="profile-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button
            type="submit"
            disabled={!profileChanged || updateProfile.isPending}
            className="px-5 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {updateProfile.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </section>

      <section className="bg-card rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
          <KeyRound className="h-5 w-5" /> Cambiar contraseña
        </h2>
        <p className="text-sm text-muted-foreground mb-4">Si entraste con una contraseña temporal, cámbiala ahora.</p>
        <form onSubmit={submitPassword} className="space-y-4">
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-foreground mb-1">Contraseña actual</label>
            <input id="current-password" type="password" autoComplete="current-password" className={inputClass} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-foreground mb-1">Contraseña nueva (mínimo 8 caracteres)</label>
            <input id="new-password" type="password" autoComplete="new-password" className={inputClass} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground mb-1">Repite la contraseña nueva</label>
            <input id="confirm-password" type="password" autoComplete="new-password" className={inputClass} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          {passwordError && <p role="alert" className="text-sm text-red-600">{passwordError}</p>}
          <button type="submit" disabled={changePassword.isPending} className="px-5 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
            {changePassword.isPending ? 'Cambiando…' : 'Cambiar contraseña'}
          </button>
        </form>
      </section>

      <MyTelegramCard />

      <button onClick={handleLogout} className="inline-flex items-center px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground bg-card hover:bg-muted">
        <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
      </button>
    </div>
  );
};

export default MyProfile;
