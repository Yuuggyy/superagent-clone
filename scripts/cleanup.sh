#!/bin/bash
# DESC: Nettoyer le cache et les fichiers temporaires du système
# Usage: cleanup.sh

echo "=== Nettoyage ==="
echo ""

# Cache npm
echo "Cache npm..."
npm cache clean --force 2>/dev/null
echo "Done"

# Fichiers temporaires
echo "Fichiers temporaires..."
rm -rf /tmp/* 2>/dev/null || echo "/tmp inaccessible"

# Logs anciens
echo "Logs anciens..."
find /var/log -name "*.gz" -delete 2>/dev/null || echo "Logs inaccessibles"

# Cache apt
echo "Cache apt..."
sudo apt-get clean 2>/dev/null
sudo apt-get autoremove -y 2>/dev/null

echo ""
echo "Espace libéré:"
df -h / 2>/dev/null
echo ""
echo "✅ Nettoyage terminé"
