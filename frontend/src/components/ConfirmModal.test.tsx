import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmModal from './ConfirmModal'

const props = { title: 'Confirmar', message: '¿Seguro?' }

describe('ConfirmModal', () => {
  it('no pinta nada cerrado', () => {
    render(<ConfirmModal {...props} isOpen={false} onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.queryByText('Confirmar')).not.toBeInTheDocument()
  })

  it('confirma y cancela con sus botones', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmModal {...props} isOpen onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByText('¿Seguro?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
