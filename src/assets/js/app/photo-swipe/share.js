import { SITE_EVENTS } from "@/lib/site-contracts";
import { fileNameFromURL } from "../url.js";

export async function downloadViaFetch(url, filename) {
  const res = await fetch(url, { mode: "cors" });
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

function dispatchPhotoSwipeShareResult(message) {
  document.dispatchEvent(
    new CustomEvent(SITE_EVENTS.photoSwipeShareResult, { detail: { message } }),
  );
}

async function getPhotoSwipeShareFile(url) {
  const parsed = new URL(url, location.href);
  const response = await fetch(parsed.href, {
    cache: "force-cache",
    credentials: parsed.origin === location.origin ? "same-origin" : "omit",
    mode: "cors",
  });
  if (!response.ok) throw new Error(`image_share_${response.status}`);

  const blob = await response.blob();
  return new File([blob], fileNameFromURL(parsed.href), {
    type: blob.type || "image/jpeg",
  });
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto 0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
    window.getSelection()?.removeAllRanges();
  }
}

export async function sharePhotoSwipeImage(src) {
  const url = new URL(src, location.href).href;

  if (navigator.share) {
    try {
      const file = await getPhotoSwipeShareFile(url).catch(() => null);
      const fileShareData = file ? { files: [file], title: document.title } : null;

      if (fileShareData && navigator.canShare?.(fileShareData)) {
        await navigator.share(fileShareData);
      } else {
        await navigator.share({ title: document.title, url });
      }
      dispatchPhotoSwipeShareResult("Image partagée");
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    const copied = await copyTextToClipboard(url);
    if (!copied) throw new Error("copy_failed");
    dispatchPhotoSwipeShareResult("Lien copié");
  } catch {
    dispatchPhotoSwipeShareResult("Copie impossible");
  }
}
