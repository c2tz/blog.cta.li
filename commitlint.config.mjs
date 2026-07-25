const preferredScopes = [
  "a11y",
  "analytics",
  "assets",
  "blog",
  "bot",
  "cache",
  "ci",
  "cookies",
  "csp",
  "deps",
  "docs",
  "fonts",
  "headers",
  "home",
  "konachan",
  "landing",
  "legal",
  "material-symbols",
  "readme",
  "search",
  "security",
  "seo",
  "vercel",
  "workflow",
];

export default {
  extends: ["@commitlint/config-conventional"],
  ignores: [
    (message = "") =>
      message.startsWith("Merge ") ||
      message.startsWith("Revert ") ||
      /^(develop|main|master|release|staging|production)\s+\(#\d+\)$/i.test(message),
  ],
  rules: {
    "body-leading-blank": [2, "always"],
    // Dependabot's structured metadata is parsed as a footer even though it is
    // separated from the prose by `---`. Keep the style signal without making
    // otherwise valid dependency updates fail after they reach develop.
    "footer-leading-blank": [1, "always"],
    "header-max-length": [2, "always", 100],
    "scope-enum": [1, "always", preferredScopes],
    "subject-case": [2, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "type-enum": [
      2,
      "always",
      [
        "build",
        "chore",
        "ci",
        "docs",
        "feat",
        "fix",
        "perf",
        "refactor",
        "revert",
        "style",
        "test",
      ],
    ],
  },
};
