import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import {
  createMemoryRouter,
  RouterProvider,
} from "react-router-dom";
import { describe, expect, test } from "vitest";

import { identityKeys } from "../../src/modules/identity/api/sessionQuery.ts";
import PresentationDashboardRoute from "../../src/modules/presentations/dashboard/PresentationDashboard.tsx";
import { server } from "./server.ts";

const api = "http://localhost/api/v1";

const presentation = {
  id: "11111111-1111-4111-8111-111111111111",
  revision: 3,
  title: "جلسه هفتگی",
  access_code: "ROOM1",
  settings: {},
  slide_count: 6,
  participant_count: 12,
  created_at: "2026-09-01T08:00:00Z",
  updated_at: "2026-09-24T12:00:00Z",
};

const budgetPresentation = {
  ...presentation,
  id: "22222222-2222-4222-8222-222222222222",
  title: "بودجه پاییز",
  access_code: "BUDG1",
  slide_count: 4,
  participant_count: 7,
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

  queryClient.setQueryData(identityKeys.session(), {
    id: "manager-1",
    email: "manager@example.com",
    display_name: "مدیر آزمون",
  });

  const router = createMemoryRouter(
    [
      {
        path: "/manager/panel",
        element: <PresentationDashboardRoute />,
      },
      {
        path: "/manager/panel/:presentationId",
        element: <div data-testid="editor-route">ویرایشگر آزمایشی</div>,
      },
    ],
    { initialEntries: ["/manager/panel"] },
  );

  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { ...result, queryClient, router };
}

describe("PresentationDashboard API states", () => {
  test("shows a pending state and then renders the presentation list", async () => {
    server.use(
      http.get(`${api}/presentations`, async () => {
        await delay(60);
        return HttpResponse.json([presentation]);
      }),
    );

    renderDashboard();

    expect(
      screen.getByLabelText("در حال بارگذاری ارائه‌ها"),
    ).not.toBeNull();

    const titles = await screen.findAllByText("جلسه هفتگی");
    expect(titles.length).toBeGreaterThan(0);
    expect(
      screen.queryByText(
        "بارگذاری ارائه‌ها انجام نشد. اتصال خود را بررسی کنید و دوباره تلاش کنید.",
      ),
    ).toBeNull();
  });

  test("recovers from a list API error when the user retries", async () => {
    let requestCount = 0;
    server.use(
      http.get(`${api}/presentations`, () => {
        requestCount += 1;
        if (requestCount === 1) {
          return HttpResponse.json(
            { error: "service_unavailable" },
            { status: 503 },
          );
        }
        return HttpResponse.json([]);
      }),
    );

    renderDashboard();

    expect(
      await screen.findByText(
        "بارگذاری ارائه‌ها انجام نشد. اتصال خود را بررسی کنید و دوباره تلاش کنید.",
      ),
    ).not.toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "تلاش دوباره" }),
    );

    expect(
      await screen.findByText("اولین ارائه‌تان را بسازید"),
    ).not.toBeNull();
    expect(requestCount).toBe(2);
  });

  test("filters loaded presentations and restores the list on Escape", async () => {
    server.use(
      http.get(`${api}/presentations`, () =>
        HttpResponse.json([presentation, budgetPresentation]),
      ),
    );

    renderDashboard();

    expect((await screen.findAllByText("جلسه هفتگی")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("بودجه پاییز").length).toBeGreaterThan(0);

    const searchInputs = screen.getAllByRole("searchbox", {
      name: "جست‌وجوی ارائه‌ها",
    });
    const search = searchInputs[searchInputs.length - 1];
    await userEvent.type(search, "بودجه");

    expect(screen.queryByText("جلسه هفتگی")).toBeNull();
    expect(screen.getAllByText("بودجه پاییز").length).toBeGreaterThan(0);

    await userEvent.type(search, "{Escape}");

    expect((await screen.findAllByText("جلسه هفتگی")).length).toBeGreaterThan(0);
  });

  test("preserves a recoverable create error and navigates after retry succeeds", async () => {
    let createCount = 0;

    server.use(
      http.get(`${api}/presentations`, () => HttpResponse.json([])),
      http.post(`${api}/presentations`, () => {
        createCount += 1;
        if (createCount === 1) {
          return HttpResponse.json(
            { error: "service_unavailable" },
            { status: 503 },
          );
        }
        return HttpResponse.json({
          id: "33333333-3333-4333-8333-333333333333",
        });
      }),
    );

    renderDashboard();

    expect(
      await screen.findByText("اولین ارائه‌تان را بسازید"),
    ).not.toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "ارائه جدید" }),
    );

    expect(
      await screen.findByText(
        "ارائه ساخته نشد. اتصال خود را بررسی کنید و دوباره تلاش کنید.",
      ),
    ).not.toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "تلاش دوباره" }),
    );

    expect(await screen.findByTestId("editor-route")).not.toBeNull();
    expect(createCount).toBe(2);
  });
});
