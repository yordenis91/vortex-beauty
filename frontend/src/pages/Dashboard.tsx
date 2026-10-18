import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle2, Clock, Users, ArrowRight } from 'lucide-react';
import { useAppointments, useClients } from '../hooks/useQueries';
import { useLabels } from '@/hooks/useLabels';

const todayStr = () => new Date().toISOString().split('T')[0];

const Dashboard: React.FC = () => {
  const { label, agree } = useLabels();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: appointments = [], isLoading: appointmentsLoading } = useAppointments();

  const today = todayStr();
  const scheduled = appointments.filter((a) => a.status === 'SCHEDULED');
  const todayCount = scheduled.filter((a) => a.date.split('T')[0] === today).length;
  const upcoming = scheduled.filter((a) => a.date.split('T')[0] >= today).slice(0, 8);
  const completed = appointments.filter((a) => a.status === 'COMPLETED').length;

  const loading = clientsLoading || appointmentsLoading;

  const statCards = [
    { name: `${label('appointments', true)} de hoy`, value: todayCount, icon: Clock, color: 'bg-purple-500' },
    { name: `${label('appointments', true)} ${agree('programad', 'appointments')}`, value: scheduled.length, icon: Calendar, color: 'bg-blue-500' },
    { name: `${label('appointments', true)} ${agree('completad', 'appointments')}`, value: completed, icon: CheckCircle2, color: 'bg-green-500' },
    { name: label('customers', true), value: clients.length, icon: Users, color: 'bg-yellow-500' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panel de control</h1>
        <p className="mt-1 text-sm text-muted-foreground">Resumen de tu agenda.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.name} className="bg-card shadow rounded-lg p-5 flex items-center gap-4">
            <div className={`${card.color} rounded-md p-3`}>
              <card.icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{card.name}</p>
              <p className="text-2xl font-semibold text-foreground">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6 border-b border-border flex items-center justify-between">
          <h3 className="text-lg leading-6 font-medium text-foreground">{agree('Próxim', 'appointments')} {label('appointments')}</h3>
          <Link to="/admin/appointments" className="text-sm text-primary inline-flex items-center gap-1">
            Ver agenda <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <ul className="divide-y divide-border">
          {upcoming.length === 0 ? (
            <li className="px-4 py-8 text-center text-muted-foreground">No hay {label('appointments')} {agree('próxim', 'appointments')}.</li>
          ) : (
            upcoming.map((apt) => (
              <li key={apt.id} className="px-4 py-4 sm:px-6 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{apt.client?.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{apt.serviceName}</p>
                </div>
                <div className="text-sm text-foreground text-right">
                  <p>{new Date(apt.date).toLocaleDateString('es', { timeZone: 'UTC' })}</p>
                  <p className="text-muted-foreground">{apt.startTime}</p>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;
