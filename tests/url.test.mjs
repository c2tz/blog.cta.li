import assert from "node:assert/strict";
import test from "node:test";

import { fileNameFromURL as fileNameForBlogImage } from "../src/assets/js/app/url.js";
import { fileNameFromURL as fileNameForImagePreview } from "../src/assets/js/app/image-preview/support.js";

const BASE_URL = "https://ct-blog.cta.li/posts/example/";

test("fileNameFromURL decodes regular and Astro image-service URLs", () => {
  assert.equal(fileNameForBlogImage("../../images/photo%20test.webp", BASE_URL), "photo test.webp");
  assert.equal(
    fileNameForBlogImage("/_image?href=%2Fimages%2Fphoto.webp%3Fv%3D1", BASE_URL),
    "photo.webp",
  );
  assert.equal(fileNameForImagePreview("/images/photo.webp", BASE_URL), "photo.webp");
});

test("fileNameFromURL preserves each caller's trailing-slash fallback", () => {
  assert.equal(fileNameForBlogImage("/images/gallery/", BASE_URL), "image");
  assert.equal(fileNameForImagePreview("/images/gallery/", BASE_URL), "gallery");
  assert.equal(fileNameForBlogImage("/", BASE_URL), "image");
  assert.equal(fileNameForImagePreview("/", BASE_URL), "image");
});
