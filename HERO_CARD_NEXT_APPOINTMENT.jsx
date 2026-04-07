// HERO CARD - Próxima Cita (de ClientAppointments.tsx)
// Sección desactivada temporalmente - Guardar para referencia futura

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

// DEPENDENCIAS NECESARIAS EN ClientAppointments.tsx:
// - nextAppointment (useMemo)
// - upcomingAppointments (useMemo)
// - formatDate() función
// - scrollToCalendar() función
// - Iconos: Calendar
