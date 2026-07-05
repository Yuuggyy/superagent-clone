// tools.js — Système de tools exécutables + GitHub
// L'agent agit pour de vrai

import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import dotenv from 'dotenv';

const execAsync = promisify(exec);
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');

if (!fs.existsSync(SCRIPTS_DIR)) {
  fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
}

// === TOOLS (format OpenAI/Groq function calling) ===

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'run_bash',
      description: 'Exécuter une commande bash/terminal. Retourne stdout et stderr. UTILISE-LE quand on demande d\'exécuter, installer, ou interagir avec le système.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'La commande bash à exécuter' },
          timeout: { type: 'integer', description: 'Timeout en secondes (défaut: 30)', default: 30 }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Lire le contenu d\'un fichier sur le serveur. UTILISE-LE quand on te demande de lire, vérifier, ou analyser un fichier.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Chemin du fichier' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Créer ou écraser un fichier avec du contenu. UTILISE-LE quand on te demande d\'écrire du code, créer un fichier, ou modifier un fichier existant.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Chemin du fichier' },
          content: { type: 'string', description: 'Contenu à écrire' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'Lister les fichiers et dossiers dans un répertoire.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Chemin du dossier (défaut: racine du projet)', default: '.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Rechercher sur le web via DuckDuckGo ou fetch une URL spécifique. UTILISE-LE pour chercher des infos, lire une page web, ou vérifier quelque chose en ligne.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Requête de recherche DuckDuckGo' },
          url: { type: 'string', description: 'URL spécifique à fetch' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_script',
      description: 'Exécuter un script personnalisé depuis le dossier scripts/. Scripts: ping-check, system-info, web-search, fetch-url, port-scan, zip-file, img-to-base64, extract-audio, cleanup, watch-file, qr-code, create-react-app.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nom du script (sans extension)' },
          args: { type: 'string', description: 'Arguments à passer au script' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_scripts',
      description: 'Lister tous les scripts disponibles dans scripts/',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'install_package',
      description: 'Installer un package npm sur le serveur.',
      parameters: {
        type: 'object',
        properties: {
          package: { type: 'string', description: 'Nom du package npm' }
        },
        required: ['package']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'github_tool',
      description: 'Interagir avec GitHub via l\'API. Actions: list_repos, get_repo, get_file, create_file, create_repo, delete_repo, list_commits, get_readme, get_user. Nécessite GITHUB_TOKEN dans .env.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list_repos', 'get_repo', 'get_file', 'create_file', 'create_repo', 'delete_repo', 'list_commits', 'get_readme', 'get_user'], description: 'Action GitHub à effectuer' },
          repo: { type: 'string', description: 'Nom du repo (owner/repo ou juste repo)' },
          path: { type: 'string', description: 'Chemin du fichier dans le repo' },
          content: { type: 'string', description: 'Contenu du fichier (pour create_file)' },
          message: { type: 'string', description: 'Message de commit (pour create_file)' },
          description: { type: 'string', description: 'Description du repo (pour create_repo)' },
          private: { type: 'boolean', description: 'Repo privé? (défaut: false)', default: false }
        },
        required: ['action']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_and_run',
      description: 'Écrire du code dans un fichier temporaire et l\'exécuter immédiatement. Pour exécuter du code à la volée (JS, Python, Bash).',
      parameters: {
        type: 'object',
        properties: {
          language: { type: 'string', enum: ['javascript', 'python', 'bash'], description: 'Langage du code' },
          code: { type: 'string', description: 'Le code à exécuter' },
          filename: { type: 'string', description: 'Nom du fichier (optionnel)' }
        },
        required: ['language', 'code']
      }
    }
  }
];

// === EXÉCUTION ===

export async function executeTool(toolName, args) {
  try {
    switch (toolName) {
      case 'run_bash': {
        const timeout = (args.timeout || 30) * 1000;
        try {
          const { stdout, stderr } = await execAsync(args.command, { timeout, maxBuffer: 1024 * 1024 * 10 });
          return { success: true, stdout: stdout.slice(0, 8000), stderr: stderr.slice(0, 3000) };
        } catch (err) {
          return { success: false, error: err.message.slice(0, 3000), stdout: err.stdout?.slice(0, 8000) || '', stderr: err.stderr?.slice(0, 3000) || '' };
        }
      }

      case 'read_file': {
        try {
          const content = fs.readFileSync(args.path, 'utf-8');
          return { success: true, content: content.slice(0, 15000), path: args.path };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }

      case 'write_file': {
        try {
          const dir = path.dirname(args.path);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(args.path, args.content);
          return { success: true, message: `Fichier écrit: ${args.path} (${args.content.length} caractères)` };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }

      case 'list_files': {
        try {
          const dir = args.path || '.';
          const files = fs.readdirSync(dir, { withFileTypes: true });
          const listing = files.map(f => `${f.isDirectory() ? '📁' : '📄'} ${f.name}`).join('\n');
          return { success: true, path: dir, files: listing };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }

      case 'web_search': {
        try {
          if (args.url) {
            const response = await fetch(args.url, {
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const text = await response.text();
            const cleanText = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                  .replace(/<[^>]+>/g, ' ')
                                  .replace(/\s+/g, ' ')
                                  .trim();
            return { success: true, url: args.url, content: cleanText.slice(0, 10000) };
          } else if (args.query) {
            const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`;
            const response = await fetch(url, {
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const text = await response.text();
            const cleanText = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                  .replace(/<[^>]+>/g, ' ')
                                  .replace(/\s+/g, ' ')
                                  .trim();
            return { success: true, query: args.query, results: cleanText.slice(0, 10000) };
          }
          return { success: false, error: 'Fournis query ou url' };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }

      case 'run_script': {
        try {
          const extensions = ['.js', '.sh', '.py'];
          let scriptPath = null;
          for (const ext of extensions) {
            const candidate = path.join(SCRIPTS_DIR, args.name + ext);
            if (fs.existsSync(candidate)) {
              scriptPath = candidate;
              break;
            }
          }
          if (!scriptPath) {
            return { success: false, error: `Script "${args.name}" non trouvé. Utilise list_scripts pour voir les scripts disponibles.` };
          }
          const ext = path.extname(scriptPath);
          let cmd;
          if (ext === '.js') cmd = `node "${scriptPath}" ${args.args || ''}`;
          else if (ext === '.sh') cmd = `bash "${scriptPath}" ${args.args || ''}`;
          else if (ext === '.py') cmd = `python3 "${scriptPath}" ${args.args || ''}`;
          const { stdout, stderr } = await execAsync(cmd, { timeout: 60000, maxBuffer: 1024 * 1024 * 10 });
          return { success: true, script: args.name, stdout: stdout.slice(0, 8000), stderr: stderr.slice(0, 3000) };
        } catch (err) {
          return { success: false, error: err.message.slice(0, 3000) };
        }
      }

      case 'list_scripts': {
        try {
          if (!fs.existsSync(SCRIPTS_DIR)) return { success: true, scripts: [] };
          const files = fs.readdirSync(SCRIPTS_DIR);
          const scripts = files.filter(f => /\.(js|sh|py)$/.test(f)).map(f => {
            const name = f.replace(/\.(js|sh|py)$/, '');
            const ext = path.extname(f);
            let desc = '';
            try {
              const content = fs.readFileSync(path.join(SCRIPTS_DIR, f), 'utf-8');
              const descMatch = content.match(/\/\/\s*DESC:\s*(.+)/) || content.match(/#\s*DESC:\s*(.+)/);
              if (descMatch) desc = descMatch[1].trim();
            } catch {}
            return { name, file: f, ext, description: desc };
          });
          return { success: true, scripts };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }

      case 'install_package': {
        try {
          const { stdout, stderr } = await execAsync(`npm install ${args.package}`, {
            cwd: path.join(__dirname, '..'),
            timeout: 120000,
            maxBuffer: 1024 * 1024 * 10
          });
          return { success: true, message: `Package ${args.package} installé`, output: (stdout + stderr).slice(0, 5000) };
        } catch (err) {
          return { success: false, error: err.message.slice(0, 3000) };
        }
      }

      case 'github_tool': {
        return await githubAction(args);
      }

      case 'write_and_run': {
        try {
          const tmpDir = path.join(__dirname, '..', 'tmp');
          if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

          let ext, cmd;
          if (args.language === 'javascript') {
            ext = '.js';
            cmd = 'node';
          } else if (args.language === 'python') {
            ext = '.py';
            cmd = 'python3';
          } else {
            ext = '.sh';
            cmd = 'bash';
          }

          const filename = args.filename || `exec_${Date.now()}${ext}`;
          const filePath = path.join(tmpDir, filename);
          fs.writeFileSync(filePath, args.code);

          const { stdout, stderr } = await execAsync(`${cmd} "${filePath}"`, {
            timeout: 30000,
            maxBuffer: 1024 * 1024 * 10
          });

          // Nettoyer
          try { fs.unlinkSync(filePath); } catch {}

          return { success: true, language: args.language, stdout: stdout.slice(0, 8000), stderr: stderr.slice(0, 3000) };
        } catch (err) {
          return { success: false, error: err.message.slice(0, 3000), stderr: err.stderr?.slice(0, 3000) || '' };
        }
      }

      default:
        return { success: false, error: `Tool inconnu: ${toolName}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// === GITHUB API ===

async function githubAction(args) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return {
      success: false,
      error: 'GITHUB_TOKEN non configuré. Ajoute un token GitHub dans .env:\n1. Va sur https://github.com/settings/tokens\n2. Génère un "Personal Access Token" (classic) avec les scopes: repo, user\n3. Ajoute dans .env: GITHUB_TOKEN=ghp_xxxxx'
    };
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  try {
    switch (args.action) {
      case 'get_user': {
        const res = await fetch('https://api.github.com/user', { headers });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.message };
        return { success: true, user: { login: data.login, name: data.name, repos: data.public_repos, followers: data.followers, avatar: data.avatar_url } };
      }

      case 'list_repos': {
        const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=30', { headers });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.message };
        const repos = data.map(r => ({ name: r.full_name, private: r.private, stars: r.stargazers_count, updated: r.updated_at, language: r.language, description: r.description }));
        return { success: true, repos };
      }

      case 'get_repo': {
        const res = await fetch(`https://api.github.com/repos/${args.repo}`, { headers });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.message };
        return { success: true, repo: { name: data.full_name, description: data.description, stars: data.stargazers_count, forks: data.forks_count, language: data.language, default_branch: data.default_branch, url: data.html_url } };
      }

      case 'get_file': {
        const res = await fetch(`https://api.github.com/repos/${args.repo}/contents/${args.path}`, { headers });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.message };
        if (data.type === 'file') {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          return { success: true, path: data.path, size: data.size, content: content.slice(0, 15000) };
        }
        if (data.type === 'dir') {
          const items = data.map(item => `${item.type === 'dir' ? '📁' : '📄'} ${item.name}`);
          return { success: true, path: args.path, items };
        }
        return { success: false, error: 'Type inconnu' };
      }

      case 'create_file': {
        // D'abord récupérer le SHA si le fichier existe
        let sha = null;
        try {
          const checkRes = await fetch(`https://api.github.com/repos/${args.repo}/contents/${args.path}`, { headers });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            sha = checkData.sha;
          }
        } catch {}

        const body = {
          message: args.message || `Update ${args.path}`,
          content: Buffer.from(args.content).toString('base64'),
        };
        if (sha) body.sha = sha;

        const res = await fetch(`https://api.github.com/repos/${args.repo}/contents/${args.path}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.message };
        return { success: true, message: `Fichier ${args.path} ${sha ? 'modifié' : 'créé'} dans ${args.repo}`, commit: data.commit?.sha };
      }

      case 'create_repo': {
        const res = await fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: args.repo,
            description: args.description || '',
            private: args.private || false,
            auto_init: true
          })
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.message };
        return { success: true, message: `Repo créé: ${data.full_name}`, url: data.html_url, clone_url: data.clone_url };
      }

      case 'delete_repo': {
        const res = await fetch(`https://api.github.com/repos/${args.repo}`, {
          method: 'DELETE',
          headers
        });
        if (res.status === 204) return { success: true, message: `Repo ${args.repo} supprimé` };
        const data = await res.json();
        return { success: false, error: data.message };
      }

      case 'list_commits': {
        const res = await fetch(`https://api.github.com/repos/${args.repo}/commits?per_page=10`, { headers });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.message };
        const commits = data.map(c => ({ sha: c.sha.slice(0, 7), message: c.commit.message.split('\n')[0], author: c.commit.author?.name, date: c.commit.author?.date }));
        return { success: true, commits };
      }

      case 'get_readme': {
        const res = await fetch(`https://api.github.com/repos/${args.repo}/readme`, { headers });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.message };
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return { success: true, content: content.slice(0, 15000) };
      }

      default:
        return { success: false, error: `Action GitHub inconnue: ${args.action}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function listAvailableScripts() {
  if (!fs.existsSync(SCRIPTS_DIR)) return [];
  const files = fs.readdirSync(SCRIPTS_DIR);
  return files.filter(f => /\.(js|sh|py)$/.test(f)).map(f => ({
    name: f.replace(/\.(js|sh|py)$/, ''),
    file: f,
    ext: path.extname(f)
  }));
}
