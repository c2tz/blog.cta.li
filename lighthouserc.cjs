const { existsSync } = require("node:fs");
const { chromium } = require("@playwright/test");

const playwrightChromePath = chromium.executablePath();
if (!process.env.CHROME_PATH && existsSync(playwrightChromePath)) {
  process.env.CHROME_PATH = playwrightChromePath;
}

const categoryThreshold = (minScore) => [
  "error",
  {
    aggregationMethod: "pessimistic",
    minScore,
  },
];

const perfectCategory = categoryThreshold(1);
const performanceCategory = categoryThreshold(0.95);

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      staticDistDir: "./dist",
      url: ["http://localhost/"],
      settings: {
        chromeFlags: "--headless=new --no-sandbox",
        onlyCategories: ["performance", "accessibility", "best-practices"],
        throttling: {
          cpuSlowdownMultiplier: 3,
        },
      },
    },
    assert: {
      includePassedAssertions: true,
      assertions: {
        "categories:accessibility": perfectCategory,
        "categories:best-practices": perfectCategory,
        "categories:performance": performanceCategory,
      },
    },
    upload: {
      outputDir: "./lighthouse-reports/mobile",
      target: "filesystem",
    },
  },
};
