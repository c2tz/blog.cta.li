import assert from "node:assert/strict";
import test from "node:test";

import {
  assertKonachanImageMimeType,
  assertKonachanJsonMimeType,
  fetchKonachanResource,
  mapWithConcurrency,
  readResponseBodyLimited,
  validateKonachanUrl,
} from "../src/lib/konachan-network.mjs";

test("allows only explicit HTTPS Konachan API and image hosts", () => {
  assert.equal(
    validateKonachanUrl("https://konachan.com/post.json?page=1", "api").origin,
    "https://konachan.com",
  );
  assert.equal(
    validateKonachanUrl("https://img.konachan.net/jpeg/example.jpg", "image").hostname,
    "img.konachan.net",
  );

  for (const [url, resource] of [
    ["http://konachan.com/post.json", "api"],
    ["https://api.konachan.com/post.json", "api"],
    ["https://konachan.com/help/api", "api"],
    ["https://konachan.com.evil.example/image.jpg", "image"],
    ["https://user:password@konachan.net/image.jpg", "image"],
    ["https://konachan.net:444/image.jpg", "image"],
    ["data:image/png;base64,AAAA", "image"],
  ]) {
    assert.throws(() => validateKonachanUrl(url, resource), /Rejected|Invalid/);
  }
});

test("retries throttled requests without enabling redirects", async () => {
  const requests = [];
  const delays = [];
  let call = 0;

  const response = await fetchKonachanResource("https://konachan.com/jpeg/example.jpg", {
    resource: "image",
    fetchImpl: async (url, options) => {
      call += 1;
      requests.push({ url: url.toString(), options });

      if (call === 1) {
        return new Response(null, {
          status: 429,
          headers: { "retry-after": "0.01" },
        });
      }
      return new Response(Uint8Array.of(1, 2, 3), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    },
    sleep: async (milliseconds) => delays.push(milliseconds),
  });

  assert.equal(response.status, 200);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.redirect, "manual");
  assert.equal(requests[1].url, "https://konachan.com/jpeg/example.jpg");
  assert.deepEqual(delays, [10]);
});

test("rejects every redirect response, including allowlisted destinations", async () => {
  for (const status of [300, 301, 302, 303, 304, 305, 306, 307, 308, 399]) {
    for (const location of [
      "https://img.konachan.com/jpeg/example.jpg",
      "https://example.com/escaped.jpg",
    ]) {
      await assert.rejects(
        fetchKonachanResource("https://konachan.com/jpeg/example.jpg", {
          resource: "image",
          fetchImpl: async () => new Response(null, { status, headers: { location } }),
          sleep: async () => {},
        }),
        { code: "konachan_redirect_rejected" },
      );
    }
  }
});

test("retries every 5xx response class with exponential backoff", async () => {
  const delays = [];
  let call = 0;

  const response = await fetchKonachanResource("https://konachan.net/jpeg/example.jpg", {
    resource: "image",
    fetchImpl: async () => {
      call += 1;
      return call === 1
        ? new Response(null, { status: 521 })
        : new Response(Uint8Array.of(1), {
            status: 200,
            headers: { "content-type": "image/jpeg" },
          });
    },
    sleep: async (milliseconds) => delays.push(milliseconds),
  });

  assert.equal(response.status, 200);
  assert.equal(call, 2);
  assert.deepEqual(delays, [500]);
});

test("validates MIME types and enforces declared and streamed body limits", async () => {
  const imageResponse = new Response(Uint8Array.of(1, 2, 3), {
    headers: { "content-type": "image/jpeg; charset=binary" },
  });
  assert.equal(assertKonachanImageMimeType(imageResponse), "image/jpeg");
  assert.throws(
    () =>
      assertKonachanImageMimeType(
        new Response("<html></html>", { headers: { "content-type": "text/html" } }),
      ),
    { code: "konachan_invalid_image_mime" },
  );
  assert.equal(
    assertKonachanJsonMimeType(
      new Response("[]", { headers: { "content-type": "application/json; charset=utf-8" } }),
    ),
    "application/json",
  );

  await assert.rejects(
    readResponseBodyLimited(new Response(null, { headers: { "content-length": "9" } }), 8),
    { code: "konachan_response_too_large" },
  );
  await assert.rejects(
    readResponseBodyLimited(new Response(Uint8Array.from({ length: 9 }, (_, index) => index)), 8),
    { code: "konachan_response_too_large" },
  );

  const bytes = await readResponseBodyLimited(new Response(Uint8Array.of(1, 2, 3, 4)), 4);
  assert.deepEqual([...bytes], [1, 2, 3, 4]);
});

test("caps concurrent Konachan work without reordering results", async () => {
  let active = 0;
  let maxActive = 0;
  const values = Array.from({ length: 12 }, (_, index) => index);

  const results = await mapWithConcurrency(values, 3, async (value) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    active -= 1;
    return value * 2;
  });

  assert.equal(maxActive, 3);
  assert.deepEqual(
    results,
    values.map((value) => value * 2),
  );
});
