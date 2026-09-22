import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ApiError } from "../../shared/api/http.ts";

const shouldRetryQuery = (failureCount: number, error: unknown) => {
  if (failureCount >= 2) return false;
  if (!(error instanceof ApiError)) return true;
  if ([400, 401, 403, 404, 409, 422, 429].includes(error.status)) return false;
  return error.status >= 500;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export default function AppQueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
