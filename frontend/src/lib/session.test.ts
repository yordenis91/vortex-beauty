import { describe, it, expect } from 'vitest'
import { getAccessToken, setAccessToken, consumeImpersonationToken, isImpersonating, clearImpersonation } from './session'

describe('sesión', () => {
  it('guarda el access token solo en memoria', () => {
    setAccessToken('abc')
    expect(getAccessToken()).toBe('abc')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    setAccessToken(null)
    expect(getAccessToken()).toBeNull()
  })

  it('toma el token de impersonación del hash y lo borra de la URL', () => {
    window.history.replaceState(null, '', '/panel#impersonate=tok%2B1')
    expect(consumeImpersonationToken()).toBe('tok+1')
    expect(window.location.hash).toBe('')
    expect(isImpersonating()).toBe(true)
    clearImpersonation()
    expect(isImpersonating()).toBe(false)
  })

  it('sin hash no hay impersonación', () => {
    window.history.replaceState(null, '', '/panel')
    expect(consumeImpersonationToken()).toBeNull()
  })
})
