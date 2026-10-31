import { expect } from "@playwright/test";

// La validación precede al nombre; ningún guardado acepta errores ni abre revisión por avisos.
export async function confirmRouteSave(page) {
  const dialog = page.getByRole("dialog", {
    name: "Guardar ruta",
    exact: true,
  });
  await expect(
    dialog.getByLabel("Nombre de la ruta", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Guardar ruta", exact: true })
    .click();
  await expect(dialog).toBeHidden();
}

// Transferencia explícita desde el popup del mapa, nunca desde la ficha.
export async function sendViewerRoute(page, index = -1) {
  const selection = await page.locator('.viewer-route-card input[type="checkbox"]:checked').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
  const expectedName = selection.at(index).replace(/^Mostrar /, "");
  const paths = page.locator("path.viewer-route");
  const target = index < 0 ? paths.last() : paths.nth(index);
  await page
    .getByRole("button", { name: "Ocultar panel de rutas", exact: true })
    .click();
  await expect(page.locator("#library-panel")).toBeHidden();
  await expect
    .poll(async () =>
      target.evaluate((path) => {
        const length = path.getTotalLength();
        for (const ratio of [0.5, 0.35, 0.65, 0.2, 0.8]) {
          const p = path.getPointAtLength(length * ratio);
          const screen = new DOMPoint(p.x, p.y).matrixTransform(
            path.getScreenCTM(),
          );
          if (document.elementFromPoint(screen.x, screen.y) === path)
            return true;
        }
        return false;
      }),
    )
    .toBe(true);
  const position = await target.evaluate((path) => {
    for (const ratio of [0.5, 0.35, 0.65, 0.2, 0.8]) {
      const p = path.getPointAtLength(path.getTotalLength() * ratio);
      const screen = new DOMPoint(p.x, p.y).matrixTransform(
        path.getScreenCTM(),
      );
      if (document.elementFromPoint(screen.x, screen.y) === path)
        return { x: screen.x, y: screen.y };
    }
    throw new Error("La ruta no ofrece un punto de mapa accesible");
  });
  await page.mouse.click(position.x, position.y);
  await expect(page.locator(".leaflet-popup strong")).toHaveText(expectedName);
  await page
    .locator(".leaflet-popup")
    .getByRole("button", { name: "Enviar al editor", exact: true })
    .click();
  await pinLibraries(page);
  // El clic en mapa alterna selección. Recupera explícitamente las superposiciones del escenario.
  await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
  for (const name of selection) await page.getByRole("checkbox", { name, exact: true }).check();
  await page.getByRole("tab", { name: "Editar", exact: true }).click();
}

// Las pruebas funcionales fijan explícitamente las bibliotecas que utilizan.
// El comportamiento inicial oculto y la apertura por borde se prueban en sidebar.spec.js.
export async function pinLibraries(page) {
  const current = await page
    .getByRole("tab", { name: "Ver rutas", exact: true })
    .getAttribute("aria-selected");
  for (const name of ["Ver rutas", "Editar"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await page
      .getByRole("button", { name: "Mostrar panel de rutas", exact: true })
      .click();
    const pin = page.getByRole("button", {
      name: "Fijar panel de rutas",
      exact: true,
    });
    if (await pin.count()) await pin.click();
  }
  await page
    .getByRole("tab", {
      name: current === "true" ? "Ver rutas" : "Editar",
      exact: true,
    })
    .click();
}
