import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PhoneInput from './PhoneInput'

function Harness() {
  const [v, setV] = useState('')
  return <PhoneInput aria-label="tel" value={v} onValueChange={setV} />
}

describe('PhoneInput', () => {
  it('al salir del campo añade el código de país', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByLabelText('tel'), '5555 1234')
    await user.tab()
    expect(screen.getByLabelText('tel')).toHaveValue('+5355551234')
  })
  it('un número con otro país no se toca y lo que no es teléfono se deja como está', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByLabelText('tel'), '+34 612 345 678')
    await user.tab()
    expect(screen.getByLabelText('tel')).toHaveValue('+34612345678')
    await user.clear(screen.getByLabelText('tel'))
    await user.type(screen.getByLabelText('tel'), '12')
    await user.tab()
    expect(screen.getByLabelText('tel')).toHaveValue('12')
  })
})
