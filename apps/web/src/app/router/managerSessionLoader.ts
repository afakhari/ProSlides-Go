import type { LoaderFunctionArgs } from "react-router-dom";
import { redirect } from "react-router-dom";

import { queryClient } from "../providers/queryClient.ts";
import { currentSessionQuery } from "../../modules/identity/api/sessionQuery.ts";
import { ApiError } from "../../shared/api/http.ts";

const loginRedirect = (request: Request): string => {
  const url = new URL(request.url);
  const from = `${url.pathname}${url.search}`;
  const params = new URLSearchParams({ from });
  return `/auth?${params.toString()}`;
};

export async function requireManagerSession({
  request,
}: LoaderFunctionArgs) {
  try {
    return await queryClient.ensureQueryData(currentSessionQuery());
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw redirect(loginRedirect(request));
    }

    throw error;
  }
}
