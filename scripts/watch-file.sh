#!/bin/bash
# DESC: Surveiller un fichier en temps réel (tail -f)
# Usage: watch-file.sh <path-to-file>

if [ -z "$1" ]; then
  echo "Usage: watch-file.sh <path-to-file>"
  exit 1
fi

if [ ! -f "$1" ]; then
  echo "Fichier non trouvé: $1"
  exit 1
fi

tail -f "$1"
