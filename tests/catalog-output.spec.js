import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { validateChange } from "../server/workspaceTransport.js";
import { pinLibraries, sendLibraryItem, showLibrary } from "./helpers/library";

const fixture = new URL("./fixtures/ruta.gpx", import.meta.url).pathname;
async function state(page) {
  await expect(page.locator(".local-status > span")).toHaveText(
    "Guardado en este navegador",
  );
  return page.evaluate(async () =>
    (await import("/src/utils/localStore.js")).loadWorkspace(),
  );
}
async function openEditor(page) {
  await page.goto("/");
  await pinLibraries(page);
  await page.getByRole("tab", { name: "Editar", exact: true }).click();
}
async function confirm(page, button, accept, name) {
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain("Borrar definitivamente");
    expect(dialog.message()).toContain(name);
    if (accept) await dialog.accept();
    else await dialog.dismiss();
  });
  await button.click();
}
async function rename(page, name, value) {
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("prompt");
    expect(dialog.defaultValue()).toBe(name);
    if (value === null) await dialog.dismiss();
    else await dialog.accept(value);
  });
  await page
    .getByRole("button", { name: `Editar nombre de ${name}`, exact: true })
    .click();
}
for (const width of [1440, 390]) {
  test(`renombrar y borrar ruta con confirmación sin sobrescribir original ni cerrar copia en ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await openEditor(page);
    await page.locator("input[type=file]").first().setInputFiles(fixture);
    await sendLibraryItem(page, "route", -1);
    const before = await state(page);
    const original = before.routes.at(-1);
    await showLibrary(page, "route");
    await rename(page, original.name, null);
    expect(await state(page)).toEqual(before);
    await rename(page, original.name, "   ");
    expect(await state(page)).toEqual(before);
    await rename(page, original.name, "  Ruta con nombre nuevo 🏔  ");
    const name = "Ruta con nombre nuevo 🏔";
    const renamed = await state(page);
    expect(renamed.routes.at(-1)).toEqual({ ...original, name });
    expect(renamed.draft).toEqual(before.draft);
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await confirm(
      page,
      page.getByRole("button", { name: `Borrar ${name}`, exact: true }),
      false,
      name,
    );
    expect(await state(page)).toEqual(renamed);
    await confirm(
      page,
      page.getByRole("button", { name: `Borrar ${name}`, exact: true }),
      true,
      name,
    );
    const deleted = await state(page);
    expect(deleted.routes.some((route) => route.id === original.id)).toBe(
      false,
    );
    expect(deleted.routes).toEqual(before.routes.slice(0, -1));
    expect(deleted.segments).toEqual(before.segments);
    expect(deleted.draft).toEqual(before.draft);
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(
      0,
    );
    await page.reload();
    await pinLibraries(page);
    await page
      .getByRole("navigation", { name: "Biblioteca", exact: true })
      .getByRole("button", { name: /^Rutas/ })
      .click();
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(
      0,
    );
    expect((await state(page)).draft).toEqual(before.draft);
    await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: `Mostrar ${name}`, exact: true }),
    ).toHaveCount(0);
    // The same server policy used by Neon permits metadata changes, not overwrites.
    expect(() => validateChange(renamed, before)).not.toThrow();
    expect(() => validateChange(deleted, renamed)).toThrow();
    expect(() =>
      validateChange(deleted, renamed, { remove: { routes: [original.id] } }),
    ).not.toThrow();
    for (const mutate of [
      (d) => {
        d.routes.at(-1).tracks[0][0].lat += 0.01;
      },
      (d) => {
        d.routes.at(-1).originalBase64 = "YQ==";
      },

      (d) => {
        d.segments[0].points[0].lon += 0.01;
      },
    ]) {
      const changed = structuredClone(before);
      mutate(changed);
      expect(() => validateChange(changed, before)).toThrow();
    }
  });
  test(`renombrar y borrar segmento siempre confirmado conserva copia abierta en ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await openEditor(page);
    await sendLibraryItem(page, "segment", 0);
    const before = await state(page);
    const original = before.segments[0];
    await showLibrary(page, "segment");
    await page
      .getByRole("checkbox", { name: `Mostrar ${original.name}`, exact: true })
      .check();
    await rename(page, original.name, "Segmento renombrado");
    const renamed = await state(page);
    expect(renamed.segments[0]).toEqual({
      ...original,
      name: "Segmento renombrado",
    });
    await confirm(
      page,
      page.getByRole("button", {
        name: "Borrar Segmento renombrado",
        exact: true,
      }),
      false,
      "Segmento renombrado",
    );
    expect(await state(page)).toEqual(renamed);
    await confirm(
      page,
      page.getByRole("button", {
        name: "Borrar Segmento renombrado",
        exact: true,
      }),
      true,
      "Segmento renombrado",
    );
    const deleted = await state(page);
    expect(deleted.segments.some((segment) => segment.id === original.id)).toBe(
      false,
    );
    expect(deleted.segments).toEqual(before.segments.slice(1));
    expect(deleted.routes).toEqual(before.routes);
    expect(deleted.draft).toEqual(before.draft);
    expect(() => validateChange(deleted, before)).toThrow();
    expect(() =>
      validateChange(deleted, before, { remove: { segments: [original.id] } }),
    ).not.toThrow();
    await expect(
      page.getByRole("heading", { name: "Segmento renombrado", exact: true }),
    ).toHaveCount(0);
    await page.reload();
    expect(await state(page)).toEqual(deleted);
  });
}
for (const kind of ["ruta", "segmento"]) {
  test(`guardar ${kind} valida GPX automáticamente sin pedir aceptación de avisos ni cambiar el original`, async ({
    page,
  }) => {
    await openEditor(page);
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "sin-altitud.gpx",
        mimeType: "application/gpx+xml",
        buffer: Buffer.from(
          '<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Sin elevación</name><trkseg><trkpt lat="40.4168" lon="-3.7038"/><trkpt lat="40.42" lon="-3.7"/></trkseg></trk></gpx>',
        ),
      });
    await sendLibraryItem(page, "route", -1);
    const before = await state(page);
    await page
      .getByRole("button", { name: `Guardar ${kind}`, exact: true })
      .click();
    const nameDialog = page.getByRole("dialog", {
      name: `Guardar ${kind}`,
      exact: true,
    });
    await expect(
      nameDialog.getByLabel(
        kind === "ruta" ? "Nombre de la ruta" : "Nombre del segmento",
        { exact: true },
      ),
    ).toBeVisible();
    const dialog = page.getByRole("dialog", {
      name: "Revisión GPX",
      exact: true,
    });
    await expect(dialog).toHaveCount(0);
    expect(await state(page)).toEqual(before);
    await nameDialog
      .getByRole("button", { name: `Guardar ${kind}`, exact: true })
      .click();
    await expect(nameDialog).toBeHidden();
    await expect
      .poll(
        async () =>
          (await state(page))[kind === "ruta" ? "routes" : "segments"].length,
      )
      .toBe(before[kind === "ruta" ? "routes" : "segments"].length + 1);
    const after = await state(page);
    expect(after.draft).toEqual(before.draft);
    expect(after.routes.slice(0, before.routes.length)).toEqual(before.routes);
    if (kind === "ruta")
      expect(after.routes).toHaveLength(before.routes.length + 1);
    else expect(after.segments).toHaveLength(before.segments.length + 1);
    await page
      .getByRole("button", { name: "Exportar a GPX", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Descargar GPX", exact: true }),
    ).toBeDisabled();
    await dialog.getByRole("checkbox").check();
    const download = page.waitForEvent("download");
    await dialog
      .getByRole("button", { name: "Descargar GPX", exact: true })
      .click();
    const xml = await readFile(await (await download).path(), "utf8");
    const parsed = await page.evaluate(
      async (xml) => (await import("/src/utils/workspace.js")).parseGPX(xml),
      xml,
    );
    expect(parsed.tracks).toEqual(before.draft.map((e) => e.points));
  });
}
test("un trazado sin recorrido se bloquea antes de guardar o exportar; trabajo en curso recuperable", async ({
  page,
}) => {
  await openEditor(page);
  await state(page);
  await page.evaluate(async () => {
    const store = await import("/src/utils/localStore.js");
    const d = await store.loadWorkspace();
    d.draft = [
      {
        id: "coincidentes",
        name: "Sin recorrido",
        points: [
          { lat: 40, lon: -3, ele: 12 },
          { lat: 40, lon: -3, ele: 12 },
        ],
      },
    ];
    await store.saveWorkspace(d);
  });
  await page.reload();
  await page.getByRole("tab", { name: "Editar", exact: true }).click();
  const before = await state(page);
  const dialog = page.getByRole("dialog", {
    name: "Revisión GPX",
    exact: true,
  });
  for (const kind of ["ruta", "segmento"]) {
    await page
      .getByRole("button", { name: `Guardar ${kind}`, exact: true })
      .click();
    await expect(dialog).toContainText("no hay un recorrido utilizable");
    await expect(
      page.getByRole("dialog", { name: `Guardar ${kind}`, exact: true }),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("button", {
        name: `Guardar ${kind} revisad${kind === "ruta" ? "a" : "o"}`,
        exact: true,
      }),
    ).toBeDisabled();
    expect(await state(page)).toEqual(before);
    await dialog
      .getByRole("button", { name: "Cerrar revisión", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Exportar a GPX", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Descargar GPX", exact: true }),
  ).toBeDisabled();
  expect(await state(page)).toEqual(before);
});
