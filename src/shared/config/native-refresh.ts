// Global state for refresh token management
class AuthTokenManager {
  private static isRefreshing = false;
  private static failedQueue: Array<{
    resolve: (value: Response) => void;
    reject: (reason?: any) => void;
  }> = [];

  static processQueue(error: any, token: string | null = null): void {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else if (token) {
        resolve(new Response('OK')); // Dummy response to unblock queue
      }
    });
    this.failedQueue = [];
  }

  static async refreshToken(): Promise<void> {
    const refreshUrl = '/api/auth/refresh';
    
    try {
      const response = await fetch(refreshUrl, {
        method: 'POST',
        credentials: 'include', // Include HTTP-only cookies
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }

      // Server sets new access token cookie automatically
      return;
    } catch (error) {
      // Clear any client state
      localStorage.removeItem('user');
      window.location.href = '/forbidden';
      throw error;
    }
  }

  /**
   * Enhanced fetch wrapper with automatic token refresh
   */
  static async authenticatedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const request = new Request(input, {
      credentials: 'include', // Essential for HTTP-only cookies
      ...init,
    });

    // Mark refresh requests to avoid infinite loops
    const url = request.url;
    const isRefreshRequest = url.includes('/api/auth/refresh');
    request.headers.set('X-Is-Refresh-Request', isRefreshRequest ? 'true' : 'false');

    try {
      const response = await fetch(request);

      // Handle non-401 errors immediately
      if (response.status !== 401) {
        return response;
      }

      // Skip refresh logic for refresh requests themselves
      if (isRefreshRequest) {
        localStorage.removeItem('user');
        window.location.href = '/forbidden';
        throw new Error('Refresh token invalid');
      }

      // Check for invalid/expired token specific errors
      const contentType = response.headers.get('content-type');
      let errorData: any = null;
      
      if (contentType?.includes('application/json')) {
        errorData = await response.json();
      }

      const isInvalidTokenError =
        response.status === 401 ||
        errorData?.message?.includes('invalid token') ||
        errorData?.message?.includes('expired token');

      if (!isInvalidTokenError) {
        return response;
      }

      // Deduplication: Queue if refresh already in progress
      if (this.isRefreshing) {
        return new Promise((resolve, reject) => {
          this.failedQueue.push({ resolve, reject });
        }).then(() => {
          // Retry with new cookie set by server
          return fetch(request);
        });
      }

      // Start refresh process
      this.isRefreshing = true;

      try {
        await this.refreshToken();
        
        // Process queued requests
        this.processQueue(null);

        // Retry original request (server reads new cookie)
        const retryResponse = await fetch(request);
        return retryResponse;
      } catch (refreshError) {
        this.processQueue(refreshError);
        throw refreshError;
      } finally {
        this.isRefreshing = false;
      }
    } catch (error) {
      throw error;
    }
  }
}

// Usage examples
const api = AuthTokenManager.authenticatedFetch;

// Example API calls
async function fetchUserProfile() {
  try {
    const response = await api('/api/user/profile');
    const data = await response.json();
    console.log('User profile:', data);
  } catch (error) {
    console.error('Failed to fetch profile:', error);
  }
}

async function fetchProtectedData() {
  try {
    const response = await api('/api/protected/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 123 }),
    });
    const data = await response.json();
    console.log('Protected data:', data);
  } catch (error) {
    console.error('Request failed:', error);
  }
}

// Multiple concurrent requests - only ONE refresh happens
async function testConcurrentRequests() {
  const promises = [
    api('/api/user/profile'),
    api('/api/user/settings'),
    api('/api/user/notifications'),
  ];

  try {
    const responses = await Promise.all(promises);
    responses.forEach(async (response, index) => {
      const data = await response.json();
      console.log(`Response ${index}:`, data);
    });
  } catch (error) {
    console.error('One of the requests failed:', error);
  }
}
