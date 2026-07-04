// memory.js — Système de mémoire persistante
// Stocke les souvenirs long-terme et l'historique des conversations

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

// S'assurer que le dossier data existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const MEMORY_FILE = path.join(DATA_DIR, 'memory.json');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');

// Mémoire par défaut — les souvenirs importants de Michael
const DEFAULT_MEMORY = {
  entries: [
    {
      id: 1,
      title: "Projet menu_3d sur GitHub",
      content: "Le projet 'menu_3d' de Michael gère les commandes et appels de serveurs avec dashboard admin et reset quotidien. Hébergé sur GitHub.",
      date: "2026-06-26"
    },
    {
      id: 2,
      title: "Supabase project",
      content: "Le projet Supabase ID est 'uauiqbjuwmzqunlfierw'.",
      date: "2026-06-26"
    },
    {
      id: 6,
      title: "menu_3d fonctionnalités",
      content: "Le dashboard de menu_3d inclut des fonctions 'Delete All' pour la gestion quotidienne des commandes et appels de serveurs.",
      date: "2026-06-27"
    },
    {
      id: 13,
      title: "BISO PEUPLE",
      content: "Michael est actif dans le groupe politique 'BISO PEUPLE' (RDC) et crée de la documentation politique technique.",
      date: "2026-06-28"
    },
    {
      id: 22,
      title: "Photographie 416",
      content: "Le projet 416 nécessite de l'upscaling 10x régulier pour les photos promotionnelles d'artistes du label.",
      date: "2026-06-30"
    },
    {
      id: 23,
      title: "Sandrine Kaseka",
      content: "Sandrine Kaseka est la personnalité présente dans les posters du Jour de l'Indépendance de Michael.",
      date: "2026-06-30"
    },
    {
      id: 39,
      title: "RDC vs Rwanda CIJ",
      content: "La RDC a déposé une plainte contre le Rwanda à la CIJ pour génocide, torture et discrimination.",
      date: "2026-07-01"
    },
    {
      id: 49,
      title: "MyRawApp Architecture",
      content: "MyRawApp inclut 5 agents IA (Router, RSE, Compliance, Commercial, Accounting), un process KYC 3 niveaux, et l'intégration IllicoCash.",
      date: "2026-07-01"
    },
    {
      id: 50,
      title: "iPhone 14 boot loop",
      content: "L'iPhone 14 de Michael (d27ap) a eu un boot loop. La restauration échouait sur Windows à cause des drivers USB. Solution : Ubuntu Live USB.",
      date: "2026-07-01"
    },
    {
      id: 55,
      title: "iPhone 14 specs",
      content: "iPhone 14 modèle d27ap, SN: X062JN3FNJ, PRODUCT: iPhone14,7. Firmware cible: 23F84.",
      date: "2026-07-01"
    },
    {
      id: 61,
      title: "Ubuntu Live environment",
      content: "Michael a migré vers un environnement Ubuntu Live sur Dell XPS pour résoudre les conflits USB pendant la restauration iPhone.",
      date: "2026-07-01"
    },
    {
      id: 62,
      title: "iPhone 14 redémarrages aléatoires",
      content: "L'iPhone 14 a été restauré par un technicien mais souffre de redémarrages aléatoires (30 sec à 10 min). Batterie déjà remplacée. Crashes plus fréquents sous utilisation active → probablement puce Tristar/Hydra ou nappe earpiece flex. Verrouillage d'activation (compte tiers) — mot de passe connu.",
      date: "2026-07-04"
    },
    {
      id: 63,
      title: "OS Portable",
      content: "Michael découvre le concept d'OS portable (système d'exploitation sur clé USB/disque externe). Intéressé par les possibilités de diagnostic et récupération.",
      date: "2026-07-01"
    },
    {
      id: 64,
      title: "Grippe juillet 2026",
      content: "Michael a eu la grippe le 4 juillet 2026. Traitement au paracétamol.",
      date: "2026-07-04"
    },
    {
      id: 65,
      title: "Superagent clone",
      content: "Michael a créé un clone autonome de Superagent (ce projet) pour avoir un agent IA hébergé sur son infrastructure GitHub, indépendant de Base44.",
      date: "2026-07-04"
    }
  ]
};

// Charger la mémoire
export function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = fs.readFileSync(MEMORY_FILE, 'utf-8');
      return JSON.parse(data);
    }
    // Première fois : écrire la mémoire par défaut
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(DEFAULT_MEMORY, null, 2));
    return DEFAULT_MEMORY;
  } catch (error) {
    console.error('Erreur chargement mémoire:', error);
    return DEFAULT_MEMORY;
  }
}

// Sauvegarder la mémoire
export function saveMemory(memory) {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
    return true;
  } catch (error) {
    console.error('Erreur sauvegarde mémoire:', error);
    return false;
  }
}

// Ajouter un souvenir
export function addMemoryEntry(title, content) {
  const memory = loadMemory();
  const maxId = Math.max(...memory.entries.map(e => e.id), 0);
  const newEntry = {
    id: maxId + 1,
    title,
    content,
    date: new Date().toISOString().split('T')[0]
  };
  memory.entries.push(newEntry);
  saveMemory(memory);
  return newEntry;
}

// Charger les conversations
export function loadConversations() {
  try {
    if (fs.existsSync(CONVERSATIONS_FILE)) {
      const data = fs.readFileSync(CONVERSATIONS_FILE, 'utf-8');
      return JSON.parse(data);
    }
    return { conversations: [] };
  } catch (error) {
    console.error('Erreur chargement conversations:', error);
    return { conversations: [] };
  }
}

// Sauvegarder une conversation
export function saveConversation(messages) {
  const data = loadConversations();
  const conversation = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    messages
  };
  data.conversations.push(conversation);
  // Garder seulement les 100 dernières conversations
  if (data.conversations.length > 100) {
    data.conversations = data.conversations.slice(-100);
  }
  try {
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Erreur sauvegarde conversation:', error);
  }
  return conversation;
}

// Récupérer le contexte de mémoire pour l'inclure dans le prompt
export function getMemoryContext() {
  const memory = loadMemory();
  const recentEntries = memory.entries.slice(-10); // 10 derniers souvenirs
  return recentEntries.map(e => `[${e.date}] ${e.title}: ${e.content}`).join('\n');
}
