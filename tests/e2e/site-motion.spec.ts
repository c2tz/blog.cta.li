import {
  expect,
  test,
  ROUTES,
  gotoRoute,
  waitForAppReady,
  waitForNativeEnhancement,
  openMaterialMenu,
  expectNoPageOverflow,
} from "./site-fixture";

test("starts every page without motion and keeps detail mode independent", async ({ page }) => {
  for (const route of ROUTES) {
    await gotoRoute(page, route);
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    await waitForAppReady(page);
    const motion = page.locator(".site-motion-trigger");
    await expect(motion).toHaveJSProperty("selected", false);
    await expect(page.locator(".skip-link")).toHaveCSS("transition-duration", "0s");
    await page.locator(".home-detail-trigger").click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    await page.locator(".home-detail-trigger").click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  }
});

test("exposes a persistent pressed state immediately after search, including at 320px", async ({
  page,
}) => {
  await gotoRoute(page, "/");
  await waitForAppReady(page);
  const motion = page.locator(".site-motion-trigger");
  const button = page.getByRole("button", { name: "Animations", exact: true });
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(motion).toHaveAttribute("data-tooltip", "Activer les animations");
  await motion.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(motion).toHaveAttribute("data-tooltip", "Désactiver les animations");
  await expect(page.locator(".skip-link")).toHaveCSS("transition-duration", "0.16s");
  await page.locator(".home-detail-trigger").click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await waitForAppReady(page);
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await page.setViewportSize({ width: 320, height: 720 });
  await expectNoPageOverflow(page);
  const order = await page.locator(".site-header-actions").evaluate((actions) => {
    const controls = [...actions.querySelectorAll(":scope > div > md-icon-button")];
    return controls.map((control) => ({
      kind: control.className,
      left: control.getBoundingClientRect().left,
      right: control.getBoundingClientRect().right,
      width: control.getBoundingClientRect().width,
    }));
  });
  expect(order[1].kind).toContain("site-motion-trigger");
  expect(order[2].kind).toContain("home-detail-trigger");
  for (let index = 1; index < order.length; index++) {
    expect(order[index].left).toBeGreaterThanOrEqual(order[index - 1].right);
    expect(order[index].width).toBeGreaterThanOrEqual(40);
  }
});

test("uses current-state icons and action tooltips for both display toggles", async ({ page }) => {
  await gotoRoute(page, "/");
  await waitForAppReady(page);
  for (const control of [
    {
      selector: ".site-motion-trigger",
      label: "Animations",
      activate: "Activer les animations",
      deactivate: "Désactiver les animations",
      offIcon: "\uE9C0",
      onIcon: "\uE9C1",
    },
    {
      selector: ".home-detail-trigger",
      label: "Mode détaillé",
      activate: "Passer en mode détaillé",
      deactivate: "Passer en mode simple",
      offIcon: "\uE261",
      onIcon: "\uE8D2",
    },
  ]) {
    const host = page.locator(control.selector);
    const button = page.getByRole("button", { name: control.label, exact: true });
    const offIcon = host.locator("md-icon:not([slot])");
    const onIcon = host.locator('md-icon[slot="selected"]');
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(host).toHaveAttribute("data-tooltip", control.activate);
    await expect(offIcon).toHaveText(control.offIcon);
    await expect(offIcon).toBeVisible();
    await expect(onIcon).not.toBeVisible();
    await host.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(host).toHaveAttribute("data-tooltip", control.deactivate);
    await expect(onIcon).toHaveText(control.onIcon);
    await expect(onIcon).toBeVisible();
    await expect(offIcon).not.toBeVisible();
    await host.click();
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(host).toHaveAttribute("data-tooltip", control.activate);
  }
});

test("announces the theme action while its icon and menu show the current theme", async ({
  page,
}) => {
  await gotoRoute(page, "/");
  await waitForAppReady(page);
  const trigger = page.locator(".site-theme-trigger");
  const menu = page.locator("#site-theme-menu");
  for (const [preference, icon] of [
    ["light", "\uE3AA"],
    ["dark", "\uE3A6"],
    ["system", "\uE1AB"],
  ]) {
    await openMaterialMenu(trigger, menu);
    await menu.locator(`[data-theme-option="${preference}"]`).click();
    await expect(menu).toHaveJSProperty("open", false);
    await expect(trigger).toHaveAttribute("data-tooltip", "Changer de thème");
    await expect(page.getByRole("button", { name: "Changer de thème", exact: true })).toBeVisible();
    await expect(trigger.locator("md-icon")).toHaveText(icon);
    await expect(page.locator("html")).toHaveAttribute("data-theme-preference", preference);
  }
});

test("disables nested Material CSS and keeps deferred loading indicators visible", async ({
  page,
}) => {
  await gotoRoute(page, "/posts/catalogue-redaction/");
  await waitForAppReady(page);
  await page.evaluate(async () => {
    for (const name of ["md-linear-progress", "md-circular-progress"]) {
      await customElements.whenDefined(name);
      const progress = document.createElement(name) as HTMLElement & {
        updateComplete: Promise<unknown>;
      };
      progress.setAttribute("indeterminate", "");
      progress.setAttribute("aria-label", "Chargement de test");
      progress.dataset.testMotion = "";
      if (name === "md-linear-progress") progress.style.width = "200px";
      document.body.append(progress);
      await progress.updateComplete;
    }
  });
  const readMotion = () =>
    page.evaluate(() => {
      const unwanted: string[] = [];
      let shadows = 0;
      const inspect = (root: Document | ShadowRoot) => {
        for (const element of root.querySelectorAll("*")) {
          const style = getComputedStyle(element);
          // Chromium returns empty styles for inactive, unassigned icon slots.
          if (
            (style.animationName && style.animationName !== "none") ||
            (style.transitionDuration && style.transitionDuration !== "0s")
          ) {
            unwanted.push(element.localName);
          }
          if (element.shadowRoot) {
            shadows++;
            inspect(element.shadowRoot);
          }
        }
      };
      inspect(document);
      return { unwanted, shadows };
    });
  await expect.poll(async () => (await readMotion()).unwanted).toEqual([]);
  expect((await readMotion()).shadows).toBeGreaterThan(10);
  const bar = page.locator("md-linear-progress[data-test-motion] .primary-bar");
  await expect(bar).toBeVisible();
  const bounds = await bar.boundingBox();
  expect(bounds!.width).toBeGreaterThan(20);
  const progress = page.locator("md-linear-progress[data-test-motion]");
  const hostBounds = await progress.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(hostBounds!.x);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(hostBounds!.x + hostBounds!.width);
  await page.locator(".site-motion-trigger").click();
  await expect.poll(async () => (await readMotion()).unwanted.length).toBeGreaterThan(0);
  await page.locator(".site-motion-trigger").click();
  await expect.poll(async () => (await readMotion()).unwanted).toEqual([]);
});

test("settles Web Animations without breaking completion promises and restores their timing", async ({
  page,
}) => {
  await gotoRoute(page, "/");
  await waitForAppReady(page);
  const offTiming = await page.locator(".header-link").evaluate(async (element) => {
    const animation = element.animate({ opacity: [0.8, 1] }, { duration: 1000, delay: 200 });
    await animation.finished;
    return animation.effect!.getComputedTiming().endTime;
  });
  expect(offTiming).toBe(0);
  await page.locator(".site-motion-trigger").click();
  const onTiming = await page.locator(".header-link").evaluate((element) => {
    const animation = element.animate({ opacity: [0.8, 1] }, { duration: 1000, delay: 200 });
    void animation.finished.then(() => element.setAttribute("data-test-motion-finished", "true"));
    return animation.effect!.getComputedTiming().endTime;
  });
  expect(onTiming).toBe(1200);
  await page.locator(".site-motion-trigger").click();
  await expect(page.locator(".header-link")).toHaveAttribute("data-test-motion-finished", "true");
  await expect
    .poll(() =>
      page
        .locator(".header-link")
        .evaluate((element) =>
          element.getAnimations().some((animation) => animation.playState === "running"),
        ),
    )
    .toBe(false);
});

test("settles infinite and pending animations in nested shadow roots", async ({ page }) => {
  await gotoRoute(page, "/");
  await waitForAppReady(page);
  await page.locator(".site-motion-trigger").click();

  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "nested-motion-fixture";
    document.body.append(host);
    const outer = host.attachShadow({ mode: "open" });
    const innerHost = document.createElement("div");
    outer.append(innerHost);
    const inner = innerHost.attachShadow({ mode: "closed" });
    const target = document.createElement("span");
    target.textContent = "Nested animation";
    inner.append(target);

    const animations = [
      innerHost.animate({ opacity: [0.8, 1] }, { duration: 10_000, iterations: Infinity }),
      target.animate({ opacity: [0.8, 1] }, { duration: 10_000, delay: 20_000 }),
    ];
    void Promise.all(animations.map((animation) => animation.finished)).then(() => {
      host.dataset.finished = String(
        animations.every((animation) => animation.playState === "finished"),
      );
    });
  });

  await page.locator(".site-motion-trigger").click();
  await expect(page.locator("#nested-motion-fixture")).toHaveAttribute("data-finished", "true");
});

test("defaults to off with reduced-motion preferences and persists through the cookie fallback", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key === "site-motion-preference") {
        throw new DOMException("Storage blocked", "SecurityError");
      }
      return getItem.call(this, key);
    };
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "site-motion-preference") {
        throw new DOMException("Storage blocked", "SecurityError");
      }
      return setItem.call(this, key, value);
    };
  });
  await gotoRoute(page, "/");
  await waitForAppReady(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await page.locator(".site-motion-trigger").click();
  await page.reload();
  await waitForAppReady(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
  await page.locator(".site-motion-trigger").click();
  await page.reload();
  await waitForAppReady(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
});

test("returns to the top immediately when animations are disabled", async ({ page }) => {
  await gotoRoute(page, "/posts/catalogue-redaction/");
  await waitForAppReady(page);
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  const button = page.locator(".site-scroll-top-button");
  await expect(button).toBeVisible();
  await button.click();
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test("delays and aggregates short indeterminate loading indicators", async ({ page }) => {
  await gotoRoute(page, "/");

  await waitForNativeEnhancement(page, "[data-page-loading-root]");
  const landing = page.locator(".home-anime-landing");
  await expect.poll(() => landing.getAttribute("data-controls-ready")).toBe("true");
  await expect.poll(() => landing.getAttribute("aria-busy")).toBe("false");

  const pageProgress = page.locator("md-circular-progress.site-page-loading-progress");
  const pageProgressRevealedDuringShortOperation = await page.evaluate(async () => {
    const root = document.querySelector("[data-page-loading-root]");
    if (!(root instanceof HTMLElement)) throw new Error("Missing page loading root");

    let revealed = Boolean(root.querySelector(".site-page-loading-progress"));
    const observer = new MutationObserver(() => {
      revealed ||= Boolean(root.querySelector(".site-page-loading-progress"));
    });
    observer.observe(root, { childList: true, subtree: true });

    document.dispatchEvent(
      new CustomEvent("site:loading-start", { detail: { key: "playwright-guideline-check" } }),
    );
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 120);
    });
    document.dispatchEvent(
      new CustomEvent("site:loading-end", { detail: { key: "playwright-guideline-check" } }),
    );
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 140);
    });

    observer.disconnect();
    return revealed;
  });
  expect(pageProgressRevealedDuringShortOperation).toBe(false);
  await expect(pageProgress).toHaveCount(0);

  const pageProgressRevealDelay = await page.evaluate(() => {
    const root = document.querySelector("[data-page-loading-root]");
    if (!(root instanceof HTMLElement)) throw new Error("Missing page loading root");

    return new Promise<number | null>((resolve) => {
      const startedAt = performance.now();
      let timeout = 0;
      const finish = (delay: number | null) => {
        observer.disconnect();
        if (timeout) window.clearTimeout(timeout);
        resolve(delay);
      };
      const sample = () => {
        if (root.querySelector(".site-page-loading-progress")) {
          finish(performance.now() - startedAt);
        }
      };
      const observer = new MutationObserver(sample);
      observer.observe(root, { childList: true, subtree: true });
      timeout = window.setTimeout(() => finish(null), 3000);

      for (const key of ["playwright-long-check-a", "playwright-long-check-b"]) {
        document.dispatchEvent(new CustomEvent("site:loading-start", { detail: { key } }));
      }
      sample();
    });
  });
  expect(pageProgressRevealDelay).not.toBeNull();
  expect(pageProgressRevealDelay ?? 0).toBeGreaterThanOrEqual(180);
  await expect(pageProgress).toHaveCount(1);
  await expect(pageProgress).toHaveAttribute("indeterminate", "");
  await expect(pageProgress).toHaveAttribute("four-color", /^(?:|true)$/);
  await page.evaluate(() => {
    document.dispatchEvent(
      new CustomEvent("site:loading-end", { detail: { key: "playwright-long-check-a" } }),
    );
  });
  await expect(pageProgress).toHaveCount(1);
  await page.evaluate(() => {
    document.dispatchEvent(
      new CustomEvent("site:loading-end", { detail: { key: "playwright-long-check-b" } }),
    );
  });
  await expect(pageProgress).toHaveCount(0);

  const konachanProgress = page.locator("md-circular-progress.home-anime-loading-progress");
  await expect(konachanProgress).toHaveAttribute("indeterminate", "");
  await expect(konachanProgress).toHaveAttribute("four-color", /^(?:|true)$/);
  await expect(konachanProgress).toBeHidden();
  const konachanProgressRevealedDuringShortOperation = await page.evaluate(async () => {
    const landing = document.querySelector(".home-anime-landing");
    const loader = document.querySelector("[data-konachan-loading]");
    if (!(landing instanceof HTMLElement) || !(loader instanceof HTMLElement)) {
      throw new Error("Missing Konachan loading elements");
    }

    let revealed = !loader.hidden;
    const observer = new MutationObserver(() => {
      revealed ||= !loader.hidden;
    });
    observer.observe(loader, { attributeFilter: ["hidden"], attributes: true });

    landing.setAttribute("aria-busy", "true");
    document.dispatchEvent(
      new CustomEvent("konachan:refresh-state", { detail: { busy: true, status: "Test" } }),
    );
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 120);
    });
    landing.setAttribute("aria-busy", "false");
    document.dispatchEvent(
      new CustomEvent("konachan:refresh-state", {
        detail: { busy: false, status: "Test court terminé" },
      }),
    );
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 140);
    });

    observer.disconnect();
    return revealed;
  });
  expect(konachanProgressRevealedDuringShortOperation).toBe(false);
  await expect(konachanProgress).toBeHidden();

  const konachanProgressRevealDelay = await page.evaluate(() => {
    const landing = document.querySelector(".home-anime-landing");
    const loader = document.querySelector("[data-konachan-loading]");
    if (!(landing instanceof HTMLElement) || !(loader instanceof HTMLElement)) {
      throw new Error("Missing Konachan loading elements");
    }

    return new Promise<number | null>((resolve) => {
      const startedAt = performance.now();
      let timeout = 0;
      const finish = (delay: number | null) => {
        observer.disconnect();
        if (timeout) window.clearTimeout(timeout);
        resolve(delay);
      };
      const sample = () => {
        if (!loader.hidden) finish(performance.now() - startedAt);
      };
      const observer = new MutationObserver(sample);
      observer.observe(loader, { attributeFilter: ["hidden"], attributes: true });
      timeout = window.setTimeout(() => finish(null), 3000);

      landing.setAttribute("aria-busy", "true");
      document.dispatchEvent(
        new CustomEvent("konachan:refresh-state", {
          detail: { busy: true, status: "Test long" },
        }),
      );
      sample();
    });
  });
  expect(konachanProgressRevealDelay).not.toBeNull();
  expect(konachanProgressRevealDelay ?? 0).toBeGreaterThanOrEqual(180);
  await expect(konachanProgress).toBeVisible();
  await expect(page.locator("md-icon-button.home-anime-refresh md-circular-progress")).toHaveCount(
    0,
  );
  await page.evaluate(() => {
    document.querySelector(".home-anime-landing")?.setAttribute("aria-busy", "false");
    document.dispatchEvent(
      new CustomEvent("konachan:refresh-state", {
        detail: { busy: false, status: "Test terminé" },
      }),
    );
  });
  await expect(konachanProgress).toBeHidden();
});

for (const fixture of [
  { name: "home", route: "/", table: ".home-posts-table", column: "titre" },
  { name: "archive", route: "/__test__/archives/11/", table: ".tag-posts-table", column: "titre" },
  {
    name: "shortcode",
    route: "/posts/catalogue-redaction/",
    table: ".material-shortcode-table",
    column: "Quantité",
  },
]) {
  test(`uses Material sort arrows in the ${fixture.name} table and obeys the motion toggle`, async ({
    page,
    isMobile,
  }) => {
    await gotoRoute(page, fixture.route);
    await waitForAppReady(page);
    const table = page.locator(fixture.table);
    const button = table.getByRole("button", { name: `Trier par ${fixture.column}`, exact: true });
    const header = table.getByRole("columnheader", {
      name: `Trier par ${fixture.column}`,
      exact: true,
    });
    const arrow = button.locator("[data-sort-icon]");
    await expect(button).toBeVisible();
    await expect(arrow).toHaveCSS("opacity", "0");
    await expect(arrow).toHaveCSS("width", "12px");
    const siteIconFont = await page
      .locator(".site-motion-trigger md-icon")
      .first()
      .evaluate((element) => getComputedStyle(element).fontFamily);
    await expect(arrow.locator("md-icon")).toHaveCSS("font-family", siteIconFont);
    await expect(arrow.locator("md-icon")).toHaveText("\uE5D8");
    await expect(arrow).toHaveCSS("transition-duration", "0s");
    if (!isMobile) {
      await button.hover();
      await expect(arrow).toHaveCSS("opacity", "0.54");
    }
    await button.click();
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await expect(arrow).toHaveCSS("opacity", "1");
    await button.press("Enter");
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await expect(arrow).toHaveCSS("transform", "matrix(-1, 0, 0, -1, 0, 0)");
    if (fixture.name === "shortcode") {
      await expect(table.locator("tbody tr td:last-child")).toHaveText(["6", "4", "3", "2", "2"]);
    } else if (fixture.name === "archive") {
      await expect(table.locator("tbody tr:visible a").first()).toHaveText("Article 011");
    }
    await button.press("Space");
    await expect(table.locator("th[aria-sort]")).toHaveCount(0);
    await expect(arrow).toHaveCSS("opacity", "0");
    await expect(arrow).toHaveCSS("animation-name", "none");
    expect(await arrow.evaluate((element) => element.getAnimations().length)).toBe(0);

    await page.locator(".site-motion-trigger").click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
    await arrow.evaluate((element) => {
      element.addEventListener("transitionrun", (event) => {
        (element as HTMLElement).dataset.observedTransition = (
          event as TransitionEvent
        ).propertyName;
      });
      element.addEventListener("animationstart", (event) => {
        (element as HTMLElement).dataset.observedAnimation = (
          event as AnimationEvent
        ).animationName;
      });
    });
    await button.click();
    await expect(arrow).toHaveCSS("transition-duration", "0.225s, 0.225s");
    await expect(arrow).toHaveCSS("opacity", "1");
    if (fixture.name === "shortcode") {
      await expect(table.locator("tbody tr td:last-child")).toHaveText(["1", "2", "2", "3", "4"]);
    } else if (fixture.name === "archive") {
      await expect(table.locator("tbody tr:visible a").first()).toHaveText("Article 001");
    }
    await button.press("Enter");
    await expect(arrow).toHaveAttribute("data-observed-transition", "transform");
    await expect(arrow).toHaveCSS("transform", "matrix(-1, 0, 0, -1, 0, 0)");
    await button.press("Space");
    await expect(arrow).toHaveAttribute("data-observed-animation", "site-sort-clear-desc");
    await expect(arrow).toHaveCSS("opacity", "0");
    await button.click();
    await table
      .getByRole("button", { name: /^Trier par/ })
      .first()
      .click();
    await expect(table.locator("th[aria-sort]")).toHaveCount(1);
    await expect(arrow).toHaveCSS("opacity", "0");
    await page.locator(".site-motion-trigger").click();
    await expect(arrow).toHaveCSS("transition-duration", "0s");
    await expectNoPageOverflow(page);
  });
}

test("shows the automatic contents only in detailed mode and links to nested article headings", async ({
  page,
}) => {
  await gotoRoute(page, "/posts/catalogue-redaction/");
  await waitForAppReady(page);
  const toc = page.locator(".post-toc");
  await expect(toc).toBeHidden();
  await page.locator(".home-detail-trigger").click();
  await expect(page.getByRole("navigation", { name: "Sommaire", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await expect(toc).toHaveAttribute("data-pagefind-ignore", "all");
  await expect(toc.locator("ul ul")).toHaveCSS("list-style-type", "circle");
  const linkTargets = await toc.locator("li a").evaluateAll((links) =>
    links.map((link) => {
      const id = decodeURIComponent((link as HTMLAnchorElement).hash.slice(1));
      const target = document.getElementById(id);
      return Boolean(target?.matches("h2, h3") && !target.closest(".post-toc"));
    }),
  );
  expect(linkTargets.length).toBeGreaterThan(10);
  expect(linkTargets.every(Boolean)).toBe(true);
  const nestedLink = toc.getByRole("link", { name: "Les cinq apparences", exact: true });
  await nestedLink.focus();
  await nestedLink.press("Enter");
  await expect(page).toHaveURL(/#les-cinq-apparences$/);
  await expect(page.locator("#les-cinq-apparences")).toBeInViewport();
  await page.reload();
  await waitForAppReady(page);
  await expect(toc).toBeVisible();
  await page.locator(".home-detail-trigger").click();
  await expect(toc).toBeHidden();
  await expectNoPageOverflow(page);
});

test("keeps short articles free of an automatic contents even in detailed mode", async ({
  page,
}) => {
  await gotoRoute(page, "/posts/bienvenue-sur-ct-blog/");
  await waitForAppReady(page);
  await page.locator(".home-detail-trigger").click();
  await expect(page.locator(".post-toc")).toHaveCount(0);
  await expectNoPageOverflow(page);
});

test("keeps the latest-posts table interactive without exposing hidden posts", async ({ page }) => {
  await gotoRoute(page, "/");
  await waitForNativeEnhancement(page, "site-home-latest-posts-table");
  await waitForAppReady(page);

  const sortButtons = page.locator(".home-posts-sort-button");
  await expect(sortButtons).toHaveCount(2);
  const coverage = await sortButtons.evaluateAll((buttons) =>
    buttons.map((button) => {
      const header = button.closest("th");
      const buttonRect = button.getBoundingClientRect();
      const headerRect = header?.getBoundingClientRect();
      const labelRect = button.querySelector("span:not([data-sort-icon])")?.getBoundingClientRect();
      return {
        height: headerRect ? buttonRect.height / headerRect.height : 0,
        labelFits: Boolean(
          labelRect && labelRect.top >= buttonRect.top && labelRect.bottom <= buttonRect.bottom,
        ),
        rippleUpgraded: Boolean(button.querySelector("md-ripple")?.shadowRoot),
        width: headerRect ? buttonRect.width / headerRect.width : 0,
      };
    }),
  );
  expect(
    coverage.every(({ width, height, labelFits }) => width >= 0.98 && height >= 0.95 && labelFits),
    JSON.stringify(coverage),
  ).toBe(true);
  expect(coverage.every(({ rippleUpgraded }) => rippleUpgraded)).toBe(true);

  await page.getByRole("button", { name: "Trier par titre" }).click();
  await expect(page.getByRole("columnheader", { name: "Trier par titre" })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await expect(page.getByRole("link", { name: "Vérification MDX" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Shortcodes Astro et Material Web" })).toHaveCount(0);
});
