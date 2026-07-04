#!/bin/bash
# DESC: Extraire l'audio d'une vidéo avec ffmpeg
# Usage: extract-audio.sh <video.mp4> [output.mp3]

if [ -z "$1" ]; then
  echo "Usage: extract-audio.sh <video.mp4> [output.mp3]"
  exit 1
fi

INPUT="$1"
OUTPUT="${2:-${INPUT%.*}.mp3}"

if ! command -v ffmpeg &> /dev/null; then
  echo "ffmpeg non installé. Installe avec: sudo apt install ffmpeg"
  exit 1
fi

ffmpeg -i "$INPUT" -vn -acodec libmp3lame -q:a 2 "$OUTPUT"
echo "Audio extrait: $OUTPUT"
