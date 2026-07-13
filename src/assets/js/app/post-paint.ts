type PostPaintTask = () => void | Promise<void>;
const POST_PAINT_DELAY_MS = 100;

export function schedulePostPaint(task: PostPaintTask) {
  const schedule = () => {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => void task(), POST_PAINT_DELAY_MS);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule, { once: true });
  } else {
    schedule();
  }
}
