import { expect, test, gotoRoute, waitForAppReady } from "./site-fixture";

test("opens the MIT license as inline text without starting page navigation", async ({ page }) => {
  await gotoRoute(page, "/");
  await waitForAppReady(page);

  const licenseLink = page.getByRole("link", { name: "MIT License" });
  const pageProgress = page.locator("md-circular-progress.site-page-loading-progress");
  await expect(licenseLink).toHaveAttribute("href", "/LICENSE.txt");
  await expect(licenseLink).toHaveAttribute("target", "_blank");
  await expect(licenseLink).toHaveAttribute("rel", /\bnoopener\b/);
  await expect(licenseLink).toHaveAttribute("rel", /\bnoreferrer\b/);

  const [licensePage, response] = await Promise.all([
    page.waitForEvent("popup"),
    page
      .context()
      .waitForEvent(
        "response",
        (candidate) => new URL(candidate.url()).pathname === "/LICENSE.txt",
      ),
    licenseLink.click(),
  ]);

  expect(response.headers()["content-type"]).toContain("text/plain");
  expect(response.headers()["content-disposition"] ?? "").not.toContain("attachment");
  await expect(licensePage.locator("body")).toContainText("MIT License");
  await expect(licensePage.locator("body")).toContainText("Copyright (c) 2025 c2tz");
  await page.waitForTimeout(300);
  await expect(pageProgress).toHaveCount(0);
  await licensePage.close();
});
