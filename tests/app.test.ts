import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getPendingExpenses,
  savePendingExpense,
  syncPendingExpenses,
  deletePendingExpense,
} from '../js/app';

describe('app.ts unit tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
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
