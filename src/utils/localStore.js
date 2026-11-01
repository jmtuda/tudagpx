import { sameValue } from "./workspacePatch.js";

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
export async function acknowledgeWorkspacePending(key, confirmed) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite");
    const store = tx.objectStore("workspace");
    const request = store.get(key);
    request.onsuccess = () => {
      const current = request.result;
      if (
        current?.pending &&
        current.version <= confirmed.version &&
        sameValue(current.pending, confirmed.data)
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
