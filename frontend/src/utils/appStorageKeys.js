import { readStorageValue, removeStorageValue, writeStorageValue } from "./browserStorage";

export const ACTIVE_SPACE_STORAGE_KEY = "mongez.activeSpaceId";
const LEGACY_ACTIVE_SPACE_STORAGE_KEY = "activeSpaceId";

export function readActiveSpaceId() {
  return (
    readStorageValue(ACTIVE_SPACE_STORAGE_KEY, "") ||
    readStorageValue(LEGACY_ACTIVE_SPACE_STORAGE_KEY, "")
  );
}

export function writeActiveSpaceId(spaceId) {
  if (!spaceId) {
    removeActiveSpaceId();
    return;
  }

  writeStorageValue(ACTIVE_SPACE_STORAGE_KEY, spaceId);
  removeStorageValue(LEGACY_ACTIVE_SPACE_STORAGE_KEY);
}

export function removeActiveSpaceId() {
  removeStorageValue(ACTIVE_SPACE_STORAGE_KEY);
  removeStorageValue(LEGACY_ACTIVE_SPACE_STORAGE_KEY);
}
