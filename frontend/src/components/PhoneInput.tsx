import type { InputHTMLAttributes } from 'react';
import { normalizePhone } from '../lib/phone';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string;
  onValueChange: (value: string) => void;
}

/** Campo de teléfono: al salir completa el código de país («5555 1234» → «+5355551234»). */
export default function PhoneInput({ value, onValueChange, onBlur, placeholder = '+53 5555 5555', ...rest }: Props) {
  return (
    <input
      {...rest}
      type="tel"
      inputMode="tel"
      autoComplete={rest.autoComplete ?? 'tel'}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      onBlur={(e) => {
        const normalized = normalizePhone(value);
        if (normalized && normalized !== value) onValueChange(normalized);
        onBlur?.(e);
      }}
    />
  );
}
