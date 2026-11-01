import { createRemoteStore } from "./workspaceTransfer";
import { createCloudCache } from "./cloudCache";
import { createSyncScheduler } from "./syncScheduler";
export const cloudEnabled = import.meta.env.VITE_CLOUD_ENABLED === "true";
const remote = createRemoteStore(fetch, {
  cache: createCloudCache(),
});
const scheduler = createSyncScheduler((data) =>
  remote.save(data, { staged: true }),
);
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    void scheduler.flush();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void scheduler.flush();
  });
}
export async function stageCloudWorkspace(data) {
  await remote.stage(data);
}
export async function loadCloudWorkspace() {
  const data = await remote.load();
  return (
    data || {
      schema: 1,
      routes: [],
      segments: [],
      draft: [],
      draftName: "Mi nueva ruta",
      projects: [],
    }
  );
}
export async function saveCloudWorkspace(data) {
  await scheduler.schedule(data);
}
