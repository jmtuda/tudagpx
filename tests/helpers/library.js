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
