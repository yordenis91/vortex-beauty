import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PaperBadge from './PaperBadge'
import { isFromPaper } from '../lib/paper'

describe('marca de cita del papel', () => {
  it('se anuncia como «Anotada desde papel»', () => {
    render(<PaperBadge />)
    const badge = screen.getByRole('img', { name: 'Anotada desde papel' })
    expect(badge).toHaveTextContent('📝')
  })

  it('solo el origen PAPEL cuenta como del papel', () => {
    expect(isFromPaper({ source: 'PAPEL' })).toBe(true)
    expect(isFromPaper({ source: 'ADMIN' })).toBe(false)
    expect(isFromPaper({})).toBe(false)
    expect(isFromPaper(null)).toBe(false)
  })
})
