// memory.js — Système de mémoire + règles dynamiques
// Stocke les souvenirs long-terme, les règles custom, et l'historique des conversations

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const MEMORY_FILE = path.join(DATA_DIR, 'memory.json');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');
const RULES_FILE = path.join(DATA_DIR, 'rules.json');

const DEFAULT_MEMORY = {
  entries: [
    { id: 1, title: "Projet menu_3d sur GitHub", content: "Le projet 'menu_3d' gère les commandes et appels de serveurs avec dashboard admin et reset quotidien.", date: "2026-06-26" },
    { id: 2, title: "Supabase project", content: "Le projet Supabase ID est 'uauiqbjuwmzqunlfierw'.", date: "2026-06-26" },
    { id: 6, title: "BISO PEUPLE", content: "Michael est actif dans le groupe politique 'BISO PEUPLE' (RDC) et crée de la documentation politique technique.", date: "2026-06-28" },
    { id: 22, title: "Photographie 416", content: "Le projet 416 nécessite de l'upscaling 10x régulier pour les photos promotionnelles d'artistes.", date: "2026-06-30" },
    { id: 23, title: "Sandrine Kaseka", content: "Sandrine Kaseka est la personnalité présente dans les posters du Jour de l'Indépendance.", date: "2026-06-30" },
    { id: 39, title: "RDC vs Rwanda CIJ", content: "La RDC a déposé une plainte contre le Rwanda à la CIJ pour génocide, torture et discrimination.", date: "2026-07-01" },
    { id: 49, title: "MyRawApp Architecture", content: "MyRawApp : 5 agents IA (Router, RSE, Compliance, Commercial, Accounting), KYC 3 niveaux, IllicoCash.", date: "2026-07-01" },
    { id: 50, title: "iPhone 14 boot loop", content: "iPhone 14 (d27ap) restauré par technicien mais redémarrages aléatoires. Probable Tristar/Hydra.", date: "2026-07-04" },
    { id: 65, title: "Superagent clone", content: "Michael a créé un clone autonome de Superagent (ce projet) sur son GitHub.", date: "2026-07-04" }
  ]
};

const DEFAULT_RULES = {
  rules: []
};

// === MÉMOIRE ===

export function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
    }
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(DEFAULT_MEMORY, null, 2));
    return DEFAULT_MEMORY;
  } catch (error) {
    console.error('Erreur chargement mémoire:', error);
    return DEFAULT_MEMORY;
  }
}

export function saveMemory(memory) {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
    return true;
  } catch (error) {
    console.error('Erreur sauvegarde mémoire:', error);
    return false;
  }
}

export function addMemoryEntry(title, content) {
  const memory = loadMemory();
  const maxId = Math.max(...memory.entries.map(e => e.id), 0);
  const newEntry = { id: maxId + 1, title, content, date: new Date().toISOString().split('T')[0] };
  memory.entries.push(newEntry);
  saveMemory(memory);
  return newEntry;
}

export function getMemoryContext() {
  const memory = loadMemory();
  return memory.entries.slice(-10).map(e => `[${e.date}] ${e.title}: ${e.content}`).join('\n');
}

// === RÈGLES DYNAMIQUES ===

export function loadRules() {
  try {
    if (fs.existsSync(RULES_FILE)) {
      return JSON.parse(fs.readFileSync(RULES_FILE, 'utf-8'));
    }
    fs.writeFileSync(RULES_FILE, JSON.stringify(DEFAULT_RULES, null, 2));
    return DEFAULT_RULES;
  } catch (error) {
    console.error('Erreur chargement règles:', error);
    return DEFAULT_RULES;
  }
}

export function saveRules(rules) {
  try {
    fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
    return true;
  } catch (error) {
    console.error('Erreur sauvegarde règles:', error);
    return false;
  }
}

export function addRule(content) {
  const rules = loadRules();
  const maxId = Math.max(...rules.rules.map(r => r.id), 0);
  const newRule = { id: maxId + 1, content, date: new Date().toISOString() };
  rules.rules.push(newRule);
  saveRules(rules);
  return newRule;
}

export function deleteRule(id) {
  const rules = loadRules();
  rules.rules = rules.rules.filter(r => r.id !== id);
  saveRules(rules);
  return rules;
}

export function clearRules() {
  const rules = { rules: [] };
  saveRules(rules);
  return rules;
}

export function getRulesForPrompt() {
  const rules = loadRules();
  return rules.rules;
}

// === CONVERSATIONS ===

export function loadConversations() {
  try {
    if (fs.existsSync(CONVERSATIONS_FILE)) {
      return JSON.parse(fs.readFileSync(CONVERSATIONS_FILE, 'utf-8'));
    }
    return { conversations: [] };
  } catch (error) {
    return { conversations: [] };
  }
}

export function saveConversation(messages) {
  const data = loadConversations();
  const conversation = { id: Date.now(), timestamp: new Date().toISOString(), messages };
  data.conversations.push(conversation);
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

// === PARSING DES COMMANDES SLASH ===

export function parseSlashCommand(message) {
  if (!message.startsWith('/')) return null;

  const trimmed = message.trim();

  // /rule: <texte> — ajouter une règle
  if (trimmed.match(/^\/rule:\s*(.+)/i)) {
    const content = trimmed.match(/^\/rule:\s*(.+)/i)[1].trim();
    if (content) {
      const rule = addRule(content);
      return { type: 'rule_added', rule, response: `✅ Règle ajoutée (#${rule.id}): "${content}"` };
    }
  }

  // /rules — lister les règles
  if (trimmed.match(/^\/rules$/i)) {
    const rules = loadRules();
    if (rules.rules.length === 0) {
      return { type: 'rules_list', response: '📋 Aucune règle définie. Tu es libre. Utilise /rule: <texte> pour en ajouter une.' };
    }
    const list = rules.rules.map(r => `${r.id}. ${r.content}`).join('\n');
    return { type: 'rules_list', response: `📋 Règles actuelles:\n${list}` };
  }

  // /delrule: <id> — supprimer une règle
  if (trimmed.match(/^\/delrule:\s*(\d+)/i)) {
    const id = parseInt(trimmed.match(/^\/delrule:\s*(\d+)/i)[1]);
    deleteRule(id);
    return { type: 'rule_deleted', response: `🗑️ Règle #${id} supprimée.` };
  }

  // /clearrules — supprimer toutes les règles
  if (trimmed.match(/^\/clearrules$/i)) {
    clearRules();
    return { type: 'rules_cleared', response: '🗑️ Toutes les règles ont été supprimées. Retour à la liberté totale.' };
  }

  // /memory — voir la mémoire
  if (trimmed.match(/^\/memory$/i)) {
    const memory = loadMemory();
    const list = memory.entries.map(e => `[${e.date}] ${e.title}: ${e.content}`).join('\n');
    return { type: 'memory_list', response: `🧠 Mémoire:\n${list}` };
  }

  // /remember: <texte> — ajouter un souvenir
  if (trimmed.match(/^\/remember:\s*(.+)/i)) {
    const content = trimmed.match(/^\/remember:\s*(.+)/i)[1].trim();
    if (content) {
      const entry = addMemoryEntry("Souvenir manuel", content);
      return { type: 'memory_added', response: `✅ Souvenir ajouté: "${content}"` };
    }
  }

  // /help — aide sur les commandes
  if (trimmed.match(/^\/help$/i)) {
    return {
      type: 'help',
      response: `🔧 Commandes disponibles:

/rule: <texte> — Ajouter une règle
/rules — Voir toutes les règles
/delrule: <id> — Supprimer une règle
/clearrules — Supprimer toutes les règles
/memory — Voir la mémoire
/remember: <texte> — Ajouter un souvenir
/help — Cette aide`
    };
  }

  return null;
}
