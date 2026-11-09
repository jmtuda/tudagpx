import { test, expect } from "@playwright/test";

async function state(page) {
  await expect(page.locator(".local-status > span")).toHaveText(
    "Guardado en este navegador",
  );
  return page.evaluate(async () =>
    (await import("/src/utils/localStore.js")).loadWorkspace(),
  );
}
test("una actualización local inválida aborta sin borrar trabajo", async ({
  page,
}) => {
  await page.goto("/");
  await state(page);
  const result = await page.evaluate(async () => {
    const store = await import("/src/utils/localStore.js");
    const original = await store.loadWorkspace();
    const malformed = { ...original, routes: null };
    await store.saveWorkspace(
      original,
      "cloud-before-incremental:rollback-test",
    );
    await store.saveWorkspace(malformed);
    let failed = false;
    try {
      await store.migrateCurrentOnlyStorage();
    } catch {
      failed = true;
    }
    const preserved = await store.loadWorkspace();
    const backup = await store.loadWorkspace(
      "cloud-before-incremental:rollback-test",
    );
    await store.saveWorkspace(original);
    await store.migrateCurrentOnlyStorage();
    return { failed, preserved, backup, original, malformed };
  });
  expect(result.failed).toBe(true);
  expect(result.preserved).toEqual(result.malformed);
  expect(result.backup).toEqual(result.original);
});

for (const width of [1440, 390]) {
  test(`actualiza biblioteca antigua sin papelera ni proyectos ocultos ${width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/");
    const before = await state(page);
    await page.evaluate(async () => {
      const store = await import("/src/utils/localStore.js");
      const data = await store.loadWorkspace();
      data.routes.push({
        ...structuredClone(data.routes[0]),
        id: "deleted-route",
        name: "Ruta borrada antigua",
        deletedAt: "2026-10-30T12:00:00Z",
      });
      data.segments.push({
        ...structuredClone(data.segments[0]),
        id: "deleted-segment",
        name: "Segmento borrado antiguo",
        deletedAt: "2026-10-30T12:00:00Z",
      });
      data.projects = [
        {
          id: "legacy-project",
          name: "Trabajo recuperado visible",
          elements: [
            {
              id: "legacy-copy",
              name: "Trazado recuperado",
              points: structuredClone(data.routes[0].tracks[0]),
            },
          ],
        },
      ];
      await store.saveWorkspace(data);
      await store.saveWorkspace(data, "cloud-before-incremental:legacy-owner");
      await store.saveWorkspace(
        { version: 1, data, pending: null },
        "cloud-sync-v2:legacy-owner",
      );
    });
    await page.reload();
    const updated = await state(page);
    expect(updated.routes).toEqual(before.routes);
    expect(updated.segments).toEqual(before.segments);
    expect(updated.projects).toEqual([]);
    expect(updated.draft).toHaveLength(before.draft.length + 1);
    const recovered = updated.draft.at(-1);
    expect(recovered.editorRouteName).toBe("Trabajo recuperado visible");
    expect(recovered.points).toEqual(before.routes[0].tracks[0]);
    const archives = await page.evaluate(async () => {
      const store = await import("/src/utils/localStore.js");
      return {
        backups: await store.workspaceEntries("cloud-before-incremental:"),
        cache: await store.loadWorkspace("cloud-sync-v2:legacy-owner"),
      };
    });
    expect(archives.backups).toEqual([]);
    expect(archives.cache).toBeUndefined();
    await expect(
      page.getByText("Ruta borrada antigua", { exact: true }),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
    await expect(
      page.getByRole("tab", {
        name: "Trabajo recuperado visible",
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    expect((await state(page)).draft).toEqual(updated.draft);
    await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
    await page.getByText("Copias de seguridad", { exact: true }).click();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Descargar copia completa", exact: true })
      .click();
    const fs = await import("node:fs/promises");
    const backup = JSON.parse(
      await fs.readFile(await (await download).path(), "utf8"),
    );
    expect(backup.routes).toEqual(before.routes);
    expect(backup.segments).toEqual(before.segments);
    expect(backup.projects).toEqual([]);
    expect(backup.draft).toEqual(updated.draft);
    await page.screenshot({ path: info.outputPath("current-library.png") });
  });
}
