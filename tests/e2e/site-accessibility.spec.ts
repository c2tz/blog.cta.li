import { expect, gotoRoute, test, waitForAppReady } from "./site-fixture";

test("keeps the latest-posts wrapper out of the tab order at every width", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await gotoRoute(page, "/");
  await waitForAppReady(page);

  const scroller = page.locator(".home-posts-table-scroll");
  await expect(scroller).not.toHaveAttribute("tabindex");
  await expect(scroller).not.toHaveAttribute("role");
  await expect(scroller).not.toHaveAttribute("aria-label");

  await page.setViewportSize({ width: 390, height: 720 });
  await expect(scroller).not.toHaveAttribute("tabindex");
  await expect(scroller).not.toHaveAttribute("role");
  await expect(scroller).not.toHaveAttribute("aria-label");

  const dateSort = page.getByRole("button", { name: "Trier par date" });
  const titleSort = page.getByRole("button", { name: "Trier par titre" });
  const articleLink = page.getByRole("link", { name: "Bienvenue sur ct-blog" });
  for (const control of [dateSort, titleSort, articleLink]) {
    await control.focus();
    await expect(control).toBeFocused();
    await expect(scroller).not.toBeFocused();
  }

  await articleLink.focus();
  for (let step = 0; step < 3; step += 1) {
    await page.keyboard.press("Shift+Tab");
    await expect(scroller).not.toBeFocused();
  }

  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(scroller).not.toHaveAttribute("tabindex");
  await expect(scroller).not.toHaveAttribute("role");
  await expect(scroller).not.toHaveAttribute("aria-label");
});

for (const route of ["/", "/tags/all/", "/cookies/", "/posts/bienvenue-sur-ct-blog/"]) {
  test(`keeps visible controls and links accessibly named on ${route}`, async ({ page }) => {
    await gotoRoute(page, route);
    await waitForAppReady(page);

    const controls = page
      .getByRole("button")
      .or(page.getByRole("link"))
      .or(page.getByRole("textbox"));
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const control = controls.nth(index);
      if (!(await control.isVisible())) continue;
      await expect(control).toHaveAccessibleName(/\S/);
    }
  });
}
