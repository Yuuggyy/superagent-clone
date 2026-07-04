#!/bin/bash
# DESC: Afficher les informations système (CPU, RAM, disque, OS)
# Usage: system-info.sh

echo "=== SYSTEM INFO ==="
echo ""
echo "OS: $(uname -a)"
echo ""
echo "CPU: $(grep 'model name' /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2 || echo 'N/A')"
echo "CPU Cores: $(nproc 2>/dev/null || echo 'N/A')"
echo ""
echo "Memory:"
free -h 2>/dev/null || echo "N/A"
echo ""
echo "Disk:"
df -h / 2>/dev/null || echo "N/A"
echo ""
echo "Uptime:"
uptime 2>/dev/null || echo "N/A"
