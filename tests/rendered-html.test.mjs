import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the market dashboard and AI research entry point", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Market Memo · AI 美股市場研究/);
  assert.match(html, /美股市場寬度儀表板/);
  assert.match(html, /AI MARKET RESEARCH/);
  assert.match(html, /從 FOMC 原文找答案/);
  assert.match(html, /開始研究/);
  assert.match(html, /HYBRID SEARCH/);
  assert.match(html, /S&amp;P 500/);
  assert.match(html, /QQQ/);
});
