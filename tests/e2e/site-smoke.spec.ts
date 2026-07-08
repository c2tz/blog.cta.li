import { expect, test, type Page } from "@playwright/test";

const ROUTES = [
  "/",
  "/cookies/",
  "/posts/hugo-material-shortcodes/",
  "/posts/markdown-style-guide/",
];

const pageRuntimeErrors = new WeakMap<Page, string[]>();

async function seedLocalPreferences(page: Page) {
  await page.addInitScript(() => {
    const updatedAt = new Date().toISOString();

    localStorage.setItem(
      "ct-explicit-content-ack-v1",
      JSON.stringify({ acknowledged: true, updatedAt, version: 1 }),
    );
    localStorage.setItem(
      "ct-cookie-consent-v1",
      JSON.stringify({ functionality: false, updatedAt, version: 1 }),
    );
    localStorage.setItem("site-theme-preference", "system");
  });
}

async function clearConsentPreferences(page: Page) {
  await page.addInitScript(() => {
    const expireCookie = (name: string) => {
      document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=Lax`;
    };

    localStorage.removeItem("ct-explicit-content-ack-v1");
    localStorage.removeItem("ct-cookie-consent-v1");
    expireCookie("ct-explicit-content-ack-v1");
    expireCookie("ct-cookie-consent-v1");
  });
}

async function expectResolvedTheme(page: Page) {
  const expectedTheme = test.info().project.name.includes("dark") ? "dark" : "light";

  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe(expectedTheme);
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  expect(overflow).toBeLessThanOrEqual(2);
}

test.beforeEach(async ({ page }, testInfo) => {
  const runtimeErrors: string[] = [];
  pageRuntimeErrors.set(page, runtimeErrors);
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });

  if (testInfo.title !== "renders consent notices") {
    await seedLocalPreferences(page);
  }
});

test.afterEach(async ({ page }) => {
  expect(pageRuntimeErrors.get(page) ?? []).toEqual([]);
});

for (const route of ROUTES) {
  test(`renders ${route} without document overflow`, async ({ page }) => {
    await page.goto(route);

    await expectResolvedTheme(page);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Avis de confidentialité" })).toHaveCount(0);
    await expect(
      page.getByRole("dialog", { name: "Avertissement relatif aux images" }),
    ).toHaveCount(0);
    await expectNoPageOverflow(page);
  });
}

test("keeps latest posts visible on the home page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Derniers articles" })).toBeVisible();
  await expect(page.locator(".home-post-title").first()).toBeVisible();
  expect(await page.locator(".home-post-title").count()).toBeGreaterThan(0);
  await expect(page.getByText("Aucun article à afficher.")).toHaveCount(0);
});

test("renders the cookie preferences controls", async ({ page }) => {
  await page.goto("/cookies/#modifier-vos-choix-cookies");

  await expect(page.getByRole("heading", { name: "Modifier vos choix cookies" })).toBeVisible();
  await expect(page.locator(".cookie-preferences-toggle-group")).toBeVisible();
  await expect(page.getByLabel("Autoriser les services optionnels")).toBeVisible();
  await expect(page.getByLabel("Refuser les services optionnels")).toBeVisible();
  await expect(page.getByLabel("Réinitialiser le choix des services optionnels")).toBeVisible();
});

test("renders consent notices", async ({ page }) => {
  await clearConsentPreferences(page);
  await page.goto("/");

  await expect(
    page.getByRole("dialog", { name: "Avertissement relatif aux images" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "J’ACCEPTE ET J’ENTRE" }).click();

  await expect(page.getByRole("region", { name: "Avis de confidentialité" })).toBeVisible();
  await expect(page.getByText("Ce site utilise des cookies")).toBeVisible();
  await page.getByRole("button", { name: "REFUSER" }).click();
  await expect(page.getByRole("region", { name: "Avis de confidentialité" })).toHaveCount(0);
});

test("renders shortcode code blocks with highlighted lines and copy controls", async ({ page }) => {
  await page.goto("/posts/hugo-material-shortcodes/");

  await expect(page.getByRole("heading", { exact: true, name: "Sommaire" })).toBeVisible();
  await expect(page.locator(".post-toc h2 a")).toHaveAttribute("href", "#sommaire");
  await expect(page.locator(".post-toc a[href='#admonitions']")).toBeVisible();
  await expect(page.locator(".code-shell").first()).toBeVisible();
  await expect(page.locator(".code-copy-button").first()).toBeVisible();
  expect(await page.locator("pre code .line").count()).toBeGreaterThan(10);
  expect(
    await page.locator("pre code .line.highlighted, pre code .line.diff").count(),
  ).toBeGreaterThan(0);
  await expectNoPageOverflow(page);
});

test("renders the table of contents on the markdown style guide", async ({ page }) => {
  await page.goto("/posts/markdown-style-guide/");

  await expect(page.getByRole("heading", { exact: true, name: "Sommaire" })).toBeVisible();
  await expect(page.locator(".post-toc h2 a")).toHaveAttribute("href", "#sommaire");
  await expect(page.locator(".post-toc a[href='#headings']")).toBeVisible();
  await expectNoPageOverflow(page);
});

test("keeps Giscus disabled behind the privacy choice", async ({ page }) => {
  await page.goto("/posts/hugo-material-shortcodes/");

  await expect(page.getByRole("heading", { level: 3, name: "Commentaires" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Commentaires" })).toHaveAttribute(
    "href",
    "#commentaires",
  );
  await expect(page.getByText("Les commentaires externes sont désactivés par")).toBeVisible();
  await expect(page.getByRole("link", { name: "votre choix de confidentialité" })).toHaveAttribute(
    "href",
    "/cookies/#modifier-vos-choix-cookies",
  );
});
