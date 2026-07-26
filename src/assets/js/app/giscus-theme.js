const GISCUS_ORIGIN = "https://giscus.app";
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

const FALLBACK_COLORS = Object.freeze({
  light: Object.freeze({
    background: "#F9F9FF",
    error: "#BA1A1A",
    errorContainer: "#FFDAD6",
    onPrimary: "#FFFFFF",
    onPrimaryContainer: "#274777",
    onSecondaryContainer: "#3E4758",
    onSurface: "#191C20",
    onSurfaceVariant: "#44474E",
    outline: "#74777F",
    outlineVariant: "#C4C6CF",
    primary: "#405F90",
    primaryContainer: "#D6E3FF",
    secondaryContainer: "#DAE2F9",
    shadow: "#000000",
    surface: "#F9F9FF",
    surfaceContainer: "#EDEDF4",
    surfaceContainerHigh: "#E7E8EE",
    surfaceContainerHighest: "#E2E2E9",
    surfaceContainerLow: "#F3F3FA",
    surfaceContainerLowest: "#FFFFFF",
    tertiary: "#6F5575",
    tertiaryContainer: "#F9D8FD",
  }),
  dark: Object.freeze({
    background: "#000000",
    error: "#FFB4AB",
    errorContainer: "#93000A",
    onPrimary: "#08305F",
    onPrimaryContainer: "#D6E3FF",
    onSecondaryContainer: "#DAE2F9",
    onSurface: "#E2E2E9",
    onSurfaceVariant: "#C4C6CF",
    outline: "#8E9099",
    outlineVariant: "#44474E",
    primary: "#A9C7FF",
    primaryContainer: "#274777",
    secondaryContainer: "#3E4758",
    shadow: "#000000",
    surface: "#111318",
    surfaceContainer: "#1D2024",
    surfaceContainerHigh: "#282A2F",
    surfaceContainerHighest: "#33353A",
    surfaceContainerLow: "#191C20",
    surfaceContainerLowest: "#0C0E13",
    tertiary: "#DCBCE1",
    tertiaryContainer: "#563E5C",
  }),
});

const ROLE_NAMES = Object.freeze({
  background: "background",
  error: "error",
  errorContainer: "error-container",
  onPrimary: "on-primary",
  onPrimaryContainer: "on-primary-container",
  onSecondaryContainer: "on-secondary-container",
  onSurface: "on-surface",
  onSurfaceVariant: "on-surface-variant",
  outline: "outline",
  outlineVariant: "outline-variant",
  primary: "primary",
  primaryContainer: "primary-container",
  secondaryContainer: "secondary-container",
  shadow: "shadow",
  surface: "surface",
  surfaceContainer: "surface-container",
  surfaceContainerHigh: "surface-container-high",
  surfaceContainerHighest: "surface-container-highest",
  surfaceContainerLow: "surface-container-low",
  surfaceContainerLowest: "surface-container-lowest",
  tertiary: "tertiary",
  tertiaryContainer: "tertiary-container",
});

function readMaterialColors(root, theme) {
  const styles = getComputedStyle(root);
  const fallback = FALLBACK_COLORS[theme];

  return Object.fromEntries(
    Object.entries(ROLE_NAMES).map(([name, role]) => {
      const value = styles.getPropertyValue(`--md-sys-color-${role}`).trim();
      return [name, HEX_COLOR_PATTERN.test(value) ? value.toUpperCase() : fallback[name]];
    }),
  );
}

function createThemeCss(theme, colors) {
  const githubGreen = theme === "dark" ? "#238636" : "#1F883D";
  const githubGreenHover = theme === "dark" ? "#2EA043" : "#1A7F37";
  const githubGreenPressed = theme === "dark" ? "#238636" : "#197935";

  return `@import url("${GISCUS_ORIGIN}/themes/${theme}.css");
:root{color-scheme:${theme}}
main{
--color-canvas-default:${colors.background};
--color-canvas-subtle:${colors.surfaceContainerLow};
--color-canvas-inset:${colors.surfaceContainerLowest};
--color-canvas-overlay:${colors.surfaceContainerHigh};
--color-fg-default:${colors.onSurface};
--color-fg-muted:${colors.onSurfaceVariant};
--color-fg-subtle:${colors.onSurfaceVariant};
--color-border-default:${colors.outlineVariant};
--color-border-muted:${colors.outlineVariant};
--color-accent-fg:${colors.primary};
--color-accent-emphasis:${colors.primary};
--color-accent-muted:${colors.primaryContainer};
--color-accent-subtle:color-mix(in srgb,${colors.primary} 12%,transparent);
--color-success-fg:${colors.primary};
--color-attention-fg:${colors.tertiary};
--color-attention-muted:${colors.tertiaryContainer};
--color-attention-subtle:${colors.tertiaryContainer};
--color-danger-fg:${colors.error};
--color-danger-muted:${colors.errorContainer};
--color-danger-subtle:${colors.errorContainer};
--color-btn-text:${colors.onSecondaryContainer};
--color-btn-bg:${colors.secondaryContainer};
--color-btn-border:transparent;
--color-btn-hover-bg:color-mix(in srgb,${colors.onSecondaryContainer} 8%,${colors.secondaryContainer});
--color-btn-hover-border:transparent;
--color-btn-active-bg:color-mix(in srgb,${colors.onSecondaryContainer} 12%,${colors.secondaryContainer});
--color-btn-active-border:transparent;
--color-btn-primary-text:${colors.onPrimary};
--color-btn-primary-bg:${colors.primary};
--color-btn-primary-border:transparent;
--color-btn-primary-hover-bg:color-mix(in srgb,${colors.onPrimary} 8%,${colors.primary});
--color-btn-primary-hover-border:transparent;
--color-btn-primary-selected-bg:color-mix(in srgb,${colors.onPrimary} 12%,${colors.primary});
--color-btn-primary-disabled-text:color-mix(in srgb,${colors.onSurface} 38%,transparent);
--color-btn-primary-disabled-bg:color-mix(in srgb,${colors.onSurface} 12%,transparent);
--color-btn-primary-disabled-border:transparent;
--color-input-bg:${colors.surfaceContainerLowest};
--color-input-border:${colors.outline};
--color-neutral-muted:color-mix(in srgb,${colors.primary} 16%,transparent);
--color-neutral-subtle:color-mix(in srgb,${colors.primary} 8%,transparent);
--color-action-list-item-default-hover-bg:color-mix(in srgb,${colors.onSurface} 8%,transparent);
--color-segmented-control-bg:${colors.surfaceContainerLow};
--color-segmented-control-button-bg:${colors.surfaceContainer};
--color-segmented-control-button-selected-border:${colors.outline};
--color-social-reaction-bg-hover:color-mix(in srgb,${colors.onSurface} 8%,transparent);
--color-social-reaction-bg-reacted-hover:color-mix(in srgb,${colors.primary} 16%,transparent);
--color-primer-shadow-focus:0 0 0 3px color-mix(in srgb,${colors.primary} 24%,transparent)
}
html,body,main,.gsc-main{background:${colors.background}!important;color:${colors.onSurface};font-family:Roboto,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
a{color:${colors.onSurface};text-decoration:none}
a:hover,a:focus-visible{color:${colors.primary};text-decoration:underline;text-underline-offset:.16em}
.gsc-main,.gsc-comment-box,.gsc-comment{font-size:1rem}
.gsc-comment-box,.gsc-comment{border-radius:8px}
.gsc-comment-box-tabs,.gsc-comment-box-textarea,.gsc-comment-box-bottom,.gsc-reactions,.gsc-timeline,.gsc-reply-box,.gsc-comment-box{border-color:${colors.outlineVariant}}
.gsc-comment,.gsc-comment-box,.gsc-reply-box{background:${colors.surfaceContainerLow}!important}
.gsc-comment-header{background:${colors.surfaceContainer}!important}
.gsc-comment-box-textarea{background:${colors.surfaceContainerLowest}!important}
.gsc-reactions{display:none}
.gsc-reactions-popover.color-bg-overlay{border-color:${colors.outlineVariant};background:${colors.surfaceContainerHigh};box-shadow:0 3px 8px color-mix(in srgb,${colors.shadow} 22%,transparent)}
.gsc-reactions-popover .border-t{border-color:${colors.outlineVariant}}
.gsc-btn,.btn{border-radius:9999px}
.gsc-comment-box-buttons a.btn-primary{--color-btn-primary-text:#FFF;--color-btn-primary-bg:${githubGreen};--color-btn-primary-border:color-mix(in srgb,#FFF 10%,transparent);--color-btn-primary-hover-bg:${githubGreenHover};--color-btn-primary-hover-border:color-mix(in srgb,#FFF 10%,transparent);--color-btn-primary-selected-bg:${githubGreenPressed};--color-btn-primary-selected-shadow:0 0 transparent;color:#FFF!important}
.gsc-comment-box-buttons a.btn-primary svg{color:#FFF!important;fill:currentColor!important}
`;
}

export function createGiscusThemeUrl(root = document.documentElement) {
  const theme = root.dataset.theme === "dark" ? "dark" : "light";
  const css = createThemeCss(theme, readMaterialColors(root, theme));
  return `data:text/css;charset=utf-8,${encodeURIComponent(css)}`;
}
