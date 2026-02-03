import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

// Store to track if refresh is in progress
let isRefreshing = false;
const failedQueue: Array<{ 
  resolve: (value: any) => void; 
  reject: (reason?: any) => void 
}> = [];

const processQueue = <T = any>(
  error: AxiosError<T>,
  token: string | null = null
): void => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else if (token) {
      resolve(token);
    }
  });
  failedQueue = [];
};

// Refresh token endpoint (server reads refresh token from HTTP-only cookie)
const refreshToken = async (): Promise<string | null> => {
  try {
    // Server automatically reads refresh token from HTTP-only cookie
    const response = await axios.post('/api/auth/refresh');
    const newToken = response.data.accessToken;
    
    if (newToken) {
      // Server will set new access token as HTTP-only cookie
      return newToken;
    }
    return null;
  } catch (error) {
    // Clear any client-side state if needed
    localStorage.removeItem('user'); // or whatever you store
    window.location.href = '/forbidden';
    return null;
  }
};

export const createAuthenticatedAxiosInstance = (baseURL: string): AxiosInstance => {
  const instance = axios.create({
    baseURL,
    timeout: 10000,
    withCredentials: true, // IMPORTANT: Include cookies with requests
  });

  // Response interceptor
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as AxiosRequestConfig & { 
        _retry?: boolean;
        _isRefreshRequest?: boolean;
      };

      // Skip refresh logic for refresh requests themselves
      if (originalRequest._isRefreshRequest) {
        localStorage.removeItem('user');
        window.location.href = '/forbidden';
        return Promise.reject(error);
      }

      // Handle non-401 errors immediately
      if (!error.response?.status || error.response.status !== 401) {
        return Promise.reject(error);
      }

      // Check for invalid/expired token specific errors
      const isInvalidTokenError = 
        error.response.status === 401 ||
        error.response.data?.message?.includes('invalid token') ||
        error.response.data?.message?.includes('expired token');

      if (!isInvalidTokenError || originalRequest._retry) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue the request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
        .then(() => {
          // Retry with new cookie set by server
          return instance(originalRequest);
        })
        .catch((err) => Promise.reject(err));
      }

      // Start refresh process
      isRefreshing = true;
      originalRequest._retry = true;

      try {
        await refreshToken(); // Server sets new access token cookie
        
        // Process queued requests (server will include new cookie)
        processQueue(null);

        // Retry original request (server reads new cookie automatically)
        return instance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
  );

  return instance;
};

// Usage - NO request interceptor needed
const api = createAuthenticatedAxiosInstance('https://api.example.com');

// All requests automatically include cookies via withCredentials: true
api.get('/protected-endpoint')
  .then(response => console.log(response.data))
  .catch(error => console.error('Request failed:', error));
