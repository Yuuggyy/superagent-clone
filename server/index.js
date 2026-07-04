// index.js — Serveur Express principal
// Multi-provider LLM + tools/scripts exécutables + commandes slash + mémoire

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSystemPrompt } from './systemPrompt.js';
import {
  loadMemory, addMemoryEntry, saveConversation, loadConversations, getMemoryContext,
  loadRules, addRule, deleteRule, clearRules, getRulesForPrompt, parseSlashCommand
} from './memory.js';
import { createLLMClient, getActiveProvider, listProviders } from './llm.js';
import { TOOLS, executeTool, listAvailableScripts } from './tools.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'dist')));

// === HEALTH ===

app.get('/api/health', (req, res) => {
  const provider = getActiveProvider();
  const rules = loadRules();
  const memory = loadMemory();
  const scripts = listAvailableScripts();
  res.json({
    status: 'ok',
    provider: provider ? { name: provider.name, model: process.env.OPENAI_MODEL || provider.defaultModel, free: provider.free } : null,
    rulesCount: rules.rules.length,
    memoryCount: memory.entries.length,
    scriptsCount: scripts.length,
    toolsCount: TOOLS.length
  });
});

// === PROVIDERS ===

app.get('/api/providers', (req, res) => {
  res.json({ providers: listProviders(), active: getActiveProvider()?.key || null });
});

// === CHAT (avec tools + multi-provider) ===

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) return res.status(400).json({ error: 'Message requis' });

    // 1. Vérifier si c'est une commande slash
    const command = parseSlashCommand(message);
    if (command) {
      const fullConversation = [
        ...history,
        { role: 'user', content: message },
        { role: 'assistant', content: command.response }
      ];
      saveConversation(fullConversation);
      return res.json({ reply: command.response, isCommand: true, commandType: command.type });
    }

    // 2. Message normal → envoyer au LLM
    const { client, provider, error: llmError } = createLLMClient();
    if (!client) {
      return res.status(500).json({ error: llmError || 'Aucun provider LLM configuré' });
    }

    const model = process.env.OPENAI_MODEL || provider.defaultModel;
    const memoryContext = getMemoryContext();
    const customRules = getRulesForPrompt();
    const conversationHistory = history.map(m => ({ role: m.role, content: m.content }));

    const basePrompt = buildSystemPrompt(message, history, customRules);
    const fullSystemPrompt = `${basePrompt}\n\n# MÉMOIRE LONG-TERME\n${memoryContext}\n\n# TOOLS DISPONIBLES\nTu peux exécuter des tools pour faire des actions réelles: run_bash, read_file, write_file, list_files, web_search, run_script, list_scripts, install_package. Utilise-les quand c'est pertinent.`;

    const messages = [
      { role: 'system', content: fullSystemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // Première appel — avec tools si le provider les supporte
    let completion;
    try {
      completion = await client.chat.completions.create({
        model,
        messages,
        max_tokens: 4000,
        temperature: 0.8,
        tools: provider.supportsTools ? TOOLS : undefined,
      });
    } catch (err) {
      // Retry sans tools si erreur
      completion = await client.chat.completions.create({
        model,
        messages,
        max_tokens: 4000,
        temperature: 0.8,
      });
    }

    let reply = completion.choices[0]?.message?.content || '';
    const toolCalls = completion.choices[0]?.message?.tool_calls;

    // 3. Si le LLM veut exécuter des tools
    if (toolCalls && toolCalls.length > 0) {
      // Ajouter la réponse de l'assistant avec les tool calls
      messages.push(completion.choices[0].message);

      const toolResults = [];
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        let toolArgs = {};
        try { toolArgs = JSON.parse(toolCall.function.arguments); } catch {}

        const result = await executeTool(toolName, toolArgs);
        toolResults.push({ name: toolName, result });

        // Ajouter le résultat au contexte
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      // Deuxième appel — avec les résultats des tools
      const secondCompletion = await client.chat.completions.create({
        model,
        messages,
        max_tokens: 4000,
        temperature: 0.8,
      });

      reply = secondCompletion.choices[0]?.message?.content || '';

      // Ajouter info sur les tools exécutés
      const toolSummary = toolResults.map(t => `🔧 ${t.name}: ${t.result.success ? '✅' : '❌'}`).join('\n');
      reply = `${reply}\n\n_${toolSummary}_`;
    }

    // Sauvegarder
    const fullConversation = [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: reply }
    ];
    saveConversation(fullConversation);

    res.json({ reply, provider: provider.key, model });
  } catch (error) {
    console.error('Erreur chat:', error);
    res.status(500).json({ error: 'Erreur LLM', details: error.message });
  }
});

// === RÈGLES ===

app.get('/api/rules', (req, res) => { res.json(loadRules()); });
app.post('/api/rules', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content requis' });
  res.json({ success: true, rule: addRule(content) });
});
app.delete('/api/rules/:id', (req, res) => {
  deleteRule(parseInt(req.params.id));
  res.json({ success: true });
});
app.delete('/api/rules', (req, res) => {
  clearRules();
  res.json({ success: true });
});

// === MÉMOIRE ===

app.get('/api/memory', (req, res) => { res.json(loadMemory()); });
app.post('/api/memory', (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title et content requis' });
  res.json({ success: true, entry: addMemoryEntry(title, content) });
});

// === SCRIPTS ===

app.get('/api/scripts', (req, res) => {
  res.json({ scripts: listAvailableScripts(), tools: TOOLS.map(t => t.function.name) });
});

app.post('/api/scripts/run', async (req, res) => {
  const { name, args } = req.body;
  const result = await executeTool('run_script', { name, args });
  res.json(result);
});

// Exécuter un tool directement
app.post('/api/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const args = req.body;
  const result = await executeTool(toolName, args);
  res.json(result);
});

// === CONVERSATIONS ===

app.get('/api/conversations', (req, res) => { res.json(loadConversations()); });

// === IMAGES ===

app.post('/api/image', async (req, res) => {
  try {
    const { prompt, size = '1024x1024' } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt requis' });

    const { client, provider } = createLLMClient();
    if (!client) return res.status(500).json({ error: 'Aucun provider configuré' });

    // DALL-E seulement avec OpenAI
    if (provider.key !== 'openai') {
      // Fallback: Pollinations.ai (gratuit, pas de clé)
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
      return res.json({ url: pollinationsUrl, provider: 'pollinations (free)' });
    }

    const response = await client.images.generate({ model: 'dall-e-3', prompt, n: 1, size });
    res.json({ url: response.data[0].url });
  } catch (error) {
    // Fallback Pollinations
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(req.body.prompt)}?width=1024&height=1024&nologo=true`;
    res.json({ url: pollinationsUrl, provider: 'pollinations (free fallback)' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  const provider = getActiveProvider();
  const rules = loadRules();
  const memory = loadMemory();
  const scripts = listAvailableScripts();
  console.log(`\n👻 Superagent Clone — http://localhost:${PORT}`);
  if (provider) {
    console.log(`🤖 Provider: ${provider.name} (${provider.free ? 'GRATUIT' : 'PAYANT'})`);
    console.log(`📋 Model: ${process.env.OPENAI_MODEL || provider.defaultModel}`);
  } else {
    console.log('⚠️  Aucun provider LLM configuré!');
    console.log('   Groq (gratuit): https://console.groq.com → crée une clé → mets GROQ_API_KEY dans .env');
  }
  console.log(`🧠 Memory: ${memory.entries.length} entrées`);
  console.log(`📏 Rules: ${rules.rules.length} (${rules.rules.length === 0 ? 'SANS LIMITES' : 'avec règles'})`);
  console.log(`🔧 Tools: ${TOOLS.length} | Scripts: ${scripts.length}`);
  console.log(`\nCommandes: /help\n`);
});
