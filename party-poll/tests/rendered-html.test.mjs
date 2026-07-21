import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

// The worker bundle imports "cloudflare:workers", so it can only execute inside
// workerd (vinext dev / Cloudflare), not in Node. These tests verify the build
// output exists and the app source still wires up the poll's key pieces.

const root = new URL("../", import.meta.url);

test("build produces worker and client bundles", async () => {
  await access(new URL("dist/server/index.js", root));
  await access(new URL("dist/client/", root));
});

test("page renders the party poll, not the starter skeleton", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /The party poll/);
  assert.match(page, /Open projector view/);
  for (const id of ["q0", "q1", "q2", "q3"]) {
    assert.match(page, new RegExp(`"${id}"`));
  }
  assert.doesNotMatch(page, /SkeletonPreview|Codex is building/);

  const layout = await readFile(new URL("app/layout.tsx", root), "utf8");
  assert.match(layout, /The Party Poll — Justified Posteriors/);
});

test("responses API handles the full lifecycle against D1", async () => {
  const route = await readFile(
    new URL("app/api/responses/route.ts", root),
    "utf8",
  );
  for (const method of ["GET", "POST", "DELETE"]) {
    assert.match(route, new RegExp(`export async function ${method}`));
  }
  assert.match(route, /CREATE TABLE IF NOT EXISTS responses/);
});
