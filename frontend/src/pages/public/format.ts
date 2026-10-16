export const money = (value: number | string, currency: string) =>
  `${Number(value).toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
