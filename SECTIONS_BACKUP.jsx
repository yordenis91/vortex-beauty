// SECCIONES DE CITAS (de ClientAppointments.tsx)
// Desactivadas temporalmente - Guardar para referencia futura

// ==========================================
// HERO CARD - Próxima Cita
// ==========================================

{/* HERO CARD - Próxima Cita */}
{nextAppointment ? (
  <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 p-8 text-white shadow-lg">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide opacity-90">
          Tu próxima cita
        </p>
        <h2 className="text-3xl font-bold mt-2">
          {nextAppointment.product?.name || 'Servicio'}
        </h2>
        <div className="flex items-center mt-4 text-lg">
          <Calendar className="h-5 w-5 mr-2" />
          <span>
            {formatDate(nextAppointment.date, nextAppointment.startTime)}
          </span>
        </div>
        {nextAppointment.product?.price && (
          <p className="mt-2 text-sm opacity-90">
            💰 ${Number(nextAppointment.product.price).toFixed(2)}
          </p>
        )}
        {nextAppointment.notes && (
          <p className="mt-3 text-sm italic opacity-90">
            📝 {nextAppointment.notes}
          </p>
        )}
      </div>
      <button
        onClick={() => {
          const el = document.getElementById('upcoming-section');
          el?.scrollIntoView({ behavior: 'smooth' });
        }}
        className="bg-white text-purple-600 hover:bg-gray-100 font-semibold px-6 py-3 rounded-lg transition"
      >
        Ver detalles
      </button>
    </div>
  </div>
) : (
  <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 p-8 text-white shadow-lg">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide opacity-90">
          Sin citas próximas
        </p>
        <h2 className="text-3xl font-bold mt-2">
          ¡Agenda tu próxima cita!
        </h2>
        <p className="mt-2 text-sm opacity-90">
          Descubre nuestros servicios de belleza y diseña tu próxima experiencia.
        </p>
      </div>
      <button
        onClick={scrollToCalendar}
        className="bg-white text-blue-600 hover:bg-gray-100 font-semibold px-6 py-3 rounded-lg transition"
      >
        Agendar cita
      </button>
    </div>
  </div>
)}

// ==========================================
// SECCIÓN: Tus Próximas Citas
// ==========================================

{/* Tus Próximas Citas - PRIORITARIO */}
<div id="upcoming-section">
  <h2 className="text-2xl font-bold text-gray-900 mb-6">Tus Próximas Citas</h2>
  {upcomingAppointments.length > 0 && !showForm ? (
    <div className="space-y-4">
      {upcomingAppointments.map((appointment: Appointment) => (
        <div
          key={appointment.id}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {appointment.product?.name || 'Servicio'}
              </h3>
              <div className="mt-4 space-y-2">
                <div className="flex items-center text-gray-600">
                  <Calendar className="h-5 w-5 mr-3 text-purple-600" />
                  {formatDate(appointment.date, appointment.startTime)}
                </div>
                {appointment.product?.price && (
                  <div className="text-sm font-medium text-gray-900">
                    💰 ${appointment.product.price.toFixed(2)}
                  </div>
                )}
              </div>
            </div>
            <div className="ml-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                Agendada
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gradient-to-b from-gray-50 to-white p-12 text-center">
      <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <p className="text-gray-600 text-lg font-semibold">No tienes citas próximas agendadas</p>
      <p className="text-gray-500 text-sm mt-2">¡Explora nuestros servicios y agenda tu primera cita hoy!</p>
      <button
        onClick={scrollToCalendar}
        className="mt-6 inline-flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
      >
        <Plus className="h-5 w-5" />
        Agendar ahora
      </button>
    </div>
  )}
</div>

// ==========================================
// DEPENDENCIAS NECESARIAS EN ClientAppointments.tsx:
// ==========================================
// - nextAppointment (useMemo)
// - upcomingAppointments (useMemo)
// - formatDate() función
// - scrollToCalendar() función
// - Iconos: Calendar, Plus, AlertCircle
// - showForm estado
