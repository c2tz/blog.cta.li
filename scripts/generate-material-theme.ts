import { Hct, SchemeTonalSpot, argbFromHex, hexFromArgb } from "@material/material-color-utilities";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SOURCE_COLOR = "#1565C0";
const SPEC_VERSION = "2021" as const;
const CONTRAST_LEVEL = 0;
const OUTPUT_URL = new URL("../src/assets/css/base/material-theme.generated.scss", import.meta.url);

const roles = [
  "primary",
  "onPrimary",
  "primaryContainer",
  "onPrimaryContainer",
  "inversePrimary",
  "primaryFixed",
  "primaryFixedDim",
  "onPrimaryFixed",
  "onPrimaryFixedVariant",
  "secondary",
  "onSecondary",
  "secondaryContainer",
  "onSecondaryContainer",
  "secondaryFixed",
  "secondaryFixedDim",
  "onSecondaryFixed",
  "onSecondaryFixedVariant",
  "tertiary",
  "onTertiary",
  "tertiaryContainer",
  "onTertiaryContainer",
  "tertiaryFixed",
  "tertiaryFixedDim",
  "onTertiaryFixed",
  "onTertiaryFixedVariant",
  "error",
  "onError",
  "errorContainer",
  "onErrorContainer",
  "background",
  "onBackground",
  "surface",
  "surfaceDim",
  "surfaceBright",
  "surfaceContainerLowest",
  "surfaceContainerLow",
  "surfaceContainer",
  "surfaceContainerHigh",
  "surfaceContainerHighest",
  "onSurface",
  "surfaceVariant",
  "onSurfaceVariant",
  "surfaceTint",
  "inverseSurface",
  "inverseOnSurface",
  "outline",
  "outlineVariant",
  "shadow",
  "scrim",
] as const;

type Role = (typeof roles)[number];

function kebabCase(role: Role) {
  return role.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function makeBlock(selector: string, isDark: boolean) {
  const scheme = new SchemeTonalSpot(
    Hct.fromInt(argbFromHex(SOURCE_COLOR)),
    isDark,
    CONTRAST_LEVEL,
    SPEC_VERSION,
  );
  const declarations = roles.map((role) => {
    const value = hexFromArgb(scheme[role]).toUpperCase();
    return `  --md-sys-color-${kebabCase(role)}: ${value};`;
  });
  return `${selector} {\n${declarations.join("\n")}\n}`;
}

const css =
  [
    "/* This file is generated. Run `pnpm theme:generate` after changing the source color. */",
    `/* Material Color Utilities 0.4.0, SchemeTonalSpot ${SPEC_VERSION}, contrast ${CONTRAST_LEVEL}, source ${SOURCE_COLOR}. */`,
    ":root {\n  --md-source-color: #1565C0;\n}",
    makeBlock(':root,\n:root[data-theme="light"]', false),
    makeBlock(':root[data-theme="dark"]', true),
    [
      ':root[data-theme="dark"] {',
      "  color-scheme: dark;",
      "  /* Deliberate brand exception: only the page canvas is pure black. */",
      "  --md-sys-color-background: #000000;",
      "}",
    ].join("\n"),
  ].join("\n\n") + "\n";

const outputPath = fileURLToPath(OUTPUT_URL);

if (process.argv.includes("--check")) {
  const currentCss = await readFile(outputPath, "utf8").catch(() => "");
  if (currentCss !== css) {
    throw new Error(`${outputPath} is stale. Run \`pnpm theme:generate\`.`);
  }
  console.log(`Verified ${outputPath} for ${SOURCE_COLOR}.`);
} else {
  await writeFile(outputPath, css, "utf8");
  console.log(`Generated ${outputPath} from ${SOURCE_COLOR}.`);
}
