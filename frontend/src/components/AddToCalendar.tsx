import React from 'react';
import { CalendarPlus } from 'lucide-react';
import { downloadIcs, googleCalendarUrl, type CalendarEvent } from '../lib/calendarLinks';

/** «Añadir a mi calendario»: Google Calendar o archivo para Apple, Outlook y otros. */
const AddToCalendar: React.FC<{ event: CalendarEvent }> = ({ event }) => {
  const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-foreground hover:bg-muted';
  return (
    <div className="space-y-2" role="group" aria-label="Añadir a mi calendario">
      <p className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
        <CalendarPlus className="h-4 w-4" /> Añadir a mi calendario
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" className={button}>
          Google Calendar
        </a>
        <button type="button" onClick={() => downloadIcs(event)} className={button}>
          Apple / Outlook (.ics)
        </button>
      </div>
    </div>
  );
};

export default AddToCalendar;
