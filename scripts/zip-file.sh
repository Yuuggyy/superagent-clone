#!/bin/bash
# DESC: Compresser un fichier en zip
# Usage: zip-file.sh <path-to-file> [output.zip]

if [ -z "$1" ]; then
  echo "Usage: zip-file.sh <path-to-file> [output.zip]"
  exit 1
fi

INPUT="$1"
OUTPUT="${2:-$(basename "$INPUT").zip}"

if [ ! -e "$INPUT" ]; then
  echo "Fichier/dossier non trouvé: $INPUT"
  exit 1
fi

zip -r "$OUTPUT" "$INPUT"
echo "Créé: $OUTPUT"
