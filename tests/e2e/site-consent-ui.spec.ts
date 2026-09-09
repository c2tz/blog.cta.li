import { expect, gotoRoute, test } from "./site-fixture";

test("keeps cookie preferences off the home page, including its former hash target", async ({
  page,
}) => {
  await gotoRoute(page, "/");
  await expect(page.locator("#modifier-vos-choix-cookies")).toHaveCount(0);
  await expect(page.locator("site-cookie-preferences")).toHaveCount(0);

  await gotoRoute(page, "/#modifier-vos-choix-cookies");
  await expect(page).toHaveURL(/\/#modifier-vos-choix-cookies$/);
  await expect(page.locator("#modifier-vos-choix-cookies")).toHaveCount(0);
  await expect(page.locator("site-cookie-preferences")).toHaveCount(0);
});

test("renders granular cookie preference controls", async ({ page }) => {
  await gotoRoute(page, "/cookies#modifier-vos-choix-cookies");

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
    await panel
      .locator(".cookie-preferences-choice")
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute("data-cookie-preference-action")),
      ),
  ).toEqual(["reject-all", "accept-all"]);
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
  await expect(serviceSwitches).toHaveCount(4);
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
