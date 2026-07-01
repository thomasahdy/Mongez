import { API_BASE_URL } from "../services/api/apiClient";

const ABSOLUTE_URL_PATTERN = /^(?:[a-z][a-z\d+\-.]*:)?\/\//i;
const INLINE_URL_PATTERN = /^(?:data|blob):/i;

function joinUrl(baseUrl, path) {
  return `${String(baseUrl || "").replace(/\/+$/, "")}/${String(path || "").replace(/^\/+/, "")}`;
}

export function resolveAvatarUrl(value) {
  const url = String(value || "").trim();

  if (!url) {
    return "";
  }

  if (ABSOLUTE_URL_PATTERN.test(url) || INLINE_URL_PATTERN.test(url)) {
    return url;
  }

  if (url.startsWith("/api/")) {
    return url;
  }

  if (url.startsWith("avatars/")) {
    return joinUrl(API_BASE_URL, `/files/key/${encodeURIComponent(url)}/download`);
  }

  return url;
}
