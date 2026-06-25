import { signal } from "@angular/core";

const INITIAL_PROGRESS = 5;
const MAX_LOADING_PROGRESS = 92;
const PROGRESS_INTERVAL_MS = 180;

export class SimulatedLoadingProgress {
  value = signal(0);
  #timer = 0;

  start() {
    this.stopTimer();
    this.value.set(INITIAL_PROGRESS);

    if (typeof window === "undefined") return;

    this.#timer = window.setInterval(() => {
      const current = this.value();
      const increment = Math.max(
        1,
        Math.round((MAX_LOADING_PROGRESS - current) * 0.12),
      );
      this.value.set(Math.min(MAX_LOADING_PROGRESS, current + increment));
    }, PROGRESS_INTERVAL_MS);
  }

  complete() {
    this.stopTimer();
    this.value.set(100);
  }

  reset() {
    this.stopTimer();
    this.value.set(0);
  }

  destroy() {
    this.stopTimer();
  }

  stopTimer() {
    if (typeof window !== "undefined") window.clearInterval(this.#timer);
    this.#timer = 0;
  }
}
