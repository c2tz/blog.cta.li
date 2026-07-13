import { SHORTCODE_PATTERN, PAIRED_SHORTCODES } from "./config.mjs";
import { normalizeShortcodeName } from "./ast.mjs";

function tokenizeHugoShortcode(source) {
  const tokens = [];
  let value = "";
  let quote = null;
  let quoteEnd = null;
  let escaped = false;

  const push = () => {
    if (!value) return;
    tokens.push(value);
    value = "";
  };

  for (const character of source.trim()) {
    if (escaped) {
      value += character;
      escaped = false;
      continue;
    }

    if (character === "\\" && quote !== "`") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quoteEnd) {
        quote = null;
        quoteEnd = null;
      } else {
        value += character;
      }
      continue;
    }

    const isClosingCurvedQuote = ["”", "’"].includes(character);
    if (
      ['"', "'", "`", "“", "‘"].includes(character) ||
      (isClosingCurvedQuote && (!value || value.endsWith("=")))
    ) {
      quote = character;
      quoteEnd = character === "“" ? "”" : character === "‘" ? "’" : character;
      continue;
    }

    if (/\s/.test(character)) push();
    else value += character;
  }

  if (escaped) value += "\\";
  if (quote) throw new Error(`Guillemet non fermé dans le shortcode : ${source}`);
  push();
  return tokens;
}

export function parseHugoShortcode(source) {
  const match = source.match(SHORTCODE_PATTERN);
  if (!match || !((match[1] === "<" && match[3] === ">") || match[1] === match[3])) return null;

  let body = match[2].trim();
  const closing = body.startsWith("/");
  if (closing) body = body.slice(1).trim();
  const explicitSelfClosing = !closing && body.endsWith("/");
  if (explicitSelfClosing) body = body.slice(0, -1).trim();

  const [rawName, ...tokens] = tokenizeHugoShortcode(body);
  const name = rawName ? normalizeShortcodeName(rawName) : undefined;
  if (!name) return null;
  if (closing && tokens.length) {
    throw new Error(`Le shortcode fermant ${name} ne peut pas recevoir de paramètres.`);
  }

  const named = {};
  const positional = [];
  for (const token of tokens) {
    const separator = token.indexOf("=");
    if (separator > 0) {
      named[token.slice(0, separator)] = token.slice(separator + 1);
    } else {
      positional.push(token);
    }
  }

  if (positional.length && Object.keys(named).length) {
    throw new Error(`Le shortcode ${name} mélange paramètres nommés et positionnels.`);
  }

  return {
    closing,
    delimiter: match[1],
    name,
    named,
    positional,
    selfClosing: explicitSelfClosing || (!closing && !PAIRED_SHORTCODES.has(name)),
  };
}
