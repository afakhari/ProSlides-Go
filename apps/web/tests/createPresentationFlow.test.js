import assert from "node:assert/strict";
import test from "node:test";

import { createPresentationOnce } from "../src/modules/presentations/model/createPresentationFlow.ts";

test("presentation creation ignores a duplicate activation and navigates once", async () => {
  const gate = { current: false };
  const calls = [];
  let resolveCreate;
  const create = (title) => {
    calls.push(title);
    return new Promise((resolve) => {
      resolveCreate = resolve;
    });
  };
  const navigations = [];

  const first = createPresentationOnce({
    gate,
    create,
    navigate: (id) => navigations.push(id),
  });
  const duplicate = await createPresentationOnce({
    gate,
    create,
    navigate: (id) => navigations.push(id),
  });

  assert.equal(duplicate, null);
  assert.deepEqual(calls, ["ارائه بدون عنوان"]);
  resolveCreate({ id: "presentation-1" });
  assert.equal(await first, "presentation-1");
  assert.deepEqual(navigations, ["presentation-1"]);
  assert.equal(gate.current, false);
});

test("failed creation does not navigate and releases the retry gate", async () => {
  const gate = { current: false };
  const navigations = [];

  await assert.rejects(
    createPresentationOnce({
      gate,
      create: async () => {
        throw new Error("offline");
      },
      navigate: (id) => navigations.push(id),
    }),
    /offline/,
  );

  assert.deepEqual(navigations, []);
  assert.equal(gate.current, false);
});
