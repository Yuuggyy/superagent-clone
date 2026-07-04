// tools.js — Système de scripts exécutables pour l'agent
// L'agent peut exécuter des scripts pour faire des actions réelles

import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');

// S'assurer que le dossier scripts existe
if (!fs.existsSync(SCRIPTS_DIR)) {
  fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
}

// === DÉFINITION DES TOOLS (format OpenAI function calling) ===

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'run_bash',
      description: 'Exécuter une commande bash/terminal sur le serveur. Retourne stdout, stderr et le code de sortie.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'La commande à exécuter' },
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
      description: 'Lire le contenu d\'un fichier sur le serveur',
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
      description: 'Écrire du contenu dans un fichier sur le serveur',
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
      description: 'Lister les fichiers dans un dossier',
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
      description: 'Rechercher sur le web et récupérer le contenu d\'une URL',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL à fetch' },
          query: { type: 'string', description: 'Requête de recherche (utilise DuckDuckGo)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_script',
      description: 'Exécuter un script personnalisé depuis le dossier scripts/',
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
      description: 'Installer un package npm sur le serveur',
      parameters: {
        type: 'object',
        properties: {
          package: { type: 'string', description: 'Nom du package npm à installer' }
        },
        required: ['package']
      }
    }
  }
];

// === EXÉCUTION DES TOOLS ===

export async function executeTool(toolName, args) {
  try {
    switch (toolName) {
      case 'run_bash': {
        const timeout = (args.timeout || 30) * 1000;
        try {
          const { stdout, stderr } = await execAsync(args.command, { timeout, maxBuffer: 1024 * 1024 * 5 });
          return { success: true, stdout: stdout.slice(0, 5000), stderr: stderr.slice(0, 2000) };
        } catch (err) {
          return { success: false, error: err.message.slice(0, 2000), stdout: err.stdout?.slice(0, 5000) || '' };
        }
      }

      case 'read_file': {
        try {
          const content = fs.readFileSync(args.path, 'utf-8');
          return { success: true, content: content.slice(0, 10000) };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }

      case 'write_file': {
        try {
          const dir = path.dirname(args.path);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(args.path, args.content);
          return { success: true, message: `Fichier écrit: ${args.path}` };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }

      case 'list_files': {
        try {
          const dir = args.path || '.';
          const files = fs.readdirSync(dir, { withFileTypes: true });
          const listing = files.map(f => `${f.isDirectory() ? '📁' : '📄'} ${f.name}`).join('\n');
          return { success: true, files: listing };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }

      case 'web_search': {
        try {
          if (args.url) {
            // Fetch direct d'une URL
            const response = await fetch(args.url);
            const text = await response.text();
            // Extraire le texte basique (enlever HTML tags)
            const cleanText = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                  .replace(/<[^>]+>/g, ' ')
                                  .replace(/\s+/g, ' ')
                                  .trim();
            return { success: true, content: cleanText.slice(0, 8000) };
          } else if (args.query) {
            // DuckDuckGo search
            const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`;
            const response = await fetch(url);
            const text = await response.text();
            const cleanText = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                  .replace(/<[^>]+>/g, ' ')
                                  .replace(/\s+/g, ' ')
                                  .trim();
            return { success: true, results: cleanText.slice(0, 8000) };
          }
          return { success: false, error: 'Provide either url or query' };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }

      case 'run_script': {
        try {
          // Chercher le script avec différentes extensions
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
            return { success: false, error: `Script "${args.name}" non trouvé dans scripts/` };
          }
          const ext = path.extname(scriptPath);
          let cmd;
          if (ext === '.js') cmd = `node "${scriptPath}" ${args.args || ''}`;
          else if (ext === '.sh') cmd = `bash "${scriptPath}" ${args.args || ''}`;
          else if (ext === '.py') cmd = `python3 "${scriptPath}" ${args.args || ''}`;
          const { stdout, stderr } = await execAsync(cmd, { timeout: 60000, maxBuffer: 1024 * 1024 * 5 });
          return { success: true, stdout: stdout.slice(0, 8000), stderr: stderr.slice(0, 2000) };
        } catch (err) {
          return { success: false, error: err.message.slice(0, 2000) };
        }
      }

      case 'list_scripts': {
        try {
          if (!fs.existsSync(SCRIPTS_DIR)) return { success: true, scripts: [] };
          const files = fs.readdirSync(SCRIPTS_DIR);
          const scripts = files.filter(f => /\.(js|sh|py)$/.test(f)).map(f => {
            const name = f.replace(/\.(js|sh|py)$/, '');
            const ext = path.extname(f);
            // Lire la première ligne pour la description
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
            maxBuffer: 1024 * 1024 * 5
          });
          return { success: true, message: `Package ${args.package} installé`, output: stdout.slice(0, 3000) };
        } catch (err) {
          return { success: false, error: err.message.slice(0, 2000) };
        }
      }

      default:
        return { success: false, error: `Tool inconnu: ${toolName}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Lister les scripts disponibles
export function listAvailableScripts() {
  if (!fs.existsSync(SCRIPTS_DIR)) return [];
  const files = fs.readdirSync(SCRIPTS_DIR);
  return files.filter(f => /\.(js|sh|py)$/.test(f)).map(f => ({
    name: f.replace(/\.(js|sh|py)$/, ''),
    file: f,
    ext: path.extname(f)
  }));
}
