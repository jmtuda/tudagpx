import { parseGPX } from "./workspace";

// El texto se usa para interpretar; el archivo descargable conserva TODOS los bytes,
// incluida su codificación original y BOM. Base64 también sobrevive a las copias JSON.
export async function readGPXFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let encoding = "utf-8";
  if (
    (bytes[0] === 0xff && bytes[1] === 0xfe) ||
    (bytes[0] === 0x3c && bytes[1] === 0)
  )
    encoding = "utf-16le";
  else if (
    (bytes[0] === 0xfe && bytes[1] === 0xff) ||
    (bytes[0] === 0 && bytes[1] === 0x3c)
  )
    encoding = "utf-16be";
  else {
    const header = new TextDecoder().decode(bytes.slice(0, 200));
    encoding =
      header.match(/<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/i)?.[1] ||
      encoding;
  }
  let text;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new Error(
      "No se puede leer la codificación de este GPX. No se ha alterado el archivo.",
    );
  }
  const route = parseGPX(text, file.name);
  const originalBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(reader.result.slice(reader.result.indexOf(",") + 1));
    reader.onerror = () =>
      reject(new Error("No se ha podido conservar el archivo original."));
    reader.readAsDataURL(file);
  });
  return { ...route, originalBase64 };
}
export function originalContent(route) {
  return route.originalBase64
    ? Uint8Array.from(atob(route.originalBase64), (c) => c.charCodeAt(0))
    : route.original;
}
