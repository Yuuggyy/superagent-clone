// DESC: Fetch une URL et retourne le texte de la page
// Usage: node fetch-url.js https://example.com

const url = process.argv[2];

if (!url) {
  console.log('Usage: node fetch-url.js <url>');
  process.exit(1);
}

async function fetchPage() {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await response.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    console.log(text.slice(0, 8000));
  } catch (err) {
    console.error('Erreur:', err.message);
  }
}

fetchPage();
