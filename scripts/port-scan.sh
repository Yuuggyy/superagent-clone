#!/bin/bash
# DESC: Scanner les ports ouverts d'une adresse IP
# Usage: port-scan.sh <ip> [start_port] [end_port]

if [ -z "$1" ]; then
  echo "Usage: port-scan.sh <ip> [start_port] [end_port]"
  echo "Example: port-scan.sh 192.168.1.1 1 1000"
  exit 1
fi

IP="$1"
START="${2:-1}"
END="${3:-1000}"

echo "Scan de $IP ports $START-$END..."
echo ""

for port in $(seq $START $END); do
  (echo >/dev/tcp/$IP/$port) 2>/dev/null && echo "Port $port: OUVERT" &
done

wait
echo ""
echo "Scan terminé."
