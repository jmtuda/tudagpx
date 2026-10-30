const origin = "https://tudagpx.vercel.app";
export function prepare(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET" && req.headers.origin !== origin) {
    res.status(403).json({ error: "Origen no permitido." });
    return false;
  }
  return true;
}
export async function authFetch(path, req, body) {
  return fetch(`${process.env.NEON_AUTH_BASE_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: req.headers.cookie || "",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
    redirect: "manual",
  });
}
export async function owner(req) {
  const response = await authFetch("/get-session", req);
  if (!response.ok) return null;
  const data = await response.json();
  const user = data?.user;
  return user?.emailVerified === true &&
    user.email.toLowerCase() === process.env.OWNER_EMAIL?.toLowerCase()
    ? user
    : null;
}
export function copyCookies(response, res) {
  const cookies = response.headers
    .getSetCookie()
    .map((value) =>
      value
        .replace(/;\s*Domain=[^;]+/gi, "")
        .replace(/;\s*Path=[^;]+/gi, "; Path=/"),
    );
  if (cookies.length) res.setHeader("Set-Cookie", cookies);
}
