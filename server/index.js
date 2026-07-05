// index.js — Serveur Express principal
// Multi-provider LLM + tools/scripts + commandes slash + mémoire

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

// === HEALTH (avec diagnostic) ===

app.get('/api/health', (req, res) => {
  const provider = getActiveProvider();
  const rules = loadRules();
  const memory = loadMemory();
  const scripts = listAvailableScripts();
  res.json({
    status: provider?.error ? 'error' : 'ok',
    provider: provider ? {
      key: provider.key,
      name: provider.name,
      model: process.env.OPENAI_MODEL || provider.defaultModel,
      free: provider.free,
      hasKey: !!provider.apiKey,
      error: provider.error || null
    } : { error: 'Aucun provider' },
    rulesCount: rules.rules.length,
    memoryCount: memory.entries.length,
    scriptsCount: scripts.length,
    toolsCount: TOOLS.length,
    envKeys: {
      GROQ_API_KEY: process.env.GROQ_API_KEY ? ` configuré (${process.env.GROQ_API_KEY.slice(0, 6)}...)` : ' MANQUANT',
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? 'configuré' : 'manquant',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'configuré' : 'manquant',
      LLM_PROVIDER: process.env.LLM_PROVIDER || 'non défini (auto-détection)'
    }
  });
});

// === PROVIDERS ===

app.get('/api/providers', (req, res) => {
  res.json({ providers: listProviders(), active: getActiveProvider() });
});

// === CHAT ===

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) return res.status(400).json({ error: 'Message requis' });

    // 1. Commande slash?
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

    // 2. Message normal → LLM
    const { client, provider, error: llmError } = createLLMClient();

    if (!client || llmError) {
      // Erreur claire avec instructions
      return res.status(500).json({
        error: llmError || 'Aucun provider LLM configuré',
        type: 'config_error',
        hint: 'Vérifie ton fichier .env. Va sur /api/health pour le diagnostic.'
      });
    }

    const model = process.env.OPENAI_MODEL || provider.defaultModel;
    const memoryContext = getMemoryContext();
    const customRules = getRulesForPrompt();
    const conversationHistory = history.map(m => ({ role: m.role, content: m.content }));

    const basePrompt = buildSystemPrompt(message, history, customRules);
    const fullSystemPrompt = `${basePrompt}\n\n# MÉMOIRE LONG-TERME\n${memoryContext}\n\n# TOOLS\nTu peux exécuter des tools: run_bash, read_file, write_file, list_files, web_search, run_script, list_scripts, install_package.`;

    const messages = [
      { role: 'system', content: fullSystemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // Appel LLM
    let completion;
    try {
      const params = {
        model,
        messages,
        max_tokens: 4000,
        temperature: 0.8,
      };

      // Tools seulement si le provider les supporte
      if (provider.supportsTools) {
        params.tools = TOOLS;
      }

      completion = await client.chat.completions.create(params);
    } catch (apiError) {
      // Erreur API spécifique — message détaillé
      let errorMsg = apiError.message;

      // Erreurs courantes
      if (apiError.status === 401 || apiError.code === 'invalid_api_key') {
        errorMsg = `Clé API invalide pour ${provider.name}.
          Ta clé ${provider.apiKeyEnv} est incorrecte ou expirée.
          Obtiens une nouvelle clé: ${provider.signup}`;
      } else if (apiError.status === 429) {
        errorMsg = `Limite de taux atteinte sur ${provider.name}.
          Attends quelques secondes et réessaie.
          Si ça persiste, le plan gratuit a ses limites — essaie un autre provider.`;
      } else if (apiError.status === 404 || errorMsg.includes('model')) {
        errorMsg = `Modèle "${model}" non trouvé sur ${provider.name}.
          Vérifie OPENAI_MODEL dans ton .env.
          Modèles disponibles: ${provider.models.join(', ')}`;
      } else if (apiError.code === 'ECONNREFUSED' || apiError.code === 'ENOTFOUND') {
        errorMsg = `Connexion impossible à ${provider.name} (${provider.baseURL}).
          Vérifie ta connexion internet.`;
      }

      // Retry sans tools (certains modèles ne supportent pas les tools)
      if (provider.supportsTools && !errorMsg.includes('invalide') && !errorMsg.includes('401')) {
        try {
          completion = await client.chat.completions.create({
            model, messages, max_tokens: 4000, temperature: 0.8,
          });
        } catch (retryError) {
          return res.status(500).json({
            error: errorMsg,
            retryError: retryError.message,
            type: 'api_error',
            provider: provider.key,
            model
          });
        }
      } else {
        return res.status(500).json({
          error: errorMsg,
          type: 'api_error',
          provider: provider.key,
          model
        });
      }
    }

    let reply = completion.choices[0]?.message?.content || '';
    const toolCalls = completion.choices[0]?.message?.tool_calls;

    // 3. Tool calls
    if (toolCalls && toolCalls.length > 0) {
      messages.push(completion.choices[0].message);

      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        let toolArgs = {};
        try { toolArgs = JSON.parse(toolCall.function.arguments); } catch {}

        const result = await executeTool(toolName, toolArgs);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      // 2e appel avec résultats
      try {
        const secondCompletion = await client.chat.completions.create({
          model, messages, max_tokens: 4000, temperature: 0.8,
        });
        reply = secondCompletion.choices[0]?.message?.content || '';
      } catch (err) {
        // Si le 2e appel échoue, on donne quand même les résultats des tools
        reply = `J'ai exécuté les tools mais la réponse finale a échoué: ${err.message}`;
      }
    }

    if (!reply) {
      reply = 'Réponse vide du modèle. Essaie de reformuler.';
    }

    const fullConversation = [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: reply }
    ];
    saveConversation(fullConversation);

    res.json({ reply, provider: provider.key, model });
  } catch (error) {
    console.error('Erreur chat (catch global):', error);
    res.status(500).json({
      error: `Erreur serveur: ${error.message}`,
      type: 'server_error',
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
  }
});

// === RÈGLES ===
app.get('/api/rules', (req, res) => { res.json(loadRules()); });
app.post('/api/rules', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content requis' });
  res.json({ success: true, rule: addRule(content) });
});
app.delete('/api/rules/:id', (req, res) => { deleteRule(parseInt(req.params.id)); res.json({ success: true }); });
app.delete('/api/rules', (req, res) => { clearRules(); res.json({ success: true }); });

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
  res.json(await executeTool('run_script', { name, args }));
});
app.post('/api/tools/:toolName', async (req, res) => {
  res.json(await executeTool(req.params.toolName, req.body));
});

// === CONVERSATIONS ===
app.get('/api/conversations', (req, res) => { res.json(loadConversations()); });

// === IMAGES ===
app.post('/api/image', async (req, res) => {
  try {
    const { prompt, size = '1024x1024' } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt requis' });

    // Fallback gratuit: Pollinations.ai (toujours, pas besoin de clé)
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
    return res.json({ url: pollinationsUrl, provider: 'pollinations (free)' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  const provider = getActiveProvider();
  const rules = loadRules();
  const memory = loadMemory();
  const scripts = listAvailableScripts();

  console.log(`\n👻 Superagent Clone — http://localhost:${PORT}\n`);

  if (provider?.error) {
    console.log('⚠️  ERREUR DE CONFIGURATION:');
    console.log('─'.repeat(50));
    console.log(provider.error);
    console.log('─'.repeat(50));
    console.log('\n💡 Va sur http://localhost:' + PORT + '/api/health pour le diagnostic\n');
  } else if (provider) {
    console.log(`🤖 Provider: ${provider.name}`);
    console.log(`📋 Model: ${process.env.OPENAI_MODEL || provider.defaultModel}`);
    console.log(`💰 ${provider.free ? 'GRATUIT' : 'PAYANT'}`);
    console.log(`🧠 Memory: ${memory.entries.length} entrées`);
    console.log(`📏 Rules: ${rules.rules.length} (${rules.rules.length === 0 ? 'SANS LIMITES' : 'avec règles'})`);
    console.log(`🔧 Tools: ${TOOLS.length} | Scripts: ${scripts.length}`);
    console.log(`\n✅ Prêt! Va sur http://localhost:${PORT}\n`);
  } else {
    console.log('⚠️  Aucun provider configuré. Va sur /api/health\n');
  }
});
