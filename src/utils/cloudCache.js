import {
  loadWorkspace,
  saveWorkspace,
  workspaceEntries,
  acknowledgeWorkspacePending,
} from "./localStore.js";
import { sameValue } from "./workspacePatch.js";

// Confirmed data is shared; unsynced work belongs to its tab, so another tab's
// successful commit cannot erase a conflicting tab's recovery copy.
export function createCloudCache({
  load = loadWorkspace,
  save = saveWorkspace,
  entries = workspaceEntries,
  acknowledge = acknowledgeWorkspacePending,
  session,
} = {}) {
  let tabId;
  try {
    const storage = session ?? globalThis.sessionStorage;
    tabId = storage.getItem("tudagpx-sync-tab");
    if (!tabId) {
      tabId = crypto.randomUUID();
      storage.setItem("tudagpx-sync-tab", tabId);
    }
  } catch {
    // IndexedDB remains the durable fallback when sessionStorage is disabled.
    tabId = "restricted-storage";
  }
  const sharedKey = (ownerId) => `cloud-sync-v2:${ownerId}`;
  const tabKey = (ownerId) => `${sharedKey(ownerId)}:${tabId}`;
  return {
    async load(ownerId) {
      const own = await load(tabKey(ownerId));
      if (own?.pending) return own;
      if (!own) {
        const pending = (await entries(`${sharedKey(ownerId)}:`))
          .map(({ value }) => value)
          .filter((entry) => entry.pending)
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
        // A fresh tab/browser session must also recover closed tabs' work.
        if (pending) return pending;
      }
      const shared = await load(sharedKey(ownerId));
      if (!shared && !own) {
        // Additive safety copy on first upgrade; never discard pre-v2 local work.
        const legacy = await load();
        if (legacy) await save(legacy, `cloud-before-incremental:${ownerId}`);
      }
      return shared && (!own || shared.version >= own.version) ? shared : own;
    },
    async save(ownerId, envelope) {
      await save({ ...envelope, updatedAt: Date.now() }, tabKey(ownerId));
      if (!envelope.pending) {
        const shared = await load(sharedKey(ownerId));
        if (!shared || envelope.version >= shared.version)
          await save(envelope, sharedKey(ownerId));
        for (const { key, value } of await entries(`${sharedKey(ownerId)}:`)) {
          if (
            value.pending &&
            value.version <= envelope.version &&
            sameValue(value.pending, envelope.data)
          )
            await acknowledge(key, envelope);
        }
      }
    },
  };
}
