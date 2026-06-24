const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

let csrfTokenCache = null;
let csrfTokenPromise = null;

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function joinUrl(path) {
  if (!path) {
    return API_BASE_URL;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== "") {
          searchParams.append(key, String(item));
        }
      });
      return;
    }

    searchParams.append(key, String(value));
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

async function parseResponse(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return response.text();
  }

  return response.json();
}

function unwrapPayload(payload) {
  if (payload && typeof payload === "object" && "success" in payload) {
    if (payload.success === false) {
      const message =
        payload.error?.message ||
        payload.message ||
        "The request failed.";
      const error = new Error(message);
      error.payload = payload;
      throw error;
    }

    if ("data" in payload) {
      return payload.data;
    }
  }

  return payload;
}

async function fetchCsrfToken() {
  const response = await fetch(joinUrl("/auth/csrf-token"), {
    method: "GET",
    credentials: "include",
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new Error(payload?.message || "Failed to initialize security token.");
  }

  csrfTokenCache = payload?.data?.csrfToken || payload?.csrfToken || null;
  return csrfTokenCache;
}

async function ensureCsrfToken() {
  if (csrfTokenCache) {
    return csrfTokenCache;
  }

  if (!csrfTokenPromise) {
    csrfTokenPromise = fetchCsrfToken().finally(() => {
      csrfTokenPromise = null;
    });
  }

  return csrfTokenPromise;
}

async function refreshSession() {
  const response = await fetch(joinUrl("/auth/refresh"), {
    method: "POST",
    credentials: "include",
    headers: csrfTokenCache ? { "X-CSRF-Token": csrfTokenCache } : undefined,
  });

  if (!response.ok) {
    throw new Error("Session refresh failed.");
  }

  await parseResponse(response);
}

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    params,
    body,
    headers = {},
    unwrap = true,
    raw = false,
    signal,
    retryOnUnauthorized = true,
  } = options;

  const upperMethod = method.toUpperCase();
  const requestHeaders = new Headers(headers);
  const requestInit = {
    method: upperMethod,
    credentials: "include",
    headers: requestHeaders,
    signal,
  };

  if (UNSAFE_METHODS.has(upperMethod)) {
    const csrfToken = await ensureCsrfToken();
    if (csrfToken) {
      requestHeaders.set("X-CSRF-Token", csrfToken);
    }
  }

  if (body instanceof FormData) {
    requestInit.body = body;
  } else if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
    requestInit.body = JSON.stringify(body);
  }

  const response = await fetch(`${joinUrl(path)}${buildQuery(params)}`, requestInit);

  if (response.status === 401 && retryOnUnauthorized) {
    try {
      await refreshSession();
      return apiRequest(path, {
        ...options,
        retryOnUnauthorized: false,
      });
    } catch {
      // Fall through to the original unauthorized error below.
    }
  }

  const payload = raw ? response : await parseResponse(response);

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      response.statusText ||
      "The request failed.";
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return unwrap && !raw ? unwrapPayload(payload) : payload;
}

export function resetApiClientState() {
  csrfTokenCache = null;
  csrfTokenPromise = null;
}

export async function getCsrfToken() {
  return ensureCsrfToken();
}

export { API_BASE_URL };
