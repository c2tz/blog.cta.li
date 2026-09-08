import { SITE_COOKIE_NAMES } from "@/lib/site-contracts";
import { readCookieValue, serializeCookie } from "./site-persistence.js";

const REQUIRED_AGE = 18;
const MIN_VALID_AGE = 6;
const MAX_VALID_AGE = 99;
const YOUNG_AGE_MIN = 6;
const YOUNG_AGE_MAX = 17;
const YOUNG_GAMES = Object.freeze([
  "Roblox",
  "Minecraft",
  "Pokémon",
  "Mario",
  "Brawl Stars",
  "Fortnite",
  "Tesla",
  "One Piece",
  "Naruto",
]);
const boundRoots = new WeakSet();

function readCookie(name) {
  return readCookieValue(document.cookie, name);
}

function writeCookie(name, value) {
  document.cookie = serializeCookie(name, value);
}

function expireCookie(name) {
  document.cookie = serializeCookie(name, "", { maxAgeSeconds: 0 });
}

function normalizeBirthDate(value) {
  const normalized = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized
    ? null
    : normalized;
}

function ageFromBirthDate(birthDateValue) {
  const normalized = normalizeBirthDate(birthDateValue);
  if (normalized === null) return null;

  const [year, month, day] = normalized.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const birthdayPassed =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayPassed) age -= 1;
  return age;
}

function isValidAge(age) {
  return Number.isInteger(age) && age >= MIN_VALID_AGE && age <= MAX_VALID_AGE;
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function randomYoungGame() {
  return YOUNG_GAMES[Math.floor(Math.random() * YOUNG_GAMES.length)];
}

function youngGameMessage(game) {
  if (game === "Mario") {
    return "Retourne jouer à Mario, nous c’est dans la vraie vie qu’on rentre dans les tuyaux, t’es pas prêt gamin.";
  }
  if (game === "Tesla") {
    return "Retourne jouer avec la Tesla de ton père qui fait des bruits de pet, t’es pas prêt gamin.";
  }
  if (game === "One Piece" || game === "Naruto") {
    return `Retourne regarder ${game}, t’es pas prêt gamin.`;
  }

  return `Retourne jouer à ${game}, t’es pas prêt gamin.`;
}

export function bindExplicitContentAge(root) {
  if (boundRoots.has(root)) return;

  const ageField = root.querySelector("[data-cookie-age]");
  const acknowledgeButton = root.querySelector("[data-cookie-action='acknowledge']");
  const ageStatus = root.querySelector("[data-cookie-age-status]");
  if (!(ageField instanceof HTMLElement) || !(acknowledgeButton instanceof HTMLElement)) return;

  boundRoots.add(root);
  let lastUserSelectedBirthDate = null;
  let youthMessage = "";
  const sync = (userInitiated = false) => {
    const value = String(ageField.value ?? ageField.getAttribute("value") ?? "");
    const normalized = normalizeBirthDate(value);
    const age = ageFromBirthDate(normalized);
    const validAge = isValidAge(age);
    const adult = validAge && age >= REQUIRED_AGE;
    const hasValue = value.length > 0;
    const young = validAge && age >= YOUNG_AGE_MIN && age <= YOUNG_AGE_MAX;
    const newUserSelection = userInitiated && normalized !== lastUserSelectedBirthDate;

    acknowledgeButton.toggleAttribute("disabled", !adult);
    acknowledgeButton.setAttribute("aria-disabled", String(!adult));
    ageField.setAttribute("aria-invalid", String(hasValue && (!normalized || !validAge)));
    if (normalized === null || !validAge) {
      expireCookie(SITE_COOKIE_NAMES.explicitContentAge);
    } else {
      writeCookie(SITE_COOKIE_NAMES.explicitContentAge, normalized);
    }
    if (ageStatus) {
      if (hasValue && (!normalized || !validAge)) {
        youthMessage = "";
        ageStatus.textContent = "Veuillez saisir une date valide.";
      } else if (young) {
        if (newUserSelection) {
          youthMessage = youngGameMessage(randomYoungGame());
        }
        ageStatus.textContent = youthMessage;
      } else {
        youthMessage = "";
        ageStatus.textContent = "";
      }
    }
    if (userInitiated) lastUserSelectedBirthDate = normalized;
  };

  const rememberedBirthDate = normalizeBirthDate(readCookie(SITE_COOKIE_NAMES.explicitContentAge));
  ageField.setAttribute("max", localDateValue());
  if (rememberedBirthDate !== null) {
    ageField.setAttribute("value", rememberedBirthDate);
    ageField.value = rememberedBirthDate;
  }
  ageField.addEventListener("change", () => sync(true));
  ageField.addEventListener("input", () => sync(true));
  sync();
  void customElements.whenDefined("md-outlined-text-field").then(() => {
    if (!ageField.isConnected) return;
    if (rememberedBirthDate !== null) ageField.value = rememberedBirthDate;
    sync();
  });
}
