import { sameValue, CURRENT_POLICY } from "./workspacePatch.js";
import { currentWorkspace } from "./currentWorkspace.js";

const DB = "tudagpx-local-v1";
function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("workspace");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function loadWorkspace(key = "current") {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readonly");
    const req = tx.objectStore("workspace").get(key);
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function saveWorkspace(data, key = "current") {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite");
    tx.objectStore("workspace").put(data, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("Guardado cancelado"));
    };
  });
}
export async function workspaceEntries(prefix) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const rows = [];
    const tx = db.transaction("workspace", "readonly");
    const request = tx
      .objectStore("workspace")
      .openCursor(IDBKeyRange.bound(prefix, `${prefix}\uffff`));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        rows.push({ key: cursor.key, value: cursor.value });
        cursor.continue();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(rows);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function migrateCurrentOnlyStorage() {
  const db = await open();
  return new Promise((resolve, reject) => {
    let failure;
    const tx = db.transaction("workspace", "readwrite");
    const request = tx.objectStore("workspace").openCursor();
    request.onsuccess = () => {
      try {
        const cursor = request.result;
        if (!cursor) return;
        const key = String(cursor.key);
        const entry = cursor.value;
        if (key.startsWith("cloud-before-incremental:")) cursor.delete();
        else if (key.startsWith("cloud-sync-v2:")) {
          if (!entry?.pending && entry?.policy !== CURRENT_POLICY)
            cursor.delete();
          else if (entry?.pending)
            cursor.update({
              ...entry,
              data: currentWorkspace(entry.data),
              pending: currentWorkspace(entry.pending),
            });
        } else if (key === "current" && entry?.schema === 1)
          cursor.update(currentWorkspace(entry));
        cursor.continue();
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(failure || tx.error || new Error("Actualización local cancelada"));
    };
  });
}
export async function acknowledgeWorkspacePending(key, confirmed) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite");
    const store = tx.objectStore("workspace");
    const request = store.get(key);
    request.onsuccess = () => {
      const current = request.result;
      if (
        current &&
        current.version <= confirmed.version &&
        (!current.pending || sameValue(current.pending, confirmed.data))
      )
        store.put(confirmed, key);
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("Confirmación local cancelada"));
    };
  });
}
export function download(text, name, type = "application/gpx+xml") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
