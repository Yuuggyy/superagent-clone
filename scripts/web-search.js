// DESC: Rechercher sur le web via DuckDuckGo et retourner les résultats
// Usage: node web-search.js "requête de recherche"

const query = process.argv.slice(2).join(' ');

if (!query) {
  console.log('Usage: node web-search.js "requête"');
  process.exit(1);
}

async function search() {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const html = await response.text();

    // Extraire les résultats (titres et URLs)
    const results = [];
    const regex = /<a rel="nofollow" class="result__a" href="([^"]+)">(.*?)<\/a>/g;
    let match;
    while ((match = regex.exec(html)) !== null && results.length < 10) {
      const url = match[1];
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      results.push({ title, url });
    }

    if (results.length === 0) {
      // Fallback: extraire tout le texte
      const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                       .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                       .replace(/<[^>]+>/g, ' ')
                       .replace(/\s+/g, ' ')
                       .trim();
      console.log(text.slice(0, 5000));
    } else {
      console.log(`Résultats pour: "${query}"\n`);
      results.forEach((r, i) => {
        console.log(`${i + 1}. ${r.title}`);
        console.log(`   ${r.url}\n`);
      });
    }
  } catch (err) {
    console.error('Erreur:', err.message);
  }
}

search();
