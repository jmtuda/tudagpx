import { test, expect } from "@playwright/test";

test("caché conserva pendientes por pestaña sin archivos históricos ocultos", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".local-status > span")).toHaveText(
    "Guardado en este navegador",
  );
  const legacy = await page.evaluate(async () => {
    const store = await import("/src/utils/localStore.js");
    const cache = (await import("/src/utils/cloudCache.js")).createCloudCache();
    const previous = await store.loadWorkspace();
    await store.saveWorkspace(
      previous,
      "cloud-before-incremental:sync-test-owner",
    );
    await store.migrateCurrentOnlyStorage();
    await cache.load("sync-test-owner");
    return {
      previous,
      backup: await store.loadWorkspace(
        "cloud-before-incremental:sync-test-owner",
      ),
    };
  });
  expect(legacy.backup).toBeUndefined();
  const other = await page.context().newPage();
  await other.goto("/");
  await expect(other.locator(".local-status > span")).toHaveText(
    "Guardado en este navegador",
  );
  await page.evaluate(async () => {
    const cache = (await import("/src/utils/cloudCache.js")).createCloudCache();
    await cache.save("sync-test-owner", {
      policy: "current-only-v1",
      version: 1,
      data: {
        ...(await import("/src/utils/workspacePatch.js")).emptyCloudWorkspace(),
        draftName: "Confirmado",
      },
      pending: null,
    });
  });
  await other.evaluate(async () => {
    const cache = (await import("/src/utils/cloudCache.js")).createCloudCache();
    const confirmed = await cache.load("sync-test-owner");
    await cache.save("sync-test-owner", {
      ...confirmed,
      pending: { ...confirmed.data, draftName: "Trabajo de segunda pestaña" },
    });
  });
  await page.evaluate(async () => {
    const cache = (await import("/src/utils/cloudCache.js")).createCloudCache();
    await cache.save("sync-test-owner", {
      policy: "current-only-v1",
      version: 2,
      data: {
        ...(await import("/src/utils/workspacePatch.js")).emptyCloudWorkspace(),
        draftName: "Cambio de primera pestaña",
      },
      pending: null,
    });
  });
  await other.reload();
  const recovered = await other.evaluate(async () =>
    (await import("/src/utils/cloudCache.js"))
      .createCloudCache()
      .load("sync-test-owner"),
  );
  expect(recovered.version).toBe(1);
  expect(recovered.pending.draftName).toBe("Trabajo de segunda pestaña");
  const current = await page.evaluate(async () =>
    (await import("/src/utils/cloudCache.js"))
      .createCloudCache()
      .load("sync-test-owner"),
  );
  expect(current.version).toBe(2);
  expect(current.pending).toBeNull();
  const stranger = await other.evaluate(async () =>
    (await import("/src/utils/cloudCache.js"))
      .createCloudCache()
      .load("other-owner"),
  );
  expect(stranger).toBeUndefined();
  await other.close();
  const reopened = await page.context().newPage();
  await reopened.goto("/");
  const orphan = await reopened.evaluate(async () =>
    (await import("/src/utils/cloudCache.js"))
      .createCloudCache()
      .load("sync-test-owner"),
  );
  expect(orphan.pending.draftName).toBe("Trabajo de segunda pestaña");
  await reopened.evaluate(async (entry) => {
    const cache = (await import("/src/utils/cloudCache.js")).createCloudCache();
    await cache.save("sync-test-owner", {
      policy: "current-only-v1",
      version: 3,
      data: entry.pending,
      pending: null,
    });
  }, orphan);
  const acknowledged = await page.evaluate(async () => {
    const store = await import("/src/utils/localStore.js");
    return store.workspaceEntries("cloud-sync-v2:sync-test-owner:");
  });
  expect(acknowledged.every(({ value }) => value.pending === null)).toBe(true);
  await reopened.close();
});
