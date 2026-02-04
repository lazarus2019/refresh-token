import { QueryClient } from "@tanstack/react-query";

const MINUTE = 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * MINUTE,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export { queryClient };
