const installed = new WeakSet();
const pending = new WeakMap();
let runtimePromise;

function loadRuntime() {
  runtimePromise ??= import("./video-player.js").catch((error) => {
    runtimePromise = undefined;
    throw error;
  });
  return runtimePromise;
}

async function enhance(container) {
  const existing = container.querySelector("mux-player");
  if (existing) return existing;
  if (pending.has(container)) return pending.get(container);
  const status = container.querySelector(".site-video-status");
  const operation = loadRuntime()
    .then((runtime) => runtime.mountVideoPlayer(container))
    .then((player) => {
      status.hidden = true;
      return player;
    })
    .catch(() => {
      status.textContent = "Le lecteur n’a pas pu se charger. Rechargez la page pour réessayer.";
      status.hidden = false;
      return null;
    })
    .finally(() => pending.delete(container));
  pending.set(container, operation);
  return operation;
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      void enhance(entry.target);
    }
  },
  { rootMargin: "240px" },
);

function initVideoPlayers() {
  for (const container of document.querySelectorAll("[data-video-player]")) {
    if (installed.has(container)) continue;
    installed.add(container);
    observer.observe(container);
  }
}

initVideoPlayers();
document.addEventListener("astro:page-load", initVideoPlayers);
document.addEventListener("astro:before-swap", () => observer.disconnect());
