# Superagent Clone 👻

Agent IA autonome — clone de Superagent (Base44), hébergé sur ton infrastructure.

## Démarrage rapide

1. Clone ce repo
2. `npm install`
3. Copie `.env.example` en `.env` et ajoute ta clé OpenAI
4. `npm run dev` (développement) ou `npm run build:start` (production)

## Architecture

```
superagent-clone/
├── server/
│   ├── index.js          → API Express (chat, mémoire, images)
│   ├── systemPrompt.js   → Personnalité + règles + contexte
│   └── memory.js         → Mémoire persistante (JSON)
├── client/
│   ├── src/
│   │   ├── App.jsx       → UI mobile-first (React)
│   │   ├── styles.css    → Design dark mode compact
│   │   └── main.jsx      → Entry point
│   ├── index.html
│   └── public/
├── data/                 → Mémoire et conversations (auto-créé)
├── .env.example
├── vite.config.js
└── package.json
```

## Fonctionnalités

*Chat IA* : Conversation naturelle avec personnalité de Superagent (chaleureux, direct, technique, drôle)

*Mémoire longue terme* : 15 souvenirs préchargés sur Michael, ses projets (416, MyRawApp, menu_3d, BISO PEUPLE), son équipement, et ses préférences

*Génération d'images* : Intégration DALL-E 3 (POST /api/image)

*Historique* : Sauvegarde des conversations dans data/conversations.json

*Mobile-first* : UI type iOS, dark mode, bottom bar, responsive

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/chat | POST | Envoyer un message |
| /api/memory | GET | Récupérer la mémoire |
| /api/memory | POST | Ajouter un souvenir |
| /api/conversations | GET | Historique des conversations |
| /api/image | POST | Générer une image (DALL-E) |
| /api/health | GET | Health check |

## Configuration .env

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
PORT=3000
```

## Déploiement

### Vercel (recommandé)
1. Connecte ce repo à Vercel
2. Ajoute OPENAI_API_KEY dans les env vars
3. Deploy

### Railway / Render
1. Connecte ce repo
2. Add env var: OPENAI_API_KEY
3. Build command: npm run build
4. Start command: npm start

### Local
```bash
npm install
cp .env.example .env
# Édite .env avec ta clé OpenAI
npm run dev
```

## Personnalisation

*Personnalité* : Édite `server/systemPrompt.js`
*Mémoire* : Édite `data/memory.json` ou via l'API
*UI* : Édite `client/src/App.jsx` et `client/src/styles.css`

## Créé par
Superagent (Base44) pour Michael Muboyayi Visiosphere — Kinshasa, RDC 🇨🇩
