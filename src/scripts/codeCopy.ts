export function initCodeCopy() {
  const run = () => {
    const codeBlocks = document.querySelectorAll("pre > code");

    codeBlocks.forEach((codeBlock) => {
      const pre = codeBlock.parentElement;
      if (!pre || pre.dataset.styled === "1") return;
      pre.dataset.styled = "1";

      const langClass = Array.from(codeBlock.classList).find((c) =>
        c.startsWith("language-"),
      );
      const dataLang =
        codeBlock.getAttribute("data-language") ||
        codeBlock.getAttribute("data-lang") ||
        pre.getAttribute("data-language") ||
        pre.getAttribute("data-lang");

      const preLangClass = Array.from(pre.classList || []).find((c) =>
        c.startsWith("language-"),
      );

      let lang =
        (langClass && langClass.replace("language-", "")) ||
        (preLangClass && preLangClass.replace("language-", "")) ||
        (dataLang || "").toLowerCase();

      if (!lang) lang = "code";

      const shell = document.createElement("div");
      shell.className = "code-shell";
      pre.parentNode?.insertBefore(shell, pre);
      shell.appendChild(pre);

      const header = document.createElement("div");
      header.className = "code-header";

      const langEl = document.createElement("div");
      langEl.className = "code-lang";
      langEl.textContent = lang;

      const actions = document.createElement("div");
      actions.className = "code-actions";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "code-copy-btn";
      button.setAttribute("aria-label", "Copier le code");

      /* ✅ Icône COPIE (ancienne, correcte) */
      const copyIcon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      copyIcon.setAttribute("viewBox", "0 -960 960 960");
      copyIcon.classList.add("code-icon", "code-copy-icon");
      copyIcon.setAttribute("width", "16");
      copyIcon.setAttribute("height", "16");
      copyIcon.setAttribute("fill", "currentColor");
      copyIcon.innerHTML = `
  <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/>
`;

      /* ✅ Icône CHECK */
      const checkIcon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      checkIcon.setAttribute("viewBox", "0 -960 960 960");
      checkIcon.classList.add("code-icon", "code-check-icon");
      checkIcon.setAttribute("width", "16");
      checkIcon.setAttribute("height", "16");
      checkIcon.setAttribute("fill", "currentColor");
      checkIcon.innerHTML = `
  <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
`;

      /* ✅ Icône ERREUR (celle que tu as donnée) */
      const errorIcon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      errorIcon.setAttribute("viewBox", "0 -960 960 960");
      errorIcon.classList.add("code-icon", "code-error-icon");
      errorIcon.setAttribute("width", "16");
      errorIcon.setAttribute("height", "16");
      errorIcon.setAttribute("fill", "currentColor");
      errorIcon.innerHTML = `
  <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
`;

      const label = document.createElement("span");
      label.textContent = "Copier le code";

      button.appendChild(copyIcon);
      button.appendChild(checkIcon);
      button.appendChild(errorIcon);
      button.appendChild(label);

      const revertDelay = 1000;

      button.addEventListener("click", async () => {
        const text = (codeBlock as HTMLElement).innerText;

        const markCopied = (status: string) => {
          button.classList.remove("is-error");
          button.classList.add("is-copied");
          label.textContent = status;
          setTimeout(() => {
            button.classList.remove("is-copied");
            label.textContent = "Copier le code";
          }, revertDelay);
        };

        try {
          await navigator.clipboard.writeText(text);
          markCopied("Copié");
        } catch {
          button.classList.remove("is-copied");
          button.classList.add("is-error");
          label.textContent = "Erreur";

          setTimeout(() => {
            button.classList.remove("is-error");
            label.textContent = "Copier le code";
          }, revertDelay);
        }
      });

      actions.appendChild(button);
      header.appendChild(langEl);
      header.appendChild(actions);
      shell.insertBefore(header, pre);
    });
  };

  run();

  // ✅ Support navigation Astro
  addEventListener("astro:page-load", run);
}
