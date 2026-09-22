import { queryOptions } from "@tanstack/react-query";

import { quizService } from "./presentationRepository.ts";

export const presentationKeys = {
  root: ["presentations"] as const,
  list: () => [...presentationKeys.root, "list"] as const,
  detail: (presentationId: string) =>
    [...presentationKeys.root, "detail", presentationId] as const,
};

export const presentationListQuery = () =>
  queryOptions({
    queryKey: presentationKeys.list(),
    queryFn: ({ signal }) => quizService.listPresentations({ signal }),
    staleTime: 30_000,
  });
