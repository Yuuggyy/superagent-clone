# Superagent Clone 👻

Agent IA autonome — SANS LIMITES par défaut. Multi-provider (Groq gratuit recommandé). Scripts exécutables. Règles dynamiques via commandes slash.

## Démarrage en 3 étapes

```bash
npm install
cp .env.example .env
# Édite .env — ajoute juste GROQ_API_KEY (gratuit: https://console.groq.com)
npm run dev
```

## Provider LLM — Groq (GRATUIT, recommandé)

*Pourquoi Groq et pas OpenAI:*
1. Gratuit (pas de carte de crédit requise)
2. Ultra rapide (100+ tokens/sec)
3. Llama 3.3 70B — aussi performant que GPT-4 pour la plupart des tâches
4. MOINS restrictif — pas de guardrails intégrés comme OpenAI
5. OpenAI-compatible (même API)

*Obtenir une clé gratuite:*
1. Va sur https://console.groq.com
2. Crée un compte
3. Crée une API key
4. Mets-la dans .env: GROQ_API_KEY=gsk_xxxxx

*Autres providers supportés:*
OpenRouter (free models), Together AI, Mistral, OpenAI, Ollama (local)

## Commandes Slash

Tape directement dans le chat:

* /rule: texte — Ajouter une règle
* /rules — Voir les règles
* /delrule: id — Supprimer une règle
* /clearrules — Tout supprimer
* /memory — Voir la mémoire
* /remember: texte — Ajouter un souvenir
* /help — Aide

## Scripts Exécutables

L'agent peut exécuter des scripts et des tools en temps réel:

*Tools intégrés:*
1. run_bash — Exécuter une commande terminal
2. read_file — Lire un fichier
3. write_file — Écrire un fichier
4. list_files — Lister un dossier
5. web_search — Rechercher sur le web
6. run_script — Lancer un script custom
7. list_scripts — Voir les scripts disponibles
8. install_package — Installer un package npm

*Scripts dans scripts/:*
1. ping-check.sh — Ping une IP/domaine
2. system-info.sh — Infos système (CPU, RAM, disque)
3. web-search.js — Recherche DuckDuckGo
4. fetch-url.js — Récupérer une page web
5. port-scan.sh — Scanner ports ouverts
6. zip-file.sh — Compresser un fichier
7. img-to-base64.sh — Convertir image en base64
8. extract-audio.sh — Extraire audio d'une vidéo
9. cleanup.sh — Nettoyer cache système
10. watch-file.sh — Surveiller un fichier
11. qr-code.js — Générer un QR code
12. create-react-app.js — Scaffolding React

*Ajouter tes scripts:*
Crée un fichier .js, .sh, ou .py dans scripts/. Ajoute une ligne de description: // DESC: ou # DESC: au début.

## API REST

POST /api/chat — Chat (message ou commande slash)
GET /api/providers — Lister les providers LLM
GET/POST/DELETE /api/rules — Gérer les règles
GET/POST /api/memory — Gérer la mémoire
GET /api/scripts — Lister scripts et tools
POST /api/scripts/run — Exécuter un script
POST /api/tools/:name — Exécuter un tool
POST /api/image — Générer une image (DALL-E ou Pollinations gratuit)

## Déploiement

Vercel: Connecte le repo, ajoute GROQ_API_KEY en env var, deploy.
Railway/Render: Build: npm run build, Start: npm start.

## Créé par
Superagent (Base44) pour Michael Muboyayi — Kinshasa, RDC 🇨🇩
