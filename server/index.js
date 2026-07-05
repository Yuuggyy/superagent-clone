// index.js — Serveur Express principal

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

// === NETTOYEUR ===

const TOOL_NAMES = TOOLS.map(t => t.function.name);
const TOOL_PATTERNS = [
  new RegExp(`^\\s*(${TOOL_NAMES.join('|')})\\s*\\(`, 'im'),
  /```\s*(web_search|run_bash|read_file|write_file|list_files|run_script|list_scripts|install_package|github_tool|write_and_run)/gi,
  /^je vais (utiliser|exécuter|lancer|appeler|vérifier|chercher|lire|écrire|d'abord)/i,
  /^laissez-moi (utiliser|exécuter|chercher|vérifier|lancer)/i,
  /^let me (use|run|search|check|call|try)/i,
  /^i (will|'ll) (use|run|search|check|call)/i,
];

function cleanReply(text) {
  if (!text) return '';
  let lines = text.split('\n');
  let cleaned = [];
  for (let line of lines) {
    const trimmed = line.trim();
    if (TOOL_PATTERNS.some(p => p.test(trimmed))) continue;
    if (/^`?(web_search|run_bash|read_file|write_file|list_files|run_script|github_tool|write_and_run)`?\s*$/i.test(trimmed)) continue;
    cleaned.push(line);
  }
  return cleaned.join('\n').replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n').trim();
}

// === DÉTECTION D'IMAGE ===

function isImageRequest(message) {
  const lower = message.toLowerCase();
  const triggers = [
    'génère une image', 'genere une image', 'générer une image', 'generer une image',
    'crée une image', 'cree une image', 'créer une image', 'creer une image',
    'dessine', 'draw ', 'image de', 'photo de', 'génère un', 'genere un',
    'génère moi', 'genere moi', 'fait une image', 'crée un logo',
    'génération d\'image', 'generation d\'image', 'génère une photo',
    'image:', 'génère', 'genere', 'dessine-moi', 'dessine moi',
    'crée une illustration', 'fais une image', 'faire une image'
  ];
  return triggers.some(t => lower.includes(t));
}

function extractImagePrompt(message) {
  // Extraire le prompt de l'image depuis le message
  let prompt = message;
  const patterns = [
    /gén[èe]re??\s*(une\s*)?image\s*(de\s*)?(.+)/i,
    /gén[èe]re??\s*(une\s*)?photo\s*(de\s*)?(.+)/i,
    /gén[èe]re?\s*moi\s+(.+)/i,
    /cr[ée]e?\s*(une\s*)?image\s*(de\s*)?(.+)/i,
    /cr[ée]er?\s*(une\s*)?image\s*(de\s*)?(.+)/i,
    /dessine[-\s]moi\s+(.+)/i,
    /dessine\s+(.+)/i,
    /fait\s+une\s+image\s+(de\s*)?(.+)/i,
    /fais\s+une\s+image\s+(de\s*)?(.+)/i,
    /image\s*:\s*(.+)/i,
    /gén[èe]re?\s+(.+)/i,
    /cr[ée]e?\s+un\s+logo\s+(.+)/i,
    /cr[ée]e?\s+une\s+illustration\s+(de\s*)?(.+)/i,
  ];
  for (const p of patterns) {
    const match = message.match(p);
    if (match) {
      prompt = match[match.length - 1].trim();
      break;
    }
  }
  return prompt;
}

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

// === CHAT ===

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

    // 2. IMAGE? → générer directement
    if (isImageRequest(message)) {
      const prompt = extractImagePrompt(message);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
      const reply = `Image générée pour: "${prompt}"`;
      const fullConv = [...history, { role: 'user', content: message }, { role: 'assistant', content: reply, image: imageUrl }];
      saveConversation(fullConv);
      return res.json({ reply, image: imageUrl, provider: 'pollinations' });
    }

    // 3. Préparer le LLM
    const { client, provider, error: llmError } = createLLMClient();
    if (!client || llmError) {
      return res.status(500).json({ error: llmError || 'Aucun provider. Ajoute GROQ_API_KEY dans .env', type: 'config_error' });
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

    // 4. Appel LLM
    let completion;
    try {
      const params = {
        model, messages, max_tokens: 4000, temperature: 0.7,
        tool_choice: provider.supportsTools ? 'auto' : undefined,
        tools: provider.supportsTools ? TOOLS : undefined,
      };
      completion = await client.chat.completions.create(params);
    } catch (apiError) {
      try {
        completion = await client.chat.completions.create({ model, messages, max_tokens: 4000, temperature: 0.7 });
      } catch (retryErr) {
        return res.status(500).json({
          error: retryErr.status === 401 ? `Clé API invalide pour ${provider.name}. Vérifie ${provider.apiKeyEnv} dans .env` : `Erreur API: ${retryErr.message}`,
          type: 'api_error', provider: provider.key, model
        });
      }
    }

    let reply = completion.choices[0]?.message?.content || '';
    const toolCalls = completion.choices[0]?.message?.tool_calls;

    // 5. Tool calls
    if (toolCalls && toolCalls.length > 0) {
      messages.push(completion.choices[0].message);
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        let toolArgs = {};
        try { toolArgs = JSON.parse(toolCall.function.arguments); } catch {}
        const result = await executeTool(toolName, toolArgs);
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
      }
      try {
        const secondCompletion = await client.chat.completions.create({ model, messages, max_tokens: 4000, temperature: 0.7 });
        reply = secondCompletion.choices[0]?.message?.content || '';
      } catch (err) {
        reply = `Action exécutée. Erreur synthèse: ${err.message}`;
      }
    }

    // 6. Auto-execution
    if (!toolCalls && shouldAutoExecute(message)) {
      const autoResult = await autoExecute(message);
      if (autoResult) {
        reply = autoResult.output || reply;
      }
    }

    // 7. Nettoyer
    reply = cleanReply(reply);
    if (!reply || reply.length < 2) reply = 'C\'est fait. Autre chose ?';

    const fullConv = [...history, { role: 'user', content: message }, { role: 'assistant', content: reply }];
    saveConversation(fullConv);

    res.json({ reply, provider: provider.key, model, usedTools: !!toolCalls });
  } catch (error) {
    console.error('Erreur chat:', error);
    // Toujours renvoyer du JSON valide
    res.status(500).json({ error: `Erreur: ${error.message}`, type: 'server_error' });
  }
});

// === AUTO-EXECUTION ===

function shouldAutoExecute(message) {
  const lower = message.toLowerCase();
  const triggers = [
    'liste les fichiers', 'ls ', 'montre les fichiers', 'list files',
    'lance le script', 'exécute le script', 'run script',
    'ping ', 'vérifie la connexion',
    'infos système', 'system info', 'infos du système',
    'scanne les ports', 'port scan',
    'connecte à github', 'mes repos', 'liste mes repos', 'github',
    'crée un repo', 'create repo',
    'actualités', 'news', 'cherche ', 'recherche ', 'search ',
    'vérifie ', 'check '
  ];
  return triggers.some(t => lower.includes(t));
}

async function autoExecute(message) {
  const lower = message.toLowerCase();
  try {
    if (lower.includes('liste les fichiers') || lower.includes('list files') || lower.includes('montre les fichiers')) {
      const result = await executeTool('list_files', { path: '.' });
      return { output: result.files || result.error };
    }
    if (lower.includes('mes repos') || lower.includes('liste mes repos') || (lower.includes('github') && lower.includes('repo'))) {
      const result = await executeTool('github_tool', { action: 'list_repos' });
      if (result.success) return { output: result.repos.map(r => `${r.name} (${r.language || '?'}, ⭐${r.stars})`).join('\n') };
      return { output: result.error };
    }
    if (lower.includes('infos système') || lower.includes('system info')) {
      const result = await executeTool('run_script', { name: 'system-info' });
      return { output: result.stdout || result.error };
    }
    if (lower.includes('ping ')) {
      const host = message.split(/ping\s+/i)[1]?.trim().split(/\s+/)[0];
      if (host) {
        const result = await executeTool('run_script', { name: 'ping-check', args: host });
        return { output: result.stdout || result.error };
      }
    }
    if (lower.includes('port') && lower.includes('scan')) {
      const ip = message.match(/\d+\.\d+\.\d+\.\d+/)?.[0];
      if (ip) {
        const result = await executeTool('run_script', { name: 'port-scan', args: ip });
        return { output: result.stdout || result.error };
      }
    }
    if (lower.includes('connecte à github') || lower.includes('github user') || lower.includes('mon profil github')) {
      const result = await executeTool('github_tool', { action: 'get_user' });
      if (result.success) return { output: `User: ${result.user.login}\nName: ${result.user.name}\nRepos: ${result.user.repos}\nFollowers: ${result.user.followers}` };
      return { output: result.error };
    }
    if (lower.includes('crée un repo') || lower.includes('create repo')) {
      const name = message.match(/repo[:\s]+([\w-]+)/i)?.[1];
      if (name) {
        const result = await executeTool('github_tool', { action: 'create_repo', repo: name });
        return { output: result.success ? `Repo créé: ${result.url}` : result.error };
      }
    }
    if (lower.includes('actualités') || lower.includes('news') || lower.includes('cherche') || lower.includes('recherche')) {
      let query = message;
      if (lower.includes('actualités')) query = 'actualités du jour';
      else query = message.replace(/^(cherche|recherche)\s*/i, '');
      const result = await executeTool('web_search', { query });
      if (result.success) return { output: (result.results || result.content || 'Aucun résultat').slice(0, 4000) };
      return { output: result.error };
    }
  } catch (err) {
    return { output: `Erreur: ${err.message}` };
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

// === IMAGE ENDPOINT ===
app.post('/api/image', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt requis' });
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
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
    console.log(`📦 GitHub: ${github ? 'connecté' : 'non configuré'}`);
    console.log(`📏 Rules: ${rules.rules.length} (${rules.rules.length === 0 ? 'SANS LIMITES' : 'avec règles'})`);
    console.log(`\n✅ Prêt!\n`);
  } else {
    console.log('⚠️  Aucun provider. Va sur /api/health\n');
  }
});
