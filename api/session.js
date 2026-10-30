import { prepare, owner, authFetch, copyCookies } from "../server/private.js";

export default async function handler(req, res) {
  if (!prepare(req, res)) return;
  try {
    if (req.method === "GET") {
      const user = await owner(req);
      return res
        .status(user ? 200 : 401)
        .json(user ? { email: user.email } : { error: "Inicia sesión." });
    }
    if (req.method !== "POST") return res.status(405).end();
    const { action, email, code, password } = req.body || {};
    if (action === "logout") {
      const response = await authFetch("/sign-out", req, {});
      copyCookies(response, res);
      return res.status(response.status).json({ ok: response.ok });
    }
    if (
      typeof email !== "string" ||
      email.toLowerCase() !== process.env.OWNER_EMAIL?.toLowerCase()
    )
      return res.status(403).json({ error: "Esta biblioteca es privada." });
    let response;
    if (action === "login" || action === "register") {
      if (
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 128
      )
        return res
          .status(400)
          .json({
            error: "La contraseña debe tener entre 8 y 128 caracteres.",
          });
      response = await authFetch(
        action === "login" ? "/sign-in/email" : "/sign-up/email",
        req,
        {
          email,
          password,
          ...(action === "register"
            ? { name: "Propietario de TudaGPX" }
            : { rememberMe: true }),
        },
      );
    } else if (action === "reset-send") {
      response = await authFetch("/email-otp/request-password-reset", req, {
        email,
      });
    } else if (
      action === "reset" &&
      typeof code === "string" &&
      /^\d{6}$/.test(code)
    ) {
      if (
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 128
      )
        return res
          .status(400)
          .json({
            error: "La contraseña debe tener entre 8 y 128 caracteres.",
          });
      response = await authFetch("/email-otp/reset-password", req, {
        email,
        otp: code,
        password,
      });
    } else if (action === "send") {
      response = await authFetch("/email-otp/send-verification-otp", req, {
        email,
        type: "email-verification",
      });
    } else if (
      action === "verify" &&
      typeof code === "string" &&
      /^\d{6}$/.test(code)
    ) {
      response = await authFetch("/email-otp/verify-email", req, {
        email,
        otp: code,
      });
    } else return res.status(400).json({ error: "Solicitud no válida." });
    copyCookies(response, res);
    // Never return tokens, codes, or provider internals to the browser.
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      console.warn(
        "Neon authentication rejected request",
        response.status,
        typeof failure.code === "string" ? failure.code : "UNKNOWN",
      );
      if (failure.code === "EMAIL_NOT_VERIFIED")
        return res
          .status(403)
          .json({
            error: "Confirma tu correo una vez antes de entrar.",
            needsVerification: true,
          });
    }
    return res.status(response.ok ? 200 : response.status).json(
      response.ok
        ? { ok: true }
        : {
            error:
              action === "login"
                ? "No se ha podido entrar. Comprueba el correo y la contraseña."
                : action === "register"
                  ? "No se ha podido crear la cuenta. Si ya existe, utiliza «Crear o recuperar contraseña»."
                  : "No se ha podido completar la operación. Comprueba los datos o solicita un código nuevo.",
          },
    );
  } catch {
    return res.status(503).json({
      error: "El servicio de acceso no está disponible. Inténtalo de nuevo.",
    });
  }
}
