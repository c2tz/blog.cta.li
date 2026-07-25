import { expect, expectNoPageOverflow, gotoRoute, test } from "./site-fixture";

test("reveals one interactive cookie preference panel only when its home target is active", async ({
  page,
}) => {
  await gotoRoute(page, "/");

  const target = page.locator("#modifier-vos-choix-cookies");
  await expect(target).toBeHidden();
  await expect(page.locator("site-cookie-preferences")).toHaveCount(1);

  await gotoRoute(page, "/#modifier-vos-choix-cookies");
  await expect(page).toHaveURL(/\/#modifier-vos-choix-cookies$/);
  await expect(target).toBeVisible();
  await expect(
    target.getByRole("heading", { name: "Modifier vos choix cookies", exact: true }),
  ).toBeVisible();
  await expect(
    target.getByText(
      "Autorisez ou refusez séparément chaque service optionnel. Vous pourrez modifier ces choix à tout moment.",
      { exact: true },
    ),
  ).toBeVisible();

  const preferences = target.locator("site-cookie-preferences");
  const panel = preferences.locator(".cookie-preferences-panel");
  const materialControls = panel.locator(
    "md-switch, md-filled-button, md-filled-tonal-button, md-text-button",
  );
  await expect(preferences).toHaveCount(1);
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute("aria-labelledby", "home-cookie-preferences-title");
  await expect
    .poll(() =>
      materialControls.evaluateAll(
        (controls) => controls.length > 0 && controls.every((control) => control.shadowRoot),
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        bannerDefined: Boolean(customElements.get("site-cookie-consent-banner")),
        preferenceElements: document.querySelectorAll("site-cookie-preferences").length,
        preferencesDefined: Boolean(customElements.get("site-cookie-preferences")),
      })),
    )
    .toEqual({
      bannerDefined: true,
      preferenceElements: 1,
      preferencesDefined: true,
    });

  const allowButton = panel.locator("[data-cookie-preference-action='accept-all']");
  await allowButton.click();
  await expect(panel).toHaveAttribute("data-cookie-preference-state", "accepted");
  await expect(panel.getByText("Tous les services autorisés", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 320, height: 720 });
  await expect(target).toBeVisible();
  await expect(panel).toBeVisible();
  await expectNoPageOverflow(page);
  const mobileLayout = await panel.evaluate((element) => {
    const panelRect = element.getBoundingClientRect();
    const controls = Array.from(
      element.querySelectorAll(
        "md-switch, md-filled-button, md-filled-tonal-button, md-text-button",
      ),
    );
    return {
      controlsFit: controls.every((control) => {
        const rect = control.getBoundingClientRect();
        return rect.left >= panelRect.left && rect.right <= panelRect.right;
      }),
      labelsUnclipped: controls.every((control) => {
        const label = control.shadowRoot?.querySelector(".label");
        return !label || label.scrollWidth <= label.clientWidth + 1;
      }),
      panelLeft: panelRect.left,
      panelRight: panelRect.right,
      viewportWidth: window.innerWidth,
    };
  });
  expect(mobileLayout.controlsFit).toBe(true);
  expect(mobileLayout.labelsUnclipped).toBe(true);
  expect(mobileLayout.panelLeft).toBeGreaterThanOrEqual(0);
  expect(mobileLayout.panelRight).toBeLessThanOrEqual(mobileLayout.viewportWidth);
});

test("renders granular cookie preference controls", async ({ page }) => {
  await gotoRoute(page, "/cookies/#modifier-vos-choix-cookies");

  await expect(page.getByRole("heading", { name: "Modifier vos choix cookies" })).toBeVisible();
  const panel = page.locator(".cookie-preferences-panel");
  const allowButton = page.locator("md-filled-tonal-button.cookie-preferences-allow");
  const rejectButton = page.locator("md-filled-button.cookie-preferences-reject");
  const resetButton = page.locator("md-text-button.cookie-preferences-reset");
  const serviceSwitches = panel.locator("md-switch[data-cookie-preference-service]");

  await expect(panel).toBeVisible();
  await expect(allowButton).toBeVisible();
  await expect(rejectButton).toBeVisible();
  await expect(resetButton).toBeVisible();
  await expect(allowButton).toHaveAttribute("has-icon", "");
  await expect(rejectButton).toHaveAttribute("has-icon", "");
  expect(
    await allowButton
      .locator('md-icon[slot="icon"]')
      .evaluate((icon) => icon.textContent?.codePointAt(0)),
  ).toBe(0xe5ca);
  expect(
    await rejectButton
      .locator('md-icon[slot="icon"]')
      .evaluate((icon) => icon.textContent?.codePointAt(0)),
  ).toBe(0xe5cd);
  const rejectColors = await rejectButton.evaluate((button) => ({
    button: getComputedStyle(button).getPropertyValue("--md-filled-button-container-color").trim(),
    theme: getComputedStyle(document.documentElement)
      .getPropertyValue("--md-sys-color-error")
      .trim(),
  }));
  expect(rejectColors.button).toBe(rejectColors.theme);

  await expect(panel).toHaveAttribute("data-cookie-preference-state", "rejected");
  await expect(panel.getByText("Aucun service autorisé", { exact: true })).toBeVisible();
  await expect(serviceSwitches).toHaveCount(3);
  for (const serviceSwitch of await serviceSwitches.all()) {
    await expect(serviceSwitch).toHaveJSProperty("selected", false);
  }
  await expect(rejectButton).toHaveAttribute("data-selected", "");

  await allowButton.click();
  await expect(panel).toHaveAttribute("data-cookie-preference-state", "accepted");
  await expect(panel.getByText("Tous les services autorisés", { exact: true })).toBeVisible();
  for (const serviceSwitch of await serviceSwitches.all()) {
    await expect(serviceSwitch).toHaveJSProperty("selected", true);
  }
  await expect(allowButton).toHaveAttribute("data-selected", "");
  await expect(rejectButton).not.toHaveAttribute("data-selected", "");

  await resetButton.click();
  await expect(panel).toHaveAttribute("data-cookie-preference-state", "unset");
  await expect(panel.getByText("Aucun choix enregistré", { exact: true })).toBeVisible();
  await expect(panel.getByText("Choix des services optionnels réinitialisé.")).toBeVisible();
  for (const serviceSwitch of await serviceSwitches.all()) {
    await expect(serviceSwitch).toHaveJSProperty("selected", false);
  }
  await expect(resetButton).toHaveAttribute("disabled", "");
  await expect
    .poll(() =>
      resetButton.evaluate(
        (button) =>
          (button.shadowRoot?.querySelector("button") as HTMLButtonElement | null)?.disabled ??
          false,
      ),
    )
    .toBe(true);
});
