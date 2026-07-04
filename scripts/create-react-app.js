// DESC: Créer un nouveau projet React + Vite mobile-first
// Usage: node create-react-app.js <project-name>

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const name = process.argv[2];

if (!name) {
  console.log('Usage: node create-react-app.js <project-name>');
  process.exit(1);
}

try {
  console.log(`Création du projet ${name}...`);
  execSync(`npx create-vite@latest ${name} --template react`, { stdio: 'inherit' });

  const pkgPath = path.join(name, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    pkg.scripts = pkg.scripts || {};
    pkg.scripts.dev = 'vite --host';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  }

  console.log(`\n✅ Projet ${name} créé!`);
  console.log(`cd ${name} && npm install && npm run dev`);
} catch (err) {
  console.error('Erreur:', err.message);
}
