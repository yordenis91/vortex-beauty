import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

let labels: Record<string, string> = {}
vi.mock('./useQueries', () => ({ useBookingSettings: () => ({ data: { name: 'Salón', labels } }) }))

import { useLabels } from './useLabels'

const use = (l: Record<string, string>) => {
  labels = l
  const { result } = renderHook(useLabels)
  return result.current
}

describe('useLabels', () => {
  it('usa el vocabulario por defecto', () => {
    const { label, the } = use({})
    expect(label('appointment')).toBe('cita')
    expect(label('customers', true)).toBe('Clientes')
    expect(the('appointments')).toBe('las citas')
  })

  it('concuerda artículo y adjetivos con el género de la palabra', () => {
    const turnos = use({ appointment: 'turno', appointments: 'turnos' })
    expect(turnos.the('appointment')).toBe('el turno')
    expect(turnos.the('appointments')).toBe('los turnos')
    expect(turnos.agree('completad', 'appointments')).toBe('completados')
    expect(turnos.agree('Nuev', 'appointment')).toBe('Nuevo')

    const sesiones = use({ appointment: 'sesión', appointments: 'sesiones' })
    expect(sesiones.the('appointment')).toBe('la sesión')
    expect(sesiones.agree('programad', 'appointments')).toBe('programadas')

    const reservas = use({ appointment: 'reserva', appointments: 'reservas' })
    expect(reservas.agree('próxim', 'appointments')).toBe('próximas')
  })

  it('maneja clienta/cliente y manicurista', () => {
    const { the, agree } = use({ customer: 'clienta', customers: 'clientas', professional: 'manicurista', professionals: 'manicuristas' })
    expect(the('customers')).toBe('las clientas')
    expect(agree('nuev', 'customer')).toBe('nueva')
    expect(the('professional')).toBe('la manicurista')
  })
})
