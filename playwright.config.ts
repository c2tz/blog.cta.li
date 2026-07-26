import { defineConfig, devices } from "@playwright/test";

const PORT = 4322;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const reuseExistingBuild = process.env.PLAYWRIGHT_REUSE_BUILD === "1";
const nightly = process.env.PLAYWRIGHT_NIGHTLY === "1";
const firefoxNightlyTestMatch = /(?:image-preview-(?:core|interactions)|site-resilience)\.spec\.ts/;
const webkitPullRequestTestMatch =
  /(?:image-preview-(?:core|interactions)|site-(?:archive|consent|content|giscus|navigation|rendering|search))\.spec\.ts/;

// The standard Chromium lane is dimension-based instead of repeating every
// logical test through the full theme/viewport cross-product:
// - desktop-light owns every non-nightly spec;
// - desktop-dark retains specs with explicit light/dark assertions;
// - mobile-light retains responsive, touch and mobile-critical paths;
// - mobile-dark retains the dedicated home/theme and rendering cross-product.
// WebKit remains unchanged below for every targeted desktop/mobile and
// light/dark combination. Resilience is nightly-only by contract in its spec.
const chromiumDesktopLightTestMatch = /\.spec\.ts/;
const chromiumStandardTestIgnore = /site-resilience\.spec\.ts/;
const chromiumDesktopDarkTestMatch = /site-(?:consent-ui|content|home-theme|rendering)\.spec\.ts/;
const chromiumMobileLightTestMatch =
  /(?:image-preview-(?:core|interactions)|site-(?:archive|consent|content|giscus|home-theme|navigation|rendering|search|tooltips))\.spec\.ts/;
const chromiumMobileDarkTestMatch = /site-(?:home-theme|rendering)\.spec\.ts/;

const nightlyProjects = nightly
  ? [
      {
        name: "firefox-nightly-desktop-light",
        testMatch: firefoxNightlyTestMatch,
        use: {
          ...devices["Desktop Firefox"],
          browserName: "firefox" as const,
          colorScheme: "light" as const,
          viewport: { width: 1440, height: 1100 },
        },
      },
      {
        name: "firefox-nightly-desktop-dark",
        testMatch: firefoxNightlyTestMatch,
        use: {
          ...devices["Desktop Firefox"],
          browserName: "firefox" as const,
          colorScheme: "dark" as const,
          viewport: { width: 1440, height: 1100 },
        },
      },
      // Firefox has no phone engine. This keeps its real engine while exercising
      // the site's phone-sized, coarse-pointer responsive behavior.
      {
        name: "firefox-nightly-mobile-light",
        testMatch: firefoxNightlyTestMatch,
        use: {
          browserName: "firefox" as const,
          colorScheme: "light" as const,
          deviceScaleFactor: 2,
          hasTouch: true,
          screen: { width: 390, height: 844 },
          viewport: { width: 390, height: 664 },
        },
      },
      {
        name: "firefox-nightly-mobile-dark",
        testMatch: firefoxNightlyTestMatch,
        use: {
          browserName: "firefox" as const,
          colorScheme: "dark" as const,
          deviceScaleFactor: 2,
          hasTouch: true,
          screen: { width: 390, height: 844 },
          viewport: { width: 390, height: 664 },
        },
      },
      {
        name: "webkit-nightly-desktop-light",
        use: {
          ...devices["Desktop Safari"],
          colorScheme: "light" as const,
          viewport: { width: 1440, height: 1100 },
        },
      },
      {
        name: "webkit-nightly-desktop-dark",
        use: {
          ...devices["Desktop Safari"],
          colorScheme: "dark" as const,
          viewport: { width: 1440, height: 1100 },
        },
      },
      {
        name: "webkit-nightly-mobile-light",
        use: {
          ...devices["iPhone 14"],
          browserName: "webkit" as const,
          colorScheme: "light" as const,
        },
      },
      {
        name: "webkit-nightly-mobile-dark",
        use: {
          ...devices["iPhone 14"],
          browserName: "webkit" as const,
          colorScheme: "dark" as const,
        },
      },
    ]
  : [];

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || "test-results",
  reporter: nightly
    ? [
        ["list"],
        [
          "html",
          {
            open: "never",
            outputFolder: process.env.PLAYWRIGHT_HTML_OUTPUT_DIR || "playwright-report",
          },
        ],
      ]
    : [["list"]],
  retries: nightly ? 1 : 0,
  timeout: 30_000,
  expect: {
    timeout: 7_000,
  },
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: nightly ? "retain-on-failure" : "off",
  },
  webServer: {
    command: reuseExistingBuild ? "pnpm preview:local" : "pnpm build && pnpm preview:local",
    url: BASE_URL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop-light",
      testMatch: chromiumDesktopLightTestMatch,
      testIgnore: chromiumStandardTestIgnore,
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "light",
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: "desktop-dark",
      testMatch: chromiumDesktopDarkTestMatch,
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "dark",
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: "mobile-light",
      testMatch: chromiumMobileLightTestMatch,
      use: {
        ...devices["iPhone 14"],
        browserName: "chromium",
        colorScheme: "light",
      },
    },
    {
      name: "mobile-dark",
      testMatch: chromiumMobileDarkTestMatch,
      use: {
        ...devices["iPhone 14"],
        browserName: "chromium",
        colorScheme: "dark",
      },
    },
    {
      name: "webkit-desktop-light",
      testMatch: webkitPullRequestTestMatch,
      use: {
        ...devices["Desktop Safari"],
        colorScheme: "light",
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: "webkit-desktop-dark",
      testMatch: webkitPullRequestTestMatch,
      use: {
        ...devices["Desktop Safari"],
        colorScheme: "dark",
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: "webkit-mobile-light",
      testMatch: webkitPullRequestTestMatch,
      use: {
        ...devices["iPhone 14"],
        browserName: "webkit",
        colorScheme: "light",
      },
    },
    {
      name: "webkit-mobile-dark",
      testMatch: webkitPullRequestTestMatch,
      use: {
        ...devices["iPhone 14"],
        browserName: "webkit",
        colorScheme: "dark",
      },
    },
    ...nightlyProjects,
  ],
});
