import { expect } from "@playwright/test";

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

export async function showLibrary(page, kind = "route") {
  await page.getByRole("tab", { name: "Ver rutas", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Biblioteca", exact: true })
    .getByRole("button", { name: kind === "segment" ? /^Segmentos/ : /^Rutas/ })
    .click();
}

export async function sendLibraryItem(page, kind = "segment", index = 0, name) {
  await showLibrary(page, kind);
  const cards = page.locator(`.viewer-route-card[data-kind="${kind}"]`);
  const card = name
    ? cards.filter({ has: page.getByRole("heading", { name, exact: true }) })
    : cards.nth(index);
  await card.getByRole("checkbox").check();
  await card
    .getByRole("button", { name: "Enviar al editor", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Editar", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
}

export async function sendViewerRoute(page, index = -1) {
  await sendLibraryItem(page, "route", index);
}

// Compatibilidad con flujos antiguos: no cambia de módulo ni necesita fijación.
export async function pinLibraries() {}
