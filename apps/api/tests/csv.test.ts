import { describe, expect, it } from 'vitest';
import { sanitizeCsvCell, validateRows, yuanToFen } from '../src/services/csv';
import { calendarDaysBetween } from '../src/services/forecast-spec';

describe('csv money parsing', () => {
  it('converts yuan (with separators/¥) to integer fen', () => {
    expect(yuanToFen('299.00')).toBe(29_900);
    expect(yuanToFen('¥1,234.50')).toBe(123_450);
    expect(yuanToFen('0')).toBe(0);
    expect(() => yuanToFen('12.345')).toThrow();
    expect(() => yuanToFen('abc')).toThrow();
  });
});

describe('csv cell sanitization', () => {
  it('neutralizes spreadsheet formula injection', () => {
    expect(sanitizeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(sanitizeCsvCell('+1')).toBe("'+1");
    expect(sanitizeCsvCell('-2')).toBe("'-2");
    expect(sanitizeCsvCell('@x')).toBe("'@x");
    expect(sanitizeCsvCell('safe')).toBe('safe');
  });
});

describe('validateRows', () => {
  it('reports invalid dates/amounts as row errors instead of throwing', () => {
    const rows = [
      { channel: 'douyin', externalId: 'A', orderedAt: '2026-01-10', grossAmount: '100.00' },
      { channel: 'douyin', externalId: 'B', orderedAt: 'nope', grossAmount: '100.00' },
      { channel: 'douyin', externalId: 'C', orderedAt: '2026-01-10', grossAmount: 'xx' }
    ];
    const mapping = {
      channel: 'channel',
      externalId: 'externalId',
      orderedAt: 'orderedAt',
      grossAmount: 'grossAmount'
    };
    const { valid, errors } = validateRows('orders', rows, mapping);
    expect(valid).toHaveLength(1);
    expect(valid[0].data['grossAmount']).toBe(10_000);
    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.errors.join(' ')).join(' ')).toMatch(/not a valid date|not a valid amount/);
  });
});

describe('calendarDaysBetween', () => {
  it('uses whole-day calendar differences, not instants (regression: day-12 invoices)', () => {
    // 15:30 on the 19th → a date 12 calendar days later must read as 12, not 11
    const from = new Date('2026-06-19T15:30:00.000Z');
    expect(calendarDaysBetween(from, '2026-07-01')).toBe(12);
    expect(calendarDaysBetween(from, '2026-06-25')).toBe(6);
    expect(calendarDaysBetween(from, '2026-06-16')).toBe(-3);
    expect(calendarDaysBetween(from, '2026-06-19')).toBe(0);
  });
});
