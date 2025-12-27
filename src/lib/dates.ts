import { startOfMonth, endOfMonth, formatISO } from 'date-fns';

export function getBillingPeriod(date: Date = new Date()) {
  const start = startOfMonth(date);
  const end = endOfMonth(date);

  return {
    startOfMonth: formatISO(start, { representation: 'date' }),
    endOfMonth: formatISO(end, { representation: 'date' }),
  };
}
