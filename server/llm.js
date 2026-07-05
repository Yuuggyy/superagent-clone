// llm.js — Multi-provider support
// Supporte: Groq (gratuit, rapide), OpenAI, OpenRouter, Mistral, Together, Ollama

import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const PROVIDERS = {
  groq: {
    name: 'Groq (FREE — Llama 3.3 70B)',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'deepseek-r1-distill-llama-70b'],
    free: true,
    supportsTools: true,
    signup: 'https://console.groq.com'
  },
  openrouter: {
    name: 'OpenRouter (free models)',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    models: ['meta-llama/llama-3.3-70b-instruct:free', 'mistralai/mistral-7b-instruct:free', 'google/gemini-2.0-flash-exp:free', 'deepseek/deepseek-r1:free'],
    free: true,
    supportsTools: true,
    signup: 'https://openrouter.ai'
  },
  mistral: {
    name: 'Mistral (européen)',
    baseURL: 'https://api.mistral.ai/v1',
    apiKeyEnv: 'MISTRAL_API_KEY',
    defaultModel: 'mistral-large-latest',
    models: ['mistral-large-latest', 'mistral-small-latest', 'open-mistral-7b'],
    free: false,
    supportsTools: true,
    signup: 'https://console.mistral.ai'
  },
  openai: {
    name: 'OpenAI (payant)',
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    free: false,
    supportsTools: true,
    signup: 'https://platform.openai.com'
  },
  together: {
    name: 'Together AI (free credits)',
    baseURL: 'https://api.together.xyz/v1',
    apiKeyEnv: 'TOGETHER_API_KEY',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo-Free', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'],
    free: true,
    supportsTools: true,
    signup: 'https://api.together.ai'
  },
  ollama: {
    name: 'Ollama (LOCAL — 100% gratuit)',
    baseURL: 'http://localhost:11434/v1',
    apiKeyEnv: 'OLLAMA_API_KEY',
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'llama3.1:8b', 'mistral', 'qwen2.5:7b', 'deepseek-r1:7b'],
    free: true,
    supportsTools: false,
    signup: 'https://ollama.com'
  }
};

// Détecter quel provider est configuré — avec validation stricte
export function getActiveProvider() {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase().trim();

  if (explicit && PROVIDERS[explicit]) {
    const provider = PROVIDERS[explicit];
    const rawKey = process.env[provider.apiKeyEnv];
    const apiKey = rawKey?.trim();

    // Pour ollama, pas besoin de clé
    if (explicit === 'ollama') {
      return { key: explicit, ...provider, apiKey: 'ollama' };
    }

    // Vérifier que la clé existe et n'est pas vide
    if (!apiKey || apiKey.length < 10) {
      return {
        key: explicit,
        ...provider,
        apiKey: null,
        error: `Provider "${explicit}" sélectionné mais clé API manquante ou invalide.
        Variable attendue: ${provider.apiKeyEnv}
        Obtiens une clé gratuite: ${provider.signup}
        Ajoute-la dans ton fichier .env: ${provider.apiKeyEnv}=ta_clé_ici`
      };
    }

    return { key: explicit, ...provider, apiKey };
  }

  // Auto-détection: trouver le premier provider avec une clé valide
  const order = ['groq', 'openrouter', 'together', 'mistral', 'openai', 'ollama'];
  for (const key of order) {
    const provider = PROVIDERS[key];
    const rawKey = process.env[provider.apiKeyEnv];
    const apiKey = rawKey?.trim();

    if (key === 'ollama') {
      // Ollama en dernier recours seulement si explicitement demandé
      continue;
    }

    if (apiKey && apiKey.length >= 10) {
      return { key, ...provider, apiKey };
    }
  }

  // Aucun provider trouvé
  return {
    key: null,
    name: null,
    error: `AUCUN PROVIDER LLM CONFIGURÉ.

        Solution la plus simple (GRATUIT):
        1. Va sur https://console.groq.com
        2. Crée un compte (gratuit, pas de carte de crédit)
        3. Crée une API key
        4. Dans ton fichier .env, ajoute:
           GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx
        5. Relance: npm run dev

        Autres providers gratuits:
        - OpenRouter: https://openrouter.ai → OPENROUTER_API_KEY
        - Together AI: https://api.together.ai → TOGETHER_API_KEY`
  };
}

// Créer le client LLM
export function createLLMClient() {
  const provider = getActiveProvider();

  if (provider.error) {
    return { client: null, provider, error: provider.error };
  }

  if (!provider.apiKey) {
    return { client: null, provider, error: `Clé API manquante pour ${provider.name}` };
  }

  try {
    const client = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseURL,
    });
    return { client, provider, error: null };
  } catch (err) {
    return { client: null, provider, error: `Impossible de créer le client LLM: ${err.message}` };
  }
}

// Lister tous les providers
export function listProviders() {
  return Object.entries(PROVIDERS).map(([key, p]) => ({
    key,
    name: p.name,
    free: p.free,
    models: p.models,
    defaultModel: p.defaultModel,
    apiKeyEnv: p.apiKeyEnv,
    signup: p.signup,
    configured: !!process.env[p.apiKeyEnv]?.trim() && process.env[p.apiKeyEnv].trim().length >= 10,
    supportsTools: p.supportsTools
  }));
}

export { PROVIDERS };
