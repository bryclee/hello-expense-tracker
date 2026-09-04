import { test, expect } from '@playwright/test';

test.describe('Expense Tracker Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage
    await page.addInitScript(() => {
      window.localStorage.clear();
    });

    // Intercept Google Client library loading URLs to mock them offline
    await page.route('https://accounts.google.com/gsi/client', async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: 'if (window.onGisLoad) window.onGisLoad();',
      });
    });

    await page.route(/https:\/\/apis\.google\.com\/js\/api\.js.*/, async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: 'if (window.onGapiLoad) window.onGapiLoad();',
      });
    });

    await page.route('https://www.googleapis.com/oauth2/v3/userinfo', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ email: 'test-user@example.com' }),
      });
    });
  });

  test('should show logged-out view initially', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#logged-out-view')).toBeVisible();
    await expect(page.locator('#logged-in-view')).not.toBeVisible();
  });

  test('should sign in and navigate to spreadsheet selection', async ({ page }) => {
    // Inject mock Google and GAPI clients
    await page.addInitScript(() => {
      (window as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: (config: any) => {
              return {
                requestAccessToken: () => {
                  config.callback({
                    access_token: 'mock-token-123',
                    expires_in: 3600,
                  });
                },
              };
            },
          },
        },
      };

      (window as any).gapi = {
        load: (lib: string, cb: () => void) => cb(),
        client: {
          init: () => Promise.resolve(),
          setToken: () => {},
        },
      };
    });

    await page.goto('/');

    // Click Sign In
    await page.click('#sign-in-button');

    // Should navigate to spreadsheet selection since none is chosen
    await expect(page.locator('#spreadsheet-selection')).toBeVisible();
    await expect(page.locator('#logged-in-view')).not.toBeVisible();
  });

  test('should load expenses when spreadsheet is selected', async ({ page }) => {
    // Setup initial localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('selected_spreadsheet_id', 'mock-sheet-id');
      window.localStorage.setItem('selected_sheet_name', 'Expenses');
      window.localStorage.setItem(
        'gapi_token',
        JSON.stringify({
          access_token: 'mock-token-123',
          expires_in: 3600,
          expirationTime: Date.now() + 3600000,
        })
      );

      (window as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: () => {
              return { requestAccessToken: () => {} };
            },
          },
        },
      };

      (window as any).gapi = {
        load: (lib: string, cb: () => void) => cb(),
        client: {
          init: () => Promise.resolve(),
          setToken: () => {},
          sheets: {
            spreadsheets: {
              get: async () => ({
                result: { properties: { title: 'Mock Spreadsheet Title' } },
              }),
              values: {
                get: async ({ range }: { range: string }) => {
                  if (range.endsWith('!A:A')) {
                    return {
                      result: { values: [['Date'], ['2025-10-15'], ['2025-10-14']] },
                    };
                  }
                  return {
                    result: {
                      values: [
                        ['2025-10-15', 'Coffee', 'Food', '4.50'],
                        ['2025-10-14', 'Bus Ticket', 'Transportation', '2.50'],
                      ],
                    },
                  };
                },
              },
            },
          },
        },
      };
    });

    await page.goto('/');

    // Should show logged-in view directly because we are already logged in
    await expect(page.locator('#logged-in-view')).toBeVisible();

    // Spreadsheet title should be fetched and rendered
    await expect(page.locator('#spreadsheet-title')).toHaveText(
      'Sheet: Mock Spreadsheet Title / Expenses'
    );

    // Expense list should be populated with mocked values (reversed newest first)
    const listItems = page.locator('#transaction-list li');
    await expect(listItems).toHaveCount(2);
    await expect(listItems.nth(0)).toHaveText('2025-10-14 - Bus Ticket - Transportation - 2.50');
    await expect(listItems.nth(1)).toHaveText('2025-10-15 - Coffee - Food - 4.50');
  });

  test('should create expense online', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('selected_spreadsheet_id', 'mock-sheet-id');
      window.localStorage.setItem('selected_sheet_name', 'Expenses');
      window.localStorage.setItem(
        'gapi_token',
        JSON.stringify({
          access_token: 'mock-token-123',
          expires_in: 3600,
          expirationTime: Date.now() + 3600000,
        })
      );

      (window as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: () => ({ requestAccessToken: () => {} }),
          },
        },
      };

      (window as any).gapi = {
        load: (lib: string, cb: () => void) => cb(),
        client: {
          init: () => Promise.resolve(),
          setToken: () => {},
          sheets: {
            spreadsheets: {
              get: async () => ({
                result: { properties: { title: 'Mock Spreadsheet Title' } },
              }),
              values: {
                get: async ({ range }: { range: string }) => {
                  if (range.endsWith('!A:A')) {
                    return { result: { values: [['Date']] } };
                  }
                  return { result: { values: [] } };
                },
                append: async (req: any) => {
                  (window as any).addExpenseCalled = true;
                  (window as any).appendedValues = req.resource.values[0];
                  return { result: { updates: { updatedRows: 1 } } };
                },
              },
            },
          },
        },
      };
    });

    await page.goto('/');
    await expect(page.locator('#logged-in-view')).toBeVisible();

    // Fill form
    await page.fill('#expense-date', '2025-10-16');
    await page.fill('#expense-name', 'Dinner');
    await page.selectOption('#expense-category', 'Food');
    await page.fill('#expense-price', '42.50');

    // Click submit
    await page.click('button[type="submit"]');

    // Verify it added in UI
    const listItems = page.locator('#transaction-list li');
    await expect(listItems.first()).toHaveText('2025-10-16 - Dinner - Food - 42.50');

    // Verify backend call was mocked and triggered
    const isCalled = await page.evaluate(() => (window as any).addExpenseCalled);
    const values = await page.evaluate(() => (window as any).appendedValues);
    expect(isCalled).toBe(true);
    expect(values).toEqual(['2025-10-16', 'Dinner', 'Food', '42.50']);
  });

  test('should queue expense offline and sync when going back online', async ({
    page,
    context,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('selected_spreadsheet_id', 'mock-sheet-id');
      window.localStorage.setItem('selected_sheet_name', 'Expenses');
      window.localStorage.setItem(
        'gapi_token',
        JSON.stringify({
          access_token: 'mock-token-123',
          expires_in: 3600,
          expirationTime: Date.now() + 3600000,
        })
      );

      (window as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: () => ({ requestAccessToken: () => {} }),
          },
        },
      };

      const mockDatabase: any[][] = [];

      (window as any).gapi = {
        load: (lib: string, cb: () => void) => cb(),
        client: {
          init: () => Promise.resolve(),
          setToken: () => {},
          sheets: {
            spreadsheets: {
              get: async () => ({
                result: { properties: { title: 'Mock Spreadsheet Title' } },
              }),
              values: {
                get: async ({ range }: { range: string }) => {
                  if (range.endsWith('!A:A')) {
                    return {
                      result: { values: [['Date'], ...mockDatabase.map((row) => [row[0]])] },
                    };
                  }
                  return {
                    result: { values: mockDatabase },
                  };
                },
                append: async (req: any) => {
                  (window as any).addExpenseCalled = true;
                  const newRow = req.resource.values[0];
                  (window as any).appendedValues = newRow;
                  mockDatabase.push(newRow);
                  return { result: { updates: { updatedRows: 1 } } };
                },
              },
            },
          },
        },
      };
    });

    await page.goto('/');
    await expect(page.locator('#logged-in-view')).toBeVisible();

    // Go offline
    await context.setOffline(true);
    // Trigger offline event
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.locator('#offline-indicator')).toBeVisible();

    // Add expense offline
    await page.fill('#expense-date', '2025-10-17');
    await page.fill('#expense-name', 'Train Ticket');
    await page.selectOption('#expense-category', 'Transportation');
    await page.fill('#expense-price', '12.00');
    await page.click('button[type="submit"]');

    // Verify it is labeled as "Not Synced" in the UI
    const listItems = page.locator('#transaction-list li');
    await expect(listItems.first()).toHaveText(
      '2025-10-17 - Train Ticket - Transportation - 12.00 (Not Synced)'
    );

    // Verify stored in localStorage
    const pendingExpenses = await page.evaluate(() =>
      window.localStorage.getItem('pending-expenses')
    );
    expect(JSON.parse(pendingExpenses || '[]')).toEqual([
      { date: '2025-10-17', name: 'Train Ticket', category: 'Transportation', price: '12.00' },
    ]);

    // Reconnect online
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.locator('#offline-indicator')).not.toBeVisible();

    // Verify it has synced (remove Not Synced label)
    await expect(listItems.first()).toHaveText('2025-10-17 - Train Ticket - Transportation - 12.00');

    // Verify append was called
    const isCalled = await page.evaluate(() => (window as any).addExpenseCalled);
    const values = await page.evaluate(() => (window as any).appendedValues);
    expect(isCalled).toBe(true);
    expect(values).toEqual(['2025-10-17', 'Train Ticket', 'Transportation', '12.00']);
  });

  test('should delete an offline/pending expense', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('selected_spreadsheet_id', 'mock-sheet-id');
      window.localStorage.setItem('selected_sheet_name', 'Expenses');
      window.localStorage.setItem(
        'gapi_token',
        JSON.stringify({
          access_token: 'mock-token-123',
          expires_in: 3600,
          expirationTime: Date.now() + 3600000,
        })
      );
      window.localStorage.setItem(
        'pending-expenses',
        JSON.stringify([
          { date: '2025-10-17', name: 'Train Ticket', category: 'Transportation', price: '12.00' },
        ])
      );

      (window as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: () => ({ requestAccessToken: () => {} }),
          },
        },
      };

      (window as any).gapi = {
        load: (lib: string, cb: () => void) => cb(),
        client: {
          init: () => Promise.resolve(),
          setToken: () => {},
          sheets: {
            spreadsheets: {
              get: async () => ({
                result: { properties: { title: 'Mock Spreadsheet Title' } },
              }),
              values: {
                get: async () => ({ result: { values: [] } }),
              },
            },
          },
        },
      };
    });

    await page.goto('/');
    await expect(page.locator('#logged-in-view')).toBeVisible();

    const listItems = page.locator('#transaction-list li');
    await expect(listItems).toHaveCount(1);
    await expect(listItems.first()).toContainText('Train Ticket');

    // Click delete button on the pending expense
    await listItems.first().locator('.delete-btn').click();

    // Verify localStorage pending-expenses is empty
    const pendingExpenses = await page.evaluate(() =>
      window.localStorage.getItem('pending-expenses')
    );
    expect(JSON.parse(pendingExpenses || '[]')).toEqual([]);

    // Verify UI updated
    await expect(page.locator('#transaction-list li')).toHaveText('No expenses found.');
  });

  test('should delete a synced expense via Google Sheets API', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('selected_spreadsheet_id', 'mock-sheet-id');
      window.localStorage.setItem('selected_sheet_name', 'Expenses');
      window.localStorage.setItem(
        'gapi_token',
        JSON.stringify({
          access_token: 'mock-token-123',
          expires_in: 3600,
          expirationTime: Date.now() + 3600000,
        })
      );

      const mockDatabase = [
        ['2025-10-15', 'Coffee', 'Food', '4.50'],
      ];

      (window as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: () => ({ requestAccessToken: () => {} }),
          },
        },
      };

      (window as any).gapi = {
        load: (lib: string, cb: () => void) => cb(),
        client: {
          init: () => Promise.resolve(),
          setToken: () => {},
          sheets: {
            spreadsheets: {
              get: async () => ({
                result: {
                  properties: { title: 'Mock Spreadsheet Title' },
                  sheets: [{ properties: { sheetId: 0, title: 'Expenses' } }],
                },
              }),
              values: {
                get: async ({ range }: { range: string }) => {
                  if (range.endsWith('!A:A')) {
                    return {
                      result: { values: [['Date'], ...mockDatabase.map((r) => [r[0]])] },
                    };
                  }
                  return {
                    result: { values: mockDatabase },
                  };
                },
              },
              batchUpdate: async (req: any) => {
                (window as any).batchUpdateCalled = true;
                (window as any).batchUpdateReq = req;
                mockDatabase.pop();
                return { result: { replies: [{}] } };
              },
            },
          },
        },
      };
    });

    await page.goto('/');
    await expect(page.locator('#logged-in-view')).toBeVisible();

    const listItems = page.locator('#transaction-list li');
    await expect(listItems).toHaveCount(1);
    await expect(listItems.first()).toContainText('Coffee');

    // Click delete
    await listItems.first().locator('.delete-btn').click();

    // Verify batchUpdate called with deleteDimension
    const isCalled = await page.evaluate(() => (window as any).batchUpdateCalled);
    const req = await page.evaluate(() => (window as any).batchUpdateReq);
    expect(isCalled).toBe(true);
    expect(req.resource.requests[0].deleteDimension).toEqual({
      range: {
        sheetId: 0,
        dimension: 'ROWS',
        startIndex: 1,
        endIndex: 2,
      },
    });

    // Verify UI updated to no expenses found
    await expect(page.locator('#transaction-list li')).toHaveText('No expenses found.');
  });
});
