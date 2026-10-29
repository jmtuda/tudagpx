#!/bin/zsh
# Doble clic en Finder para abrir la versión local. No conecta servicios de producción.
set -e
cd -- "$(dirname -- "$0")"
URL='http://127.0.0.1:5173'
if curl --silent --fail --max-time 2 "$URL/src/LocalApp.jsx" > /dev/null 2>&1; then
  open "$URL"
  exit 0
fi
if ! command -v npm > /dev/null 2>&1; then
  printf '\nNo se encuentra Node.js. Pide ayuda para revisar la instalación local.\n'
  read '?Pulsa Intro para cerrar.'
  exit 1
fi
if [[ ! -d node_modules ]]; then
  npm ci
fi
printf '\nAbriendo TudaGPX. Mantén esta ventana abierta mientras uses la aplicación.\n'
npm start
