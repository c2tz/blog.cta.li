function restoreInlineStyle(element, property, value) {
  const cssProperty = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

  if (value) {
    element.style[property] = value;
  } else {
    element.style.removeProperty(cssProperty);
  }
}

function clearLightboxScrollLock() {
  if (document.documentElement.classList.contains("consent-visible")) return;

  [document.documentElement, document.body].forEach((element) => {
    if (element.style.overflow === "hidden") element.style.removeProperty("overflow");
    if (element.style.touchAction === "none") element.style.removeProperty("touch-action");
  });
}

export function initLightboxPageScrollRestore(pswp) {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const htmlOverflow = document.documentElement.style.overflow;
  const htmlTouchAction = document.documentElement.style.touchAction;
  const bodyOverflow = document.body.style.overflow;
  const bodyTouchAction = document.body.style.touchAction;
  let isClosing = false;
  let userScrolledAfterClose = false;
  let cleanupFallback = 0;

  const markUserScrollIntent = () => {
    if (isClosing) userScrolledAfterClose = true;
  };

  const markUserScrollKeyIntent = (event) => {
    if (
      ![
        " ",
        "ArrowDown",
        "ArrowUp",
        "End",
        "Home",
        "PageDown",
        "PageUp",
      ].includes(event.key)
    ) {
      return;
    }

    markUserScrollIntent();
  };

  const restorePageStyles = () => {
    restoreInlineStyle(document.documentElement, "overflow", htmlOverflow);
    restoreInlineStyle(document.documentElement, "touchAction", htmlTouchAction);
    restoreInlineStyle(document.body, "overflow", bodyOverflow);
    restoreInlineStyle(document.body, "touchAction", bodyTouchAction);
    clearLightboxScrollLock();
  };

  const restoreScroll = () => {
    if (userScrolledAfterClose) return;

    if (
      Math.abs(window.scrollX - scrollX) > 1 ||
      Math.abs(window.scrollY - scrollY) > 1
    ) {
      window.scrollTo(scrollX, scrollY);
    }
  };

  const scheduleFallbackCleanup = () => {
    window.clearTimeout(cleanupFallback);
    cleanupFallback = window.setTimeout(restorePageStyles, 600);
  };

  window.addEventListener("wheel", markUserScrollIntent, { capture: true, passive: true });
  window.addEventListener("touchmove", markUserScrollIntent, { capture: true, passive: true });
  window.addEventListener("keydown", markUserScrollKeyIntent, true);

  pswp.on("close", () => {
    isClosing = true;
    restoreScroll();
    scheduleFallbackCleanup();
  });

  pswp.on("destroy", () => {
    window.clearTimeout(cleanupFallback);
    window.removeEventListener("wheel", markUserScrollIntent, true);
    window.removeEventListener("touchmove", markUserScrollIntent, true);
    window.removeEventListener("keydown", markUserScrollKeyIntent, true);

    restorePageStyles();
    restoreScroll();
    requestAnimationFrame(() => {
      restorePageStyles();
      restoreScroll();
    });
  });
}
