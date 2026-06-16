import { DEFAULT_INPUTS } from "./constants.js";
import { cloneInputs, sanitizeInputs } from "./input-sanitizer.js";

export function normalizeExternalStep1Inputs(_source, rawInputs, fallback = DEFAULT_INPUTS) {
  const base = fallback ? cloneInputs(fallback) : cloneInputs(DEFAULT_INPUTS);
  const raw = rawInputs && typeof rawInputs === "object" ? rawInputs : {};
  return sanitizeInputs({ ...base, ...raw });
}
