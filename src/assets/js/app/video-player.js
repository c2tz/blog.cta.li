import "media-chrome/dist/lang/fr.js";
import { setLanguage } from "media-chrome/dist/utils/i18n.js";
import { videoPlaybackUrl } from "@/lib/video-sources.mjs";

let playerDefinition;

export async function mountVideoPlayer(container) {
  setLanguage("fr");
  playerDefinition ??= import("@mux/mux-player").catch((error) => {
    playerDefinition = undefined;
    throw error;
  });
  await playerDefinition;
  if (!container.isConnected) return null;

  const player = document.createElement("mux-player");
  const attributes = {
    lang: "fr",
    "aria-label": container.dataset.videoTitle,
    "video-title": container.dataset.videoTitle,
    "stream-type": "on-demand",
    "prefer-playback": "mse",
    preload: "none",
    playsinline: "",
    "disable-tracking": "",
    "disable-cookies": "",
    "disable-picture-in-picture": "",
    "no-volume-pref": "",
    "no-muted-pref": "",
    src: videoPlaybackUrl(container.dataset.videoSrc, location.href),
  };
  if (container.dataset.videoPoster) {
    attributes.poster = videoPlaybackUrl(container.dataset.videoPoster, location.href);
  }
  for (const [name, value] of Object.entries(attributes)) player.setAttribute(name, value);
  container.querySelector("[data-video-stage]").replaceChildren(player);
  player.mediaController?.setAttribute("lang", "fr");
  return player;
}
