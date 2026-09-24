import { requestJson } from "../../../shared/api/http.ts";
import type { Presentation } from "./types.ts";

export const getPresentationForLive = (
  presentationId: string,
  signal?: AbortSignal,
): Promise<Presentation> =>
  requestJson<Presentation>(
    `/presentations/${encodeURIComponent(presentationId)}`,
    { signal },
  );
