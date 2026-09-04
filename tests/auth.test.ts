import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initGoogleAuth, signIn, getUserInfo } from '../js/auth';

describe('auth.ts unit tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('initGoogleAuth & signIn', () => {
    it('should initialize token client with correct options', () => {
      const mockRequestAccessToken = vi.fn();
      const mockInitTokenClient = vi.fn().mockReturnValue({
        requestAccessToken: mockRequestAccessToken,
      });

      (global as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: mockInitTokenClient,
          },
        },
      };

      const callback = vi.fn();
      initGoogleAuth(callback, 'user@example.com');

      expect(mockInitTokenClient).toHaveBeenCalledWith({
        client_id: expect.any(String),
        scope: 'openid email https://www.googleapis.com/auth/spreadsheets',
        prompt: '',
        login_hint: 'user@example.com',
        callback: callback,
      });

      signIn();
      expect(mockRequestAccessToken).toHaveBeenCalled();
    });
  });

  describe('getUserInfo', () => {
    it('should fetch user info and return user email', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ email: 'test@example.com' }),
      });
      global.fetch = mockFetch;

      const res = await getUserInfo('dummy-access-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: {
            Authorization: 'Bearer dummy-access-token',
          },
        }
      );
      expect(res).toEqual({ email: 'test@example.com' });
    });

    it('should throw an error when fetch fails with non-ok status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
      });
      global.fetch = mockFetch;

      await expect(getUserInfo('invalid-token')).rejects.toThrow(
        'Failed to fetch user info: Unauthorized'
      );
    });
  });
});
