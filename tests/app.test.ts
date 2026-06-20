
import { describe, it, expect, beforeEach } from 'vitest';
import { getPendingExpenses } from '../js/app';

describe('getPendingExpenses', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return an empty array when there are no pending expenses', () => {
    expect(getPendingExpenses()).toEqual([]);
  });

  it('should return pending expenses from localStorage', () => {
    const pendingExpenses = [
      { date: '2025-10-14', name: 'Lunch', category: 'Food', price: '15' },
    ];
    localStorage.setItem('pending-expenses', JSON.stringify(pendingExpenses));
    expect(getPendingExpenses()).toEqual(pendingExpenses);
  });
});
