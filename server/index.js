// index.js — Serveur Express principal
// API REST pour le chat + sert le frontend React

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSystemPrompt } from './systemPrompt.js';
import { loadMemory, addMemoryEntry, saveConversation, loadConversations, getMemoryContext } from './memory.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Servir le frontend build (production)
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Initialiser OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// === API ROUTES ===

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', model: MODEL });
});

// Chat principal
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message requis' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY non configurée. Crée un fichier .env avec ta clé.' });
    }

    // Construire le contexte
    const memoryContext = getMemoryContext();
    const conversationHistory = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    // Construire le system prompt avec mémoire
    const basePrompt = buildSystemPrompt(message, history);
    const fullSystemPrompt = `${basePrompt}\n\n# MÉMOIRE LONG-TERME\n${memoryContext}`;

    // Appeler OpenAI
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: fullSystemPrompt },
        ...conversationHistory
      ],
      max_tokens: 2000,
      temperature: 0.8,
    });

    const reply = completion.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu répondre.';

    // Sauvegarder la conversation
    const fullConversation = [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: reply }
    ];
    saveConversation(fullConversation);

    res.json({ reply, usage: completion.usage });
  } catch (error) {
    console.error('Erreur chat:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la communication avec l\'IA',
      details: error.message 
    });
  }
});

// Récupérer la mémoire
app.get('/api/memory', (req, res) => {
  const memory = loadMemory();
  res.json(memory);
});

// Ajouter un souvenir
app.post('/api/memory', (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'title et content requis' });
  }
  const entry = addMemoryEntry(title, content);
  res.json({ success: true, entry });
});

// Historique des conversations
app.get('/api/conversations', (req, res) => {
  const data = loadConversations();
  res.json(data);
});

// Génération d'images (optionnel, nécessite OpenAI)
app.post('/api/image', async (req, res) => {
  try {
    const { prompt, size = '1024x1024' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt requis' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY non configurée' });
    }

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
    });

    res.json({ url: response.data[0].url });
  } catch (error) {
    console.error('Erreur génération image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Catch-all : servir le frontend pour toute autre route (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Superagent Clone démarré sur http://localhost:${PORT}`);
  console.log(`📋 Model: ${MODEL}`);
  console.log(`💾 Memory: ${loadMemory().entries.length} entrées chargées`);
  console.log(`\nPour configurer: copie .env.example en .env et ajoute ta clé OpenAI\n`);
});
