import { queryOptions } from "@tanstack/react-query";

import { identityApi } from "./identityApi.ts";

export const identityKeys = {
  all: ["identity"] as const,
  session: () => ["identity", "session"] as const,
};

export const currentSessionQuery = () =>
  queryOptions({
    queryKey: identityKeys.session(),
    queryFn: ({ signal }) => identityApi.getCurrentUser({ signal }),
    staleTime: 30_000,
  });
