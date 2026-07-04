// DESC: Générer un QR code pour un texte ou URL
// Usage: node qr-code.js "texte ou URL" [output.png]

const query = process.argv.slice(2).join(' ');

if (!query) {
  console.log('Usage: node qr-code.js "texte ou URL" [output.png]');
  process.exit(1);
}

// Utilise l'API gratuite QR Server
const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(query)}`;
console.log(`QR Code généré pour: "${query}"`);
console.log(`URL: ${url}`);
console.log(`\nTélécharge: ${url}`);
