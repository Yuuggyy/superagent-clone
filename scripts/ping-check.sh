#!/bin/bash
# DESC: Ping une adresse IP ou un domaine pour vérifier la connectivité
# Usage: ping-check.sh <host>

if [ -z "$1" ]; then
  echo "Usage: ping-check.sh <host>"
  echo "Example: ping-check.sh 8.8.8.8"
  exit 1
fi

ping -c 4 "$1" 2>&1
