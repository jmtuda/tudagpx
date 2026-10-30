import { useEffect, useState } from "react";
import LocalApp from "../LocalApp.jsx";
import { cloudEnabled } from "../utils/cloudStore.js";
import "./PrivateApp.css";

const buttons = {
  login: "Entrar",
  register: "Crear cuenta",
  verify: "Confirmar correo",
  send: "Enviar confirmación",
  "reset-send": "Enviar código de recuperación",
  reset: "Guardar contraseña",
};
export default function PrivateApp() {
  const [ready, setReady] = useState(!cloudEnabled);
  const [checking, setChecking] = useState(cloudEnabled);
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!cloudEnabled) return;
    fetch("/api/session", { cache: "no-store" })
      .then((response) => setReady(response.ok))
      .catch(() =>
        setMessage(
          "No se ha podido comprobar la sesión. Recarga para reintentar.",
        ),
      )
      .finally(() => setChecking(false));
  }, []);
  function changeMode(next, text = "") {
    setMode(next);
    setMessage(text);
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          email,
          code: form.get("code"),
          password: form.get("password"),
        }),
      });
      const result = await response.json();
      if (result.needsVerification) {
        changeMode("send", result.error);
        return;
      }
      if (!response.ok) throw new Error(result.error);
      if (mode === "login") {
        const session = await fetch("/api/session", { cache: "no-store" });
        if (!session.ok)
          throw new Error("No se ha podido verificar la cuenta autorizada.");
        setReady(true);
      } else if (mode === "register") {
        changeMode(
          "verify",
          "Cuenta creada. Confirma el correo con el código enviado por Neon. Solo se pide al crear la cuenta.",
        );
      } else if (mode === "verify" || mode === "reset") {
        changeMode(
          "login",
          mode === "reset"
            ? "Contraseña guardada. Ya puedes entrar con correo y contraseña."
            : "Correo confirmado. Ya puedes entrar con tu contraseña.",
        );
      } else if (mode === "send") {
        changeMode("verify", "Código de confirmación enviado por correo.");
      } else if (mode === "reset-send") {
        changeMode(
          "reset",
          "Si la cuenta existe, recibirás un código para crear o recuperar tu contraseña.",
        );
      }
    } catch (error) {
      setMessage(error.message || "Error de conexión. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (
      !window.confirm(
        "¿Cerrar sesión? Espera a que aparezca «Guardado en Neon» o descarga una copia antes de salir.",
      )
    )
      return;
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!response.ok) throw new Error();
      window.location.reload();
    } catch {
      window.alert("No se ha podido cerrar la sesión. Inténtalo de nuevo.");
    }
  }
  if (ready) return <LocalApp onLogout={cloudEnabled ? logout : undefined} />;
  return (
    <main className="private-login">
      <form onSubmit={submit}>
        <h1>TudaGPX</h1>
        <p>Biblioteca privada. Entra con tu correo y contraseña.</p>
        {checking ? (
          <p>Comprobando sesión…</p>
        ) : (
          <>
            <label>
              Correo electrónico
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                readOnly={mode === "verify" || mode === "reset"}
              />
            </label>
            {["login", "register", "reset"].includes(mode) && (
              <label>
                {mode === "login" ? "Contraseña" : "Nueva contraseña"}
                <input
                  key={mode}
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={8}
                  maxLength={128}
                  required
                />
              </label>
            )}
            {(mode === "verify" || mode === "reset") && (
              <label>
                Código de confirmación (solo creación o recuperación)
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                  aria-label="Código de confirmación"
                />
              </label>
            )}
            <button disabled={busy}>{busy ? "Espera…" : buttons[mode]}</button>
            {mode === "login" && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    changeMode(
                      "register",
                      "Primera vez: crea tu contraseña y confirma el correo una sola vez.",
                    )
                  }
                >
                  Crear cuenta (primera vez)
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    changeMode(
                      "reset-send",
                      "Recupera la contraseña o crea una si antes entrabas con códigos.",
                    )
                  }
                >
                  Crear o recuperar contraseña
                </button>
              </>
            )}
            {mode !== "login" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => changeMode("login")}
              >
                Volver a iniciar sesión
              </button>
            )}
            {mode === "verify" && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  changeMode(
                    "send",
                    "Solicita otra confirmación si no recibiste el correo.",
                  )
                }
              >
                Solicitar otro código de confirmación
              </button>
            )}
          </>
        )}
        <p role="status">{message}</p>
      </form>
    </main>
  );
}
