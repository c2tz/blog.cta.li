import type { Page, Request } from "@playwright/test";

const EXPECTED_CANCELLATION_PATTERNS = [
  /\bERR_ABORTED\b/i,
  /\bNS_BINDING_ABORTED\b/i,
  /\bNS_ERROR_ABORT\b/i,
  /\b(?:cancelled|canceled)\b/i,
  /\bframe load interrupted\b/i,
];
const EXPECTED_CONSOLE_WARNING_PATTERNS = [
  // Firefox reports this parser diagnostic for the intentionally subsetted
  // Roboto Mono font even though the used glyphs render and the font loads.
  /downloadable font: glyf: empty gid \d+ used as component.*font-family: "Roboto Mono"/i,
];

function isExpectedRequestCancellation(failureText: string) {
  return EXPECTED_CANCELLATION_PATTERNS.some((pattern) => pattern.test(failureText));
}

function describeFailedRequest(request: Request) {
  const failureText = request.failure()?.errorText || "unknown network failure";
  return `[requestfailed] ${request.method()} ${request.url()}: ${failureText}`;
}

export async function observePageRuntime(page: Page, issues: string[]) {
  const record = (issue: string) => {
    if (!issues.includes(issue)) issues.push(issue);
  };

  page.on("pageerror", (error) => record(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      const text = message.text();
      if (
        message.type() === "warning" &&
        EXPECTED_CONSOLE_WARNING_PATTERNS.some((pattern) => pattern.test(text))
      ) {
        return;
      }
      record(text);
    }
  });
  page.on("requestfailed", (request) => {
    const failureText = request.failure()?.errorText || "";
    if (isExpectedRequestCancellation(failureText)) return;
    record(describeFailedRequest(request));
  });

  await page.exposeFunction("__playwrightRecordRuntimeIssue", (issue: unknown) => {
    record(String(issue));
  });
  await page.addInitScript(() => {
    const report = (issue: string) => {
      try {
        const reporter = Reflect.get(globalThis, "__playwrightRecordRuntimeIssue");
        if (typeof reporter !== "function") return;
        const pending = reporter(issue);
        if (pending && typeof pending.catch === "function") pending.catch(() => undefined);
      } catch {}
    };
    const describeReason = (reason: unknown) => {
      if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
      if (typeof reason === "string") return reason;
      try {
        return JSON.stringify(reason);
      } catch {
        return String(reason);
      }
    };

    document.addEventListener("securitypolicyviolation", (event) => {
      const disposition = event.disposition ? ` (${event.disposition})` : "";
      report(
        `[securitypolicyviolation] ${event.effectiveDirective || event.violatedDirective || "unknown directive"} blocked ${event.blockedURI || "inline content"}${disposition}`,
      );
    });
    window.addEventListener("unhandledrejection", (event) => {
      report(`[unhandledrejection] ${describeReason(event.reason)}`);
    });
  });
}
