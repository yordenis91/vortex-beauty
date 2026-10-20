import { describe, it, expect } from 'vitest'
import { posterSvg } from './poster'

const base = { qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"/>', salonName: 'Barbería <Demo> & Co', url: 'https://x.test/r/demo', fallbackColor: '#14213D', platformName: 'Afilao' }

describe('cartel de reservas', () => {
  it('usa el color y el logo del salón y escapa el nombre', () => {
    const svg = posterSvg({ ...base, brandColor: '#2A9D8F', logoUrl: 'data:image/png;base64,AAAA' })
    expect(svg).toContain('fill="#2A9D8F"')
    expect(svg).toContain('href="data:image/png;base64,AAAA"')
    expect(svg).toContain('Barbería &lt;Demo&gt; &amp; Co')
    expect(svg).toContain('https://x.test/r/demo')
    expect(svg).toContain('Reservas con Afilao')
  })

  it('sin logo ni color usa la marca de la plataforma y pone el nombre en la banda', () => {
    const svg = posterSvg(base)
    expect(svg).toContain('fill="#14213D"')
    expect(svg).not.toContain('data:image/png')
    expect(svg).toContain('fill="#FFFFFF">Barbería')
  })

  it('con un color claro el texto de la banda es oscuro', () => {
    expect(posterSvg({ ...base, brandColor: '#FFE066' })).toContain('fill="#111111">Barbería')
  })

  it('ignora un color inválido', () => {
    expect(posterSvg({ ...base, brandColor: 'rojo' })).toContain('fill="#14213D"')
  })
})
