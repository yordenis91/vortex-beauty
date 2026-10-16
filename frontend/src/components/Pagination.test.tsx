import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Pagination from './Pagination'

const base = { currentPage: 2, totalPages: 5, totalItems: 47, itemsPerPage: 10 }

describe('Pagination', () => {
  it('no se muestra con una sola página', () => {
    const { container } = render(<Pagination {...base} totalPages={1} onPageChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('avisa de la página siguiente y la anterior', async () => {
    const onPageChange = vi.fn()
    render(<Pagination {...base} onPageChange={onPageChange} />)
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[buttons.length - 1])
    expect(onPageChange).toHaveBeenCalledWith(3)
    await userEvent.click(buttons[0])
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('no retrocede desde la primera página', async () => {
    const onPageChange = vi.fn()
    render(<Pagination {...base} currentPage={1} onPageChange={onPageChange} />)
    await userEvent.click(screen.getAllByRole('button')[0])
    expect(onPageChange).not.toHaveBeenCalled()
  })
})
