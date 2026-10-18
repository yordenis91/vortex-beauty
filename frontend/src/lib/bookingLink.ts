/** Enlace corto de reserva de un salón: /r/<slug> redirige a /<slug>/reservar. */
export const shortBookingLink = (slug: string) => `${window.location.origin}/r/${slug}`;
