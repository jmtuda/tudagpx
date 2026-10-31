import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const fixture = new URL("./fixtures/ruta.gpx", import.meta.url);
async function state(page) {
  await expect(page.locator(".local-status > span")).toHaveText(
    "Guardado en este navegador",
  );
  return page.evaluate(async () =>
    (await import("/src/utils/localStore.js")).loadWorkspace(),
  );
}
async function editor(page) {
  await page.getByRole("tab", { name: "Editar", exact: true }).click();
}
async function drop(page, entries) {
  const transfer = await page.evaluateHandle((entries) => {
    const transfer = new DataTransfer();
    for (const entry of entries)
      transfer.items.add(
        new File(
          [Uint8Array.from(atob(entry.base64), (char) => char.charCodeAt(0))],
          entry.name,
          { type: "application/gpx+xml" },
        ),
      );
    return transfer;
  }, entries);
  const map = page.locator(".workspace-map");
  await map.dispatchEvent("dragover", { dataTransfer: transfer });
  await expect(page.locator(".map-drop-hint")).toHaveText(
    "Suelta uno o varios archivos GPX para abrirlos solo en el editor",
  );
  await map.dispatchEvent("drop", { dataTransfer: transfer });
  await transfer.dispose();
}
for (const width of [1440, 390]) {
  test(`inicio siempre en visor y drop externo sin biblioteca, deshacer y recuperar ${width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 950 });
    await page.addInitScript(() =>
      localStorage.setItem("tudagpx-workspace", "edit"),
    );
    await page.goto("/");
    await expect(
      page.getByRole("tab", { name: "Ver rutas", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page
      .locator(".viewer-route-card")
      .first()
      .getByRole("button", { name: "Enviar al editor", exact: true })
      .click();
    const before = await state(page);
    expect(before.draft.length).toBeGreaterThan(0);
    const bytes = await readFile(fixture);
    let routingCalls = 0;
    page.on("request", (request) => {
      if (request.url().includes("brouter.de/brouter")) routingCalls++;
    });
    await editor(page);
    await drop(page, [
      { name: "primero.gpx", base64: bytes.toString("base64") },
      { name: "segundo.gpx", base64: bytes.toString("base64") },
    ]);
    const opened = await state(page);
    const parsed = await page.evaluate(
      async (xml) => (await import("/src/utils/workspace.js")).parseGPX(xml),
      bytes.toString("utf8"),
    );
    expect(opened.routes).toEqual(before.routes);
    expect(opened.segments).toEqual(before.segments);
    expect(opened.projects).toEqual(before.projects);
    expect(opened.draft.slice(0, before.draft.length)).toEqual(before.draft);
    const copies = opened.draft.slice(before.draft.length);
    expect(copies.map((copy) => copy.points)).toEqual([
      ...parsed.tracks,
      ...parsed.tracks,
    ]);
    expect(new Set(copies.map((copy) => copy.editorRouteId)).size).toBe(2);
    expect(new Set(copies.map((copy) => copy.id)).size).toBe(4);
    expect(copies.every((copy) => !copy.sourceId && !copy.sourceRouteId)).toBe(
      true,
    );
    expect(routingCalls).toBe(0);
    await expect(
      page.getByRole("tab", { name: "Editar", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    const files = page.getByRole("tablist", {
      name: "Rutas cargadas en el editor",
    });
    await expect(files.getByRole("tab")).toHaveCount(3);
    await page.getByRole("button", { name: "↶ Deshacer", exact: true }).click();
    expect((await state(page)).draft).toEqual(before.draft);
    await page.getByRole("button", { name: "↷ Rehacer", exact: true }).click();
    expect((await state(page)).draft).toEqual(opened.draft);
    await page.screenshot({ path: info.outputPath("external-gpx-editor.png") });
    await page.reload();
    await expect(
      page.getByRole("tab", { name: "Ver rutas", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".draft-line, .anchor-handle")).toHaveCount(0);
    expect(await state(page)).toEqual(opened);
    await editor(page);
    await expect(files.getByRole("tab")).toHaveCount(3);
    expect(await readFile(fixture)).toEqual(bytes);
  });
}
for (const kind of ["ruta", "segmento"]) {
  test(`GPX externo entra en biblioteca solo al guardar ${kind} expresamente`, async ({
    page,
  }) => {
    await page.goto("/");
    const before = await state(page);
    await editor(page);
    await drop(page, [
      {
        name: "externa.gpx",
        base64: (await readFile(fixture)).toString("base64"),
      },
    ]);
    const opened = await state(page);
    expect(opened.routes).toEqual(before.routes);
    expect(opened.segments).toEqual(before.segments);
    await page
      .getByRole("button", { name: `Guardar ${kind}`, exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: `Guardar ${kind}`,
      exact: true,
    });
    const name = `Externa guardada como ${kind}`;
    await dialog.getByRole("textbox").fill(name);
    await dialog
      .getByRole("button", { name: `Guardar ${kind}`, exact: true })
      .click();
    await expect(dialog).toBeHidden();
    const saved = await state(page);
    expect(saved.draft).toEqual(opened.draft);
    if (kind === "ruta") {
      expect(saved.routes).toHaveLength(before.routes.length + 1);
      expect(saved.routes.at(-1).name).toBe(name);
      expect(saved.routes.at(-1).tracks).toEqual(
        opened.draft.map((element) => element.points),
      );
      expect(saved.segments).toEqual(before.segments);
    } else {
      expect(saved.segments).toHaveLength(before.segments.length + 1);
      expect(saved.segments.at(-1).name).toBe(name);
      expect(saved.segments.at(-1).points).toEqual(opened.draft[0].points);
      expect(saved.routes).toEqual(before.routes);
    }
  });
}
test("drop inválido en editor conserva biblioteca y trabajo; lote mixto abre solo GPX válidos", async ({
  page,
}) => {
  await page.goto("/");
  const before = await state(page);
  await editor(page);
  const invalid = {
    name: "invalido.gpx",
    base64: Buffer.from("Esto no es un GPX").toString("base64"),
  };
  await drop(page, [invalid]);
  await expect(
    page.getByRole("status").filter({ hasText: "invalido.gpx" }),
  ).toBeVisible();
  expect(await state(page)).toEqual(before);
  await expect(
    page.getByRole("tab", { name: "Editar", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await drop(page, [
    invalid,
    {
      name: "valido.gpx",
      base64: (await readFile(fixture)).toString("base64"),
    },
  ]);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "1 GPX abiertos solo en el editor" }),
  ).toBeVisible();
  const after = await state(page);
  expect(after.routes).toEqual(before.routes);
  expect(after.segments).toEqual(before.segments);
  expect(after.draft).toHaveLength(before.draft.length + 2);
});
