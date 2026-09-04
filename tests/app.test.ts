import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getPendingExpenses,
  savePendingExpense,
  syncPendingExpenses,
  formatDate,
  getTodayLocalDate,
  deletePendingExpense,
} from '../js/app';

describe('app.ts unit tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('formatDate', () => {
    it('should convert YYYY-MM-DD to M/D/YYYY', () => {
      expect(formatDate('2026-09-04')).toBe('9/4/2026');
      expect(formatDate('2026-09-03')).toBe('9/3/2026');
      expect(formatDate('2025-10-15')).toBe('10/15/2025');
      expect(formatDate('2025-01-05')).toBe('1/5/2025');
    });

    it('should preserve existing M/D/YYYY format', () => {
      expect(formatDate('9/3/2026')).toBe('9/3/2026');
      expect(formatDate('10/15/2025')).toBe('10/15/2025');
    });

    it('should return empty string for empty input', () => {
      expect(formatDate('')).toBe('');
    });
  });

  describe('getTodayLocalDate', () => {
    it('should return a date string in YYYY-MM-DD format using local time', () => {
      const result = getTodayLocalDate();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const now = new Date();
      const expectedYear = now.getFullYear();
      const m = now.getMonth() + 1;
      const d = now.getDate();
      const expectedMonth = m < 10 ? `0${m}` : `${m}`;
      const expectedDay = d < 10 ? `0${d}` : `${d}`;
      expect(result).toBe(`${expectedYear}-${expectedMonth}-${expectedDay}`);
    });
  });

  describe('getPendingExpenses', () => {
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

  describe('savePendingExpense', () => {
    it('should save a pending expense to localStorage', () => {
      const newExpense = {
        date: '2025-10-15',
        name: 'Coffee',
        category: 'Food',
        price: '4',
      };
      savePendingExpense(newExpense);

      expect(getPendingExpenses()).toEqual([newExpense]);
    });

    it('should append to existing pending expenses in localStorage', () => {
      const initialExpense = {
        date: '2025-10-14',
        name: 'Lunch',
        category: 'Food',
        price: '15',
      };
      savePendingExpense(initialExpense);

      const nextExpense = {
        date: '2025-10-15',
        name: 'Taxi',
        category: 'Transport',
        price: '20',
      };
      savePendingExpense(nextExpense);

      expect(getPendingExpenses()).toEqual([initialExpense, nextExpense]);
    });
  });

  describe('syncPendingExpenses', () => {
    it('should postpone sync when GAPI client is not ready', async () => {
      const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      savePendingExpense({
        date: '2025-10-15',
        name: 'Coffee',
        category: 'Food',
        price: '4',
      });

      await syncPendingExpenses();

      expect(spyLog).toHaveBeenCalledWith(
        expect.stringContaining('GAPI client not ready yet')
      );
      // Pending expenses should remain untouched
      expect(getPendingExpenses().length).toBe(1);
    });
  });

  describe('deletePendingExpense', () => {
    it('should delete pending expense at given index', () => {
      const exp1 = { date: '2025-10-14', name: 'Item 1', category: 'Food', price: '10' };
      const exp2 = { date: '2025-10-15', name: 'Item 2', category: 'Transport', price: '20' };
      savePendingExpense(exp1);
      savePendingExpense(exp2);

      deletePendingExpense(0);

      expect(getPendingExpenses()).toEqual([exp2]);
    });

    it('should do nothing if index is out of bounds', () => {
      const exp1 = { date: '2025-10-14', name: 'Item 1', category: 'Food', price: '10' };
      savePendingExpense(exp1);

      deletePendingExpense(5);
      deletePendingExpense(-1);

      expect(getPendingExpenses()).toEqual([exp1]);
    });
  });
});
