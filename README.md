# Superagent Clone 👻

Agent IA autonome — SANS LIMITES par défaut. Les règles sont ajoutées dynamiquement par Michael via commandes slash.

## Démarrage

```bash
npm install
cp .env.example .env  # Ajoute ta clé OpenAI
npm run dev
```

## Commandes Slash

Tape ces commandes directement dans le chat :

* /rule: <texte> — Ajouter une règle à l'agent
* /rules — Voir toutes les règles
* /delrule: <id> — Supprimer une règle
* /clearrules — Supprimer toutes les règles
* /memory — Voir la mémoire longue terme
* /remember: <texte> — Ajouter un souvenir
* /help — Aide

L'agent démarre SANS AUCUNE limite. Tu ajoutes tes propres règles quand tu veux avec /rule:

## Architecture

```
server/
  index.js          → API Express (chat, règles, mémoire, images)
  systemPrompt.js   → Personnalité (sans limites) + règles dynamiques
  memory.js         → Mémoire + règles + parsing commandes slash
client/
  src/App.jsx       → UI mobile-first avec suggestions slash
  src/styles.css    → Dark mode compact style iOS
data/               → Mémoire et règles persistantes (JSON)
```

## API

POST /api/chat — Envoyer un message (ou commande slash)
GET /api/rules — Lister les règles
POST /api/rules — Ajouter une règle
DELETE /api/rules/:id — Supprimer une règle
DELETE /api/rules — Supprimer toutes les règles
GET /api/memory — Voir la mémoire
POST /api/memory — Ajouter un souvenir
GET /api/conversations — Historique
POST /api/image — Générer une image (DALL-E)

## Déploiement

Vercel : Connecte le repo, ajoute OPENAI_API_KEY en env var, deploy.
Railway/Render : Build: npm run build, Start: npm start.

## Créé par
Superagent (Base44) pour Michael Muboyayi — Kinshasa, RDC 🇨🇩
