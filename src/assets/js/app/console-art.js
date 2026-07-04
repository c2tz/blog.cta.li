const CONSOLE_ART_URL = "/console/console-signature.gif?v=20260704-console-3";
const CONSOLE_ART_WIDTH = 256;
const CONSOLE_ART_HEIGHT = 39;

let didLogConsoleArt = false;

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("error", reject, { once: true });
    reader.addEventListener("load", () => resolve(reader.result), { once: true });
    reader.readAsDataURL(blob);
  });
}

function getConsoleImageBox(width, height) {
  return {
    string: "+",
    style: [
      "font-size: 1px",
      `padding: ${Math.floor(height / 2)}px ${Math.floor(width / 2)}px`,
      "line-height: 1px",
      "background-color: #000",
    ].join(";"),
  };
}

function logConsoleImage(dataUrl, width, height) {
  const box = getConsoleImageBox(width, height);

  console.log(
    `%c${box.string}`,
    [
      box.style,
      `background: #000 url(${dataUrl}) center / ${width}px ${height}px no-repeat`,
      `background-size: ${width}px ${height}px`,
      "background-repeat: no-repeat",
      "color: transparent",
    ].join(";"),
  );
}

async function logConsoleGif() {
  const response = await fetch(CONSOLE_ART_URL, { cache: "force-cache" });
  if (!response.ok) return;

  const dataUrl = await blobToDataUrl(await response.blob());
  const image = new Image();

  image.addEventListener(
    "load",
    () => {
      logConsoleImage(
        dataUrl,
        image.naturalWidth || CONSOLE_ART_WIDTH,
        image.naturalHeight || CONSOLE_ART_HEIGHT,
      );
    },
    { once: true },
  );
  image.src = dataUrl;
}

export function initConsoleArt() {
  if (didLogConsoleArt) return;
  didLogConsoleArt = true;

  const logArt = () => {
    void logConsoleGif();
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(logArt, { timeout: 1200 });
    return;
  }

  window.setTimeout(logArt, 700);
}
