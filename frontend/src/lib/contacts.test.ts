import { describe, it, expect } from 'vitest'
import { parseVcf } from './contacts'

describe('parseVcf', () => {
  it('lee vCard 3.0 con parámetros, mayúsculas y líneas plegadas', () => {
    const vcf = [
      'BEGIN:VCARD', 'VERSION:3.0', 'N:Pérez;Luis;;;', 'FN:Luis Pérez',
      'TEL;TYPE=CELL;TYPE=pref:+53 5 555 1002', 'TEL;TYPE=HOME:+53 7 000 0000',
      'EMAIL;TYPE=INTERNET:luis@example.com', 'END:VCARD',
      'BEGIN:VCARD', 'VERSION:3.0', 'FN:Ana', ' María', 'item1.TEL:tel:+5355001122', 'END:VCARD',
    ].join('\r\n')
    expect(parseVcf(vcf)).toEqual([
      { name: 'Luis Pérez', phone: '+53 5 555 1002', email: 'luis@example.com' },
      { name: 'AnaMaría', phone: '+5355001122', email: undefined },
    ])
  })

  it('sin FN usa N; sin teléfono ni correo se descarta; ignora basura', () => {
    const vcf = 'BEGIN:VCARD\nVERSION:2.1\nN:García;Carmen\nTEL;CELL:5355009999\nEND:VCARD\nBEGIN:VCARD\nFN:Sin datos\nEND:VCARD\nbasura'
    expect(parseVcf(vcf)).toEqual([{ name: 'Carmen García', phone: '5355009999', email: undefined }])
    expect(parseVcf('')).toEqual([])
  })
})
