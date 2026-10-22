import { describe, it, expect } from 'vitest'
import { confirmationMessage, whatsappLink, whatsappPhone } from './whatsapp'

describe('WhatsApp', () => {
  it('normaliza los números a solo dígitos con prefijo', () => {
    expect(whatsappPhone('+53 5 555 1234')).toBe('5355551234')
    expect(whatsappPhone('5 555 1234')).toBe('5355551234') // móvil cubano sin prefijo
    expect(whatsappPhone('+1 (305) 792-8837')).toBe('13057928837')
    expect(whatsappPhone('123')).toBeNull()
    expect(whatsappPhone(null)).toBeNull()
  })
  it('arma el enlace con el texto codificado, o nada si no hay teléfono', () => {
    expect(whatsappLink('+53 5 555 1234', 'Hola Ana')).toBe('https://wa.me/5355551234?text=Hola%20Ana')
    expect(whatsappLink('', 'Hola')).toBeNull()
  })
  it('el mensaje de confirmación usa el nombre de pila, el salón, el día y la hora', () => {
    expect(confirmationMessage({ clientName: 'Yadira Castillo', salonName: 'Yumi Manicure', serviceName: 'Uñas acrílicas', date: '2026-10-22', time: '13:00' })).toBe(
      'Hola Yadira, te confirmo tu cita en Yumi Manicure: Uñas acrílicas, jueves 22 de octubre a las 13:00. ¡Te esperamos!',
    )
    expect(confirmationMessage({ serviceName: 'Corte', date: '2026-10-23', time: '09:30' })).toMatch(/^Hola, te confirmo tu cita: Corte, viernes 23 de octubre a las 09:30/)
  })
})
