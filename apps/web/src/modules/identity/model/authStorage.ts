import { PASSWORD_PROMPT_FLAG } from "./authFlow.ts";

const removeKey = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Identity compatibility storage is best-effort.
  }
};

export const hasPasswordSetupPrompt = (): boolean => {
  try {
    return localStorage.getItem(PASSWORD_PROMPT_FLAG) === "1";
  } catch {
    return false;
  }
};

export const setPasswordSetupPrompt = (enabled: boolean): void => {
  try {
    if (enabled) {
      localStorage.setItem(PASSWORD_PROMPT_FLAG, "1");
    } else {
      localStorage.removeItem(PASSWORD_PROMPT_FLAG);
    }
  } catch {
    // The server session remains authoritative when storage is unavailable.
  }
};

export const clearIdentityCompatibilityStorage = (): void => {
  [
    PASSWORD_PROMPT_FLAG,
    "auth.name",
    "auth.email",
    "auth.access",
    "auth.refresh",
    "auth.expiredAt",
  ].forEach(removeKey);
};
