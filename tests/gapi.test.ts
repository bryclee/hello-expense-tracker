import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initGapiClient,
  setGapiToken,
  getExpenses,
  addExpense,
  getSpreadsheetDetails,
  deleteExpense,
} from '../js/gapi';

describe('gapi.ts unit tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('initGapiClient', () => {
    it('should load client and initialize gapi with discovery docs', async () => {
      const mockInit = vi.fn().mockResolvedValue({});
      (global as any).gapi = {
        load: (name: string, cb: () => void) => cb(),
        client: {
          init: mockInit,
        },
      };

      const callback = vi.fn();
      initGapiClient(callback);

      // Wait for microtasks
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockInit).toHaveBeenCalledWith({
        discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
      });
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('setGapiToken', () => {
    it('should pass token to gapi.client.setToken', () => {
      const mockSetToken = vi.fn();
      (global as any).gapi = {
        client: {
          setToken: mockSetToken,
        },
      };

      const dummyToken = { access_token: 'test-token', expires_in: '3600' } as any;
      setGapiToken(dummyToken);

      expect(mockSetToken).toHaveBeenCalledWith(dummyToken);
    });
  });

  describe('getExpenses', () => {
    it('should return empty expenses array if total rows <= 1', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        result: { values: [['Date', 'Name', 'Category', 'Price']] },
      });
      (global as any).gapi = {
        client: {
          sheets: {
            spreadsheets: {
              values: {
                get: mockGet,
              },
            },
          },
        },
      };

      const res = await getExpenses('sheet123', 'Expenses');

      expect(mockGet).toHaveBeenCalledWith({
        spreadsheetId: 'sheet123',
        range: 'Expenses!A:A',
      });
      expect(res).toEqual({ expenses: [], totalExpenses: 0 });
    });

    it('should return empty expenses array if metadata has no values property', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        result: {},
      });
      (global as any).gapi = {
        client: {
          sheets: {
            spreadsheets: {
              values: {
                get: mockGet,
              },
            },
          },
        },
      };

      const res = await getExpenses('sheet123', 'Expenses');
      expect(res).toEqual({ expenses: [], totalExpenses: 0 });
    });

    it('should fetch expenses and return them in reversed order (newest first)', async () => {
      const mockGet = vi.fn()
        .mockResolvedValueOnce({
          // Sheet metadata check for column A length (4 rows total: 1 header + 3 data)
          result: { values: [['Header'], ['Row 1'], ['Row 2'], ['Row 3']] },
        })
        .mockResolvedValueOnce({
          // Range query result
          result: {
            values: [
              ['2025-01-01', 'Coffee', 'Food', '5'],
              ['2025-01-02', 'Bus', 'Transport', '3'],
            ],
          },
        });

      (global as any).gapi = {
        client: {
          sheets: {
            spreadsheets: {
              values: {
                get: mockGet,
              },
            },
          },
        },
      };

      const res = await getExpenses('sheet123', 'Expenses', 5, 0);

      expect(res.totalExpenses).toBe(3);
      expect(res.expenses).toEqual([
        { date: '2025-01-02', name: 'Bus', category: 'Transport', price: '3', rowIndex: 4 },
        { date: '2025-01-01', name: 'Coffee', category: 'Food', price: '5', rowIndex: 3 },
      ]);
    });

    it('should return empty expenses if startRow > endRow due to high offset', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        result: { values: [['Header'], ['Row 1'], ['Row 2']] },
      });

      (global as any).gapi = {
        client: {
          sheets: {
            spreadsheets: {
              values: {
                get: mockGet,
              },
            },
          },
        },
      };

      const res = await getExpenses('sheet123', 'Expenses', 5, 10);
      expect(res).toEqual({ expenses: [], totalExpenses: 2 });
    });
  });

  describe('addExpense', () => {
    it('should append expense row to Google Sheet', async () => {
      const mockAppend = vi.fn().mockResolvedValue({
        result: { updates: { updatedRows: 1 } },
      });

      (global as any).gapi = {
        client: {
          sheets: {
            spreadsheets: {
              values: {
                append: mockAppend,
              },
            },
          },
        },
      };

      const res = await addExpense(
        'sheet123',
        'Expenses',
        '2025-10-15',
        'Dinner',
        'Food',
        '25'
      );

      expect(mockAppend).toHaveBeenCalledWith({
        spreadsheetId: 'sheet123',
        range: 'Expenses',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [['2025-10-15', 'Dinner', 'Food', '25']],
        },
      });
      expect(res).toEqual({ updates: { updatedRows: 1 } });
    });
  });

  describe('getSpreadsheetDetails', () => {
    it('should call spreadsheets.get and return result', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        result: { properties: { title: 'My Budget Sheet' } },
      });

      (global as any).gapi = {
        client: {
          sheets: {
            spreadsheets: {
              get: mockGet,
            },
          },
        },
      };

      const res = await getSpreadsheetDetails('sheet123');

      expect(mockGet).toHaveBeenCalledWith({ spreadsheetId: 'sheet123' });
      expect(res).toEqual({ properties: { title: 'My Budget Sheet' } });
    });
  });

  describe('deleteExpense', () => {
    it('should call batchUpdate with deleteDimension using numeric sheetId', async () => {
      const mockBatchUpdate = vi.fn().mockResolvedValue({
        result: { replies: [{}] },
      });

      (global as any).gapi = {
        client: {
          sheets: {
            spreadsheets: {
              batchUpdate: mockBatchUpdate,
            },
          },
        },
      };

      const res = await deleteExpense('sheet123', 0, 3);

      expect(mockBatchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'sheet123',
        resource: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: 0,
                  dimension: 'ROWS',
                  startIndex: 2,
                  endIndex: 3,
                },
              },
            },
          ],
        },
      });
      expect(res).toEqual({ replies: [{}] });
    });

    it('should look up sheetId by title if sheetName string is provided', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        result: {
          sheets: [
            { properties: { sheetId: 101, title: 'Expenses' } },
            { properties: { sheetId: 102, title: 'Other' } },
          ],
        },
      });
      const mockBatchUpdate = vi.fn().mockResolvedValue({
        result: { replies: [{}] },
      });

      (global as any).gapi = {
        client: {
          sheets: {
            spreadsheets: {
              get: mockGet,
              batchUpdate: mockBatchUpdate,
            },
          },
        },
      };

      await deleteExpense('sheet123', 'Expenses', 5);

      expect(mockGet).toHaveBeenCalledWith({ spreadsheetId: 'sheet123' });
      expect(mockBatchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'sheet123',
        resource: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: 101,
                  dimension: 'ROWS',
                  startIndex: 4,
                  endIndex: 5,
                },
              },
            },
          ],
        },
      });
    });
  });
});
