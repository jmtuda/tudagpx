import { createRemoteStore } from "./workspaceTransfer";
export const cloudEnabled = import.meta.env.VITE_CLOUD_ENABLED === "true";
const remote = createRemoteStore();
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
  await remote.save(data);
}
