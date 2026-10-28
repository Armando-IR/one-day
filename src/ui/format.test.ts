import { describe, expect, it } from 'vitest';
import { eur, parseAmount, prepA } from './format';

describe('importi scritti a mano', () => {
  it.each([
    ['2.000', 2000],
    ['12.500', 12500],
    ['1.250.000', 1250000],
    ['1.200,50', 1200.5],
    ['11,99', 11.99],
    ['11.99', 11.99],
    ['1.5', 1.5],
    ['0.250', 0.25],
    ["2'000", 2000],
    ['€ 300', 300],
    ['300 €', 300],
  ])('%s', (text, value) => expect(parseAmount(text)).toBe(value));
  it('vuoto o non numerico', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('formati', () => {
  it('euro con il separatore delle migliaia', () => {
    expect(eur(2670)).toBe('2.670\u00a0€');
    expect(eur(-0.2)).toBe('0\u00a0€');
  });
  it('a / ad', () => {
    expect(prepA('aprile 2027')).toBe('ad aprile 2027');
    expect(prepA('ottobre')).toBe('a ottobre');
  });
});
