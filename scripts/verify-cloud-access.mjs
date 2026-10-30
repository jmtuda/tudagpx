import assert from "node:assert/strict";
const origin = "https://tudagpx.vercel.app";
for (const endpoint of [
  "/api/session",
  "/api/workspace",
  "/api/workspace?metadata=1",
  "/api/workspace?version=1&part=0",
]) {
  const response = await fetch(origin + endpoint);
  assert.equal(response.status, 401, endpoint);
  const body = await response.json();
  assert.equal(body.data, undefined);
  assert.equal(body.token, undefined);
  assert.match(response.headers.get("cache-control"), /no-store/);
  console.log("PASS unauthenticated access blocked:", endpoint);
}
const checks = [
  {
    method: "POST",
    path: "/api/session",
    headers: { Origin: "https://other.example" },
    body: { action: "send", email: "jmtuda@gmail.com" },
    status: 403,
  },
  {
    method: "POST",
    path: "/api/session",
    headers: { Origin: origin },
    body: { action: "send", email: "not-owner@example.com" },
    status: 403,
  },
  {
    method: "POST",
    path: "/api/session",
    headers: { Origin: origin },
    body: { action: "verify", email: "jmtuda@gmail.com", code: "" },
    status: 400,
  },
  {
    method: "PUT",
    path: "/api/workspace",
    headers: { Origin: origin },
    body: { version: 0, data: {} },
    status: 401,
  },
];
for (const check of checks) {
  const response = await fetch(origin + check.path, {
    method: check.method,
    headers: { "Content-Type": "application/json", ...check.headers },
    body: JSON.stringify(check.body),
  });
  assert.equal(response.status, check.status, `${check.method} ${check.path}`);
  console.log(
    "PASS live access restriction:",
    check.method,
    check.path,
    check.status,
  );
}
const page = await fetch(origin);
assert.equal(page.status, 200);
assert.match(await page.text(), /TudaGPX/);
console.log("PASS production HTML available");
