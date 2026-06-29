function resolveStorage(storage) {
  if (storage) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function readStorageValue(key, fallbackValue = "", storage) {
  const targetStorage = resolveStorage(storage);

  if (!targetStorage) {
    return fallbackValue;
  }

  try {
    const value = targetStorage.getItem(key);
    return value ?? fallbackValue;
  } catch {
    return fallbackValue;
  }
}

export function writeStorageValue(key, value, storage) {
  const targetStorage = resolveStorage(storage);

  if (!targetStorage) {
    return false;
  }

  try {
    targetStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorageValue(key, storage) {
  const targetStorage = resolveStorage(storage);

  if (!targetStorage) {
    return false;
  }

  try {
    targetStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function readStorageJson(key, fallbackValue, storage) {
  const rawValue = readStorageValue(key, null, storage);

  if (rawValue === null) {
    return fallbackValue;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return fallbackValue;
  }
}

export function writeStorageJson(key, value, storage) {
  try {
    return writeStorageValue(key, JSON.stringify(value), storage);
  } catch {
    return false;
  }
}
