// index.js — Serveur Express principal
// API REST pour le chat + gestion des règles dynamiques + sert le frontend

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSystemPrompt } from './systemPrompt.js';
import {
  loadMemory, addMemoryEntry, saveConversation, loadConversations, getMemoryContext,
  loadRules, addRule, deleteRule, clearRules, getRulesForPrompt, parseSlashCommand
} from './memory.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'dist')));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// === API ===

app.get('/api/health', (req, res) => {
  const rules = loadRules();
  const memory = loadMemory();
  res.json({
    status: 'ok',
    model: MODEL,
    rulesCount: rules.rules.length,
    memoryCount: memory.entries.length
  });
});

// Chat principal — avec support des commandes slash
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message requis' });
    }

    // 1. Vérifier si c'est une commande slash
    const command = parseSlashCommand(message);
    if (command) {
      // C'est une commande — on ne l'envoie pas à l'IA, on retourne direct
      const fullConversation = [
        ...history,
        { role: 'user', content: message },
        { role: 'assistant', content: command.response }
      ];
      saveConversation(fullConversation);
      return res.json({ reply: command.response, isCommand: true, commandType: command.type });
    }

    // 2. Message normal → envoyer à l'IA
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY non configurée. Crée un fichier .env avec ta clé.' });
    }

    const memoryContext = getMemoryContext();
    const customRules = getRulesForPrompt();
    const conversationHistory = history.map(m => ({ role: m.role, content: m.content }));

    const basePrompt = buildSystemPrompt(message, history, customRules);
    const fullSystemPrompt = `${basePrompt}\n\n# MÉMOIRE LONG-TERME\n${memoryContext}`;

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: fullSystemPrompt },
        ...conversationHistory,
        { role: 'user', content: message }
      ],
      max_tokens: 2000,
      temperature: 0.8,
    });

    const reply = completion.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu répondre.';

    const fullConversation = [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: reply }
    ];
    saveConversation(fullConversation);

    res.json({ reply, usage: completion.usage });
  } catch (error) {
    console.error('Erreur chat:', error);
    res.status(500).json({ error: 'Erreur IA', details: error.message });
  }
});

// === RÈGLES ===

app.get('/api/rules', (req, res) => {
  res.json(loadRules());
});

app.post('/api/rules', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content requis' });
  const rule = addRule(content);
  res.json({ success: true, rule });
});

app.delete('/api/rules/:id', (req, res) => {
  const id = parseInt(req.params.id);
  deleteRule(id);
  res.json({ success: true });
});

app.delete('/api/rules', (req, res) => {
  clearRules();
  res.json({ success: true });
});

// === MÉMOIRE ===

app.get('/api/memory', (req, res) => {
  res.json(loadMemory());
});

app.post('/api/memory', (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title et content requis' });
  const entry = addMemoryEntry(title, content);
  res.json({ success: true, entry });
});

// === CONVERSATIONS ===

app.get('/api/conversations', (req, res) => {
  res.json(loadConversations());
});

// === IMAGES ===

app.post('/api/image', async (req, res) => {
  try {
    const { prompt, size = '1024x1024' } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt requis' });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY non configurée' });

    const response = await openai.images.generate({ model: 'dall-e-3', prompt, n: 1, size });
    res.json({ url: response.data[0].url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  const rules = loadRules();
  const memory = loadMemory();
  console.log(`\n👻 Superagent Clone — http://localhost:${PORT}`);
  console.log(`📋 Model: ${MODEL}`);
  console.log(`🧠 Memory: ${memory.entries.length} entrées`);
  console.log(`📏 Rules: ${rules.rules.length} règle(s) — agent ${rules.rules.length === 0 ? 'SANS LIMITES' : 'avec règles'}`);
  console.log(`\nCommandes: /help pour la liste\n`);
});
