import assert from "node:assert/strict";
import test from "node:test";
import { parseVercelPreviewUrl } from "../scripts/lib/vercel-preview-url.mjs";

test("accepts only a single Vercel preview HTTPS origin", () => {
  assert.equal(
    parseVercelPreviewUrl("https://ct-blog-git-feature-c2tz.vercel.app").href,
    "https://ct-blog-git-feature-c2tz.vercel.app/",
  );
  assert.equal(
    parseVercelPreviewUrl("https://Preview-123.vercel.app/").href,
    "https://preview-123.vercel.app/",
  );
});

test("rejects untrusted deployment targets", () => {
  const invalidTargets = [
    undefined,
    "",
    " https://preview-123.vercel.app/",
    "http://preview-123.vercel.app/",
    "https://vercel.app/",
    "https://preview-123.vercel.app.evil.example/",
    "https://preview-123vercel.app/",
    "https://nested.preview-123.vercel.app/",
    "https://user@preview-123.vercel.app/",
    "https://preview-123.vercel.app:443/",
    "https://preview-123.vercel.app/path",
    "https://preview-123.vercel.app/?target=https://example.com",
    "https://preview-123.vercel.app/#fragment",
    "https://-preview.vercel.app/",
    "https://preview-.vercel.app/",
  ];

  for (const target of invalidTargets) {
    assert.throws(() => parseVercelPreviewUrl(target), TypeError, String(target));
  }
});
