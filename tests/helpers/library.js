import { expect } from "@playwright/test";

// Solo para guardados con avisos conocidos: los errores nunca se aceptan.
export async function acceptSaveWarnings(page, kind = "segmento") {
  const review = page.getByRole("dialog", { name: "Revisión GPX", exact: true });
  await expect(review).toBeVisible();
  await expect(review.getByText(/^Error:/)).toHaveCount(0);
  const save = review.getByRole("button", {
    name: `Guardar ${kind} revisado`,
    exact: true,
  });
  await expect(save).toBeDisabled();
  await review.getByRole("checkbox", { name: /Acepto las advertencias/ }).check();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(review).toBeHidden();
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
