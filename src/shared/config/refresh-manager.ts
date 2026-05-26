import type { NavigateFn } from "@tanstack/react-router";
import {
  type AxiosError,
  HttpStatusCode,
  type InternalAxiosRequestConfig,
  isAxiosError,
} from "axios";

interface PendingEntry {
  resolve: () => void;
  reject: (err: unknown) => void;
}
interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}
interface ValidAxiosError extends AxiosError {
  config: RetryConfig & { url: string; };
}
class RefreshManager {
  private isRefreshing: boolean = false;
  private pendingRequests: PendingEntry[] = [];

  private waitForRefresh(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.push({ resolve, reject });
    });
  }

  private releaseRequests(): void {
    for (const { resolve } of this.pendingRequests) {
      resolve();
    }
    this.pendingRequests = [];
  }

  private rejectRequests(): void {
    for (const { reject } of this.pendingRequests) {
      reject(new Error("Request rejected"));
    }
    this.pendingRequests = [];
  }

  public async refreshToken(): Promise<void> {
    if (this.isRefreshing) {
      return this.waitForRefresh();
    }

    this.isRefreshing = true;

    try {
      await refreshTokenApi();
      this.releaseRequests();
    } catch (error) {
      removeItemLocalStorage(LOCAL_STORAGE.shouldRefresh.key);
      this.rejectRequests();
      await login();
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }
}

const refreshManager = new RefreshManager();

const refreshTokenURL =
  "/api/v1/auth/refresh-token";

const isAxiosErrorContainUrl = (error: unknown): error is ValidAxiosError =>
  Boolean(
    isAxiosError(error)
      && error.config
      && error.config.url,
  );

const shouldAttemptRefresh = (error: ValidAxiosError): boolean => {
  const isUnauthorized = error.response?.status === HttpStatusCode.Unauthorized;
  const isRefreshCall = error.config.url === refreshTokenURL;
  const alreadyRetried = error.config._retry === true;

  if (!isUnauthorized || isRefreshCall || alreadyRetried) {
    return false;
  }

  return true;
};

const handleResponseErrorInterceptor = async (
  error: unknown,
  navigate: NavigateFn,
) => {
  if (!isAxiosErrorContainUrl(error) || !shouldAttemptRefresh(error)) {
    throw error;
  }

  if (
    getItemLocalStorage(LOCAL_STORAGE.shouldRefresh.key)
      === LOCAL_STORAGE.shouldRefresh.value
  ) {
    const originalRequest = error.config;
    originalRequest._retry = true;

    try {
      await refreshManager.refreshToken();
      return client.instance(originalRequest);
    } catch (error) {
      // oxlint-disable-next-line unicorn/no-useless-promise-resolve-reject
      return Promise.reject(error);
    }
  }

  await navigate({
    to: ".",
  });
};

export { handleResponseErrorInterceptor };
