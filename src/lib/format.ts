
export const formatCurrency = (value: number) => {
  if (typeof value !== 'number' || !isFinite(value)) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};
