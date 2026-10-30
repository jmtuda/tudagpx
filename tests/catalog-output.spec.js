import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { validateChange } from "../server/workspaceTransport.js";
import { pinLibraries } from "./helpers/library";

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
    await page
      .getByRole("button", { name: "Editar copia", exact: true })
      .last()
      .click();
    const before = await state(page);
    const original = before.routes.at(-1);
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
    expect(deleted.routes.at(-1).deletedAt).toBeTruthy();
    expect(deleted.routes.at(-1).originalBase64).toBe(original.originalBase64);
    expect(deleted.routes.at(-1).tracks).toEqual(original.tracks);
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
    expect(() => validateChange(deleted, renamed)).not.toThrow();
    for (const mutate of [
      (d) => {
        d.routes.at(-1).tracks[0][0].lat += 0.01;
      },
      (d) => {
        d.routes.at(-1).originalBase64 = "YQ==";
      },
      (d) => {
        d.routes.pop();
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
    await page
      .getByRole("button", { name: "Abrir segmento", exact: true })
      .first()
      .click();
    const before = await state(page);
    const original = before.segments[0];
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
    expect(deleted.segments[0].points).toEqual(original.points);
    expect(deleted.segments[0].deletedAt).toBeTruthy();
    expect(deleted.draft).toEqual(before.draft);
    expect(() => validateChange(deleted, before)).not.toThrow();
    await expect(
      page.getByRole("heading", { name: "Segmento renombrado", exact: true }),
    ).toHaveCount(0);
    await page.reload();
    expect(await state(page)).toEqual(deleted);
  });
}
for (const kind of ["ruta", "segmento"]) {
  test(`guardar ${kind} valida GPX y exige aceptar avisos sin cambiar el original`, async ({
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
    await page
      .getByRole("button", { name: "Editar copia", exact: true })
      .last()
      .click();
    const before = await state(page);
    await page
      .getByRole("button", { name: `Guardar ${kind}`, exact: true })
      .click();
    if (kind === "segmento")
      await page
        .getByRole("dialog", { name: "Guardar segmento", exact: true })
        .getByRole("button", { name: "Guardar segmento", exact: true })
        .click();
    const dialog = page.getByRole("dialog", {
      name: "Revisión GPX",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("sin elevación");
    const save = dialog.getByRole("button", {
      name: `Guardar ${kind} revisad${kind === "ruta" ? "a" : "o"}`,
      exact: true,
    });
    await expect(save).toBeDisabled();
    expect(await state(page)).toEqual(before);
    await dialog.getByRole("checkbox").check();
    await save.click();
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
  const before = await state(page);
  await page.getByRole("button", { name: "Guardar ruta", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Revisión GPX",
    exact: true,
  });
  await expect(dialog).toContainText("no hay un recorrido utilizable");
  await expect(
    dialog.getByRole("button", { name: "Guardar ruta revisada", exact: true }),
  ).toBeDisabled();
  expect(await state(page)).toEqual(before);
  await dialog
    .getByRole("button", { name: "Cerrar revisión", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Exportar a GPX", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Descargar GPX", exact: true }),
  ).toBeDisabled();
  expect(await state(page)).toEqual(before);
});
