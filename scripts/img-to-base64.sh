#!/bin/bash
# DESC: Convertir un fichier image en base64 (pour traitement ou upload)
# Usage: img-to-base64.sh <path-to-image>

if [ -z "$1" ]; then
  echo "Usage: img-to-base64.sh <path-to-image>"
  exit 1
fi

if [ ! -f "$1" ]; then
  echo "Fichier non trouvé: $1"
  exit 1
fi

base64 "$1" | tr -d '\n'
echo ""
