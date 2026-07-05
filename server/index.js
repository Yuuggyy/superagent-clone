// index.js — Serveur Express principal
// Multi-provider LLM + tools exécutables + GitHub + scripts + commandes slash

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
  res.json({
    status: provider?.error ? 'error' : 'ok',
    provider: provider ? { name: provider.name, model: process.env.OPENAI_MODEL || provider.defaultModel, hasKey: !!provider.apiKey, error: provider.error } : null,
    github: { configured: !!process.env.GITHUB_TOKEN?.trim() },
    toolsCount: TOOLS.length,
    scriptsCount: listAvailableScripts().length
  });
});

app.get('/api/providers', (req, res) => {
  res.json({ providers: listProviders(), active: getActiveProvider() });
});

// === CHAT avec tools + auto-détection d'intent ===

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'Message requis' });

    // 1. Commande slash?
    const command = parseSlashCommand(message);
    if (command) {
      const fullConv = [...history, { role: 'user', content: message }, { role: 'assistant', content: command.response }];
      saveConversation(fullConv);
      return res.json({ reply: command.response, isCommand: true, commandType: command.type });
    }

    // 2. Préparer le LLM
    const { client, provider, error: llmError } = createLLMClient();
    if (!client || llmError) {
      return res.status(500).json({ error: llmError || 'Aucun provider', type: 'config_error' });
    }

    const model = process.env.OPENAI_MODEL || provider.defaultModel;
    const customRules = getRulesForPrompt();
    const memoryContext = getMemoryContext();
    const conversationHistory = history.map(m => ({ role: m.role, content: m.content }));

    const fullSystemPrompt = buildSystemPrompt(message, history, customRules) + '\n\n# MÉMOIRE\n' + memoryContext;

    const messages = [
      { role: 'system', content: fullSystemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // 3. Appel LLM avec tools
    let completion;
    try {
      const params = {
        model,
        messages,
        max_tokens: 4000,
        temperature: 0.7,
        tool_choice: provider.supportsTools ? 'auto' : undefined,
        tools: provider.supportsTools ? TOOLS : undefined,
      };
      completion = await client.chat.completions.create(params);
    } catch (apiError) {
      // Retry sans tools
      try {
        completion = await client.chat.completions.create({ model, messages, max_tokens: 4000, temperature: 0.7 });
      } catch (retryErr) {
        return res.status(500).json({
          error: retryErr.status === 401 ? `Clé API invalide pour ${provider.name}` : retryErr.message,
          type: 'api_error', provider: provider.key, model
        });
      }
    }

    let reply = completion.choices[0]?.message?.content || '';
    const toolCalls = completion.choices[0]?.message?.tool_calls;

    // 4. Exécuter les tools si le LLM en a demandé
    if (toolCalls && toolCalls.length > 0) {
      messages.push(completion.choices[0].message);

      const toolSummaries = [];
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        let toolArgs = {};
        try { toolArgs = JSON.parse(toolCall.function.arguments); } catch {}

        const result = await executeTool(toolName, toolArgs);
        const status = result.success ? '✅' : '❌';
        toolSummaries.push(`${status} ${toolName}`);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      // 2e appel avec résultats
      try {
        const secondCompletion = await client.chat.completions.create({
          model, messages, max_tokens: 4000, temperature: 0.7
        });
        reply = secondCompletion.choices[0]?.message?.content || '';
      } catch (err) {
        // Si échec, donner au moins les résultats des tools
        reply = `J'ai exécuté les actions:\n${toolSummaries.join('\n')}\n\nErreur lors de la synthèse: ${err.message}`;
      }
    }

    // 5. Fallback: si pas de tool calls et le message semble nécessiter une action,
    // auto-exécuter (Llama peut parfois ne pas trigger les tools)
    if (!toolCalls && shouldAutoExecute(message)) {
      const autoResult = await autoExecute(message);
      if (autoResult) {
        reply = `${reply}\n\n_🔧 Action auto-exécutée: ${autoResult.summary}_\n\n\`\`\`\n${autoResult.output}\n\`\`\``;
      }
    }

    if (!reply) reply = 'Réponse vide. Reformule ta question.';

    const fullConv = [...history, { role: 'user', content: message }, { role: 'assistant', content: reply }];
    saveConversation(fullConv);

    res.json({ reply, provider: provider.key, model, usedTools: !!toolCalls });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: `Erreur serveur: ${error.message}`, type: 'server_error' });
  }
});

// === AUTO-EXECUTION (fallback si LLM ne trigger pas les tools) ===

function shouldAutoExecute(message) {
  const lower = message.toLowerCase();
  const triggers = [
    'liste les fichiers', 'ls ', 'montre les fichiers', 'list files',
    'lance le script', 'exécute le script', 'run script',
    'ping ', 'vérifie la connexion',
    'infos système', 'system info', 'infos du système',
    'scanne les ports', 'port scan',
    'connecte à github', 'mes repos', 'liste mes repos', 'github',
    'crée un repo', 'create repo'
  ];
  return triggers.some(t => lower.includes(t));
}

async function autoExecute(message) {
  const lower = message.toLowerCase();

  try {
    if (lower.includes('liste les fichiers') || lower.includes('list files') || lower.includes('montre les fichiers')) {
      const result = await executeTool('list_files', { path: '.' });
      return { summary: 'list_files', output: result.files || result.error };
    }

    if (lower.includes('mes repos') || lower.includes('liste mes repos') || (lower.includes('github') && lower.includes('repo'))) {
      const result = await executeTool('github_tool', { action: 'list_repos' });
      if (result.success) {
        const output = result.repos.map(r => `${r.name} (${r.language || '?'}, ⭐${r.stars})`).join('\n');
        return { summary: 'github list_repos', output };
      }
      return { summary: 'github list_repos', output: result.error };
    }

    if (lower.includes('infos système') || lower.includes('system info')) {
      const result = await executeTool('run_script', { name: 'system-info' });
      return { summary: 'system-info', output: result.stdout || result.error };
    }

    if (lower.includes('ping ')) {
      const host = message.split(/ping\s+/i)[1]?.trim().split(/\s+/)[0];
      if (host) {
        const result = await executeTool('run_script', { name: 'ping-check', args: host });
        return { summary: `ping ${host}`, output: result.stdout || result.error };
      }
    }

    if (lower.includes('port') && lower.includes('scan')) {
      const ip = message.match(/\d+\.\d+\.\d+\.\d+/)?.[0];
      if (ip) {
        const result = await executeTool('run_script', { name: 'port-scan', args: ip });
        return { summary: `port-scan ${ip}`, output: result.stdout || result.error };
      }
    }

    if (lower.includes('connecte à github') || lower.includes('github user') || lower.includes('mon profil github')) {
      const result = await executeTool('github_tool', { action: 'get_user' });
      if (result.success) {
        return { summary: 'github get_user', output: `User: ${result.user.login}\nName: ${result.user.name}\nRepos: ${result.user.repos}\nFollowers: ${result.user.followers}` };
      }
      return { summary: 'github get_user', output: result.error };
    }

    if (lower.includes('crée un repo') || lower.includes('create repo')) {
      const name = message.match(/repo[:\s]+([\w-]+)/i)?.[1] || message.match(/appel[ée]?\s+([\w-]+)/i)?.[1];
      if (name) {
        const result = await executeTool('github_tool', { action: 'create_repo', repo: name });
        return { summary: `create_repo ${name}`, output: result.success ? `Créé: ${result.url}` : result.error };
      }
    }

  } catch (err) {
    return { summary: 'auto-execute error', output: err.message };
  }

  return null;
}

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

// === SCRIPTS & TOOLS ===
app.get('/api/scripts', (req, res) => {
  res.json({ scripts: listAvailableScripts(), tools: TOOLS.map(t => t.function.name) });
});
app.post('/api/scripts/run', async (req, res) => {
  res.json(await executeTool('run_script', { name: req.body.name, args: req.body.args }));
});
app.post('/api/tools/:toolName', async (req, res) => {
  res.json(await executeTool(req.params.toolName, req.body));
});

// === CONVERSATIONS ===
app.get('/api/conversations', (req, res) => { res.json(loadConversations()); });

// === IMAGES (Pollinations gratuit) ===
app.post('/api/image', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt requis' });
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
    res.json({ url, provider: 'pollinations (free)' });
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
  const scripts = listAvailableScripts();
  const github = !!process.env.GITHUB_TOKEN?.trim();

  console.log(`\n👻 Superagent Clone — http://localhost:${PORT}\n`);

  if (provider?.error) {
    console.log('⚠️  ERREUR CONFIG LLM:');
    console.log(provider.error);
  } else if (provider) {
    console.log(`🤖 ${provider.name} → ${process.env.OPENAI_MODEL || provider.defaultModel}`);
    console.log(`💰 ${provider.free ? 'GRATUIT' : 'PAYANT'}`);
    console.log(`🔧 Tools: ${TOOLS.length} | Scripts: ${scripts.length}`);
    console.log(`📦 GitHub: ${github ? 'connecté' : 'non configuré (ajoute GITHUB_TOKEN dans .env)'}`);
    console.log(`📏 Rules: ${rules.rules.length} (${rules.rules.length === 0 ? 'SANS LIMITES' : 'avec règles'})`);
    console.log(`\n✅ Prêt!\n`);
  } else {
    console.log('⚠️  Aucun provider. Va sur /api/health\n');
  }
});
