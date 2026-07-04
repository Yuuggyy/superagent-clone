import { useState, useRef, useEffect } from 'react';

const API_URL = import.meta.env.DEV ? '' : '';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [memory, setMemory] = useState([]);
  const messagesEndRef = useRef(null);

  // Charger les messages depuis localStorage au démarrage
  useEffect(() => {
    const saved = localStorage.getItem('chat_messages');
    if (saved) {
      setMessages(JSON.parse(saved));
    }
  }, []);

  // Sauvegarder les messages
  useEffect(() => {
    localStorage.setItem('chat_messages', JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Charger la mémoire
  const fetchMemory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/memory`);
      const data = await res.json();
      setMemory(data.entries || []);
    } catch (err) {
      console.error('Erreur mémoire:', err);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.trim(),
          history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await res.json();

      if (data.error) {
        setMessages([...newMessages, { role: 'assistant', content: `Erreur: ${data.error}` }]);
      } else {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
      }
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `Erreur de connexion: ${err.message}` }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem('chat_messages');
    setShowMenu(false);
  };

  const openMemory = async () => {
    await fetchMemory();
    setShowMemory(true);
    setShowMenu(false);
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="avatar">👻</div>
          <div className="header-info">
            <h1>Superagent</h1>
            <span className="status">{loading ? 'écrit...' : 'en ligne'}</span>
          </div>
        </div>
        <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>
          ⋮
        </button>
      </header>

      {/* Menu dropdown */}
      {showMenu && (
        <div className="menu-dropdown">
          <button onClick={openMemory}>🧠 Mémoire</button>
          <button onClick={clearChat}>🗑️ Effacer chat</button>
        </div>
      )}

      {/* Memory panel */}
      {showMemory && (
        <div className="memory-panel" onClick={() => setShowMemory(false)}>
          <div className="memory-content" onClick={e => e.stopPropagation()}>
            <div className="memory-header">
              <h2>🧠 Mémoire longue terme</h2>
              <button onClick={() => setShowMemory(false)}>✕</button>
            </div>
            <div className="memory-list">
              {memory.length === 0 ? (
                <p className="empty">Aucun souvenir pour le moment</p>
              ) : (
                memory.map(entry => (
                  <div key={entry.id} className="memory-item">
                    <div className="memory-title">{entry.title}</div>
                    <div className="memory-text">{entry.content}</div>
                    <div className="memory-date">{entry.date}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="messages">
        {messages.length === 0 && (
          <div className="welcome">
            <div className="welcome-icon">👻</div>
            <h2>Salut Michael 👊</h2>
            <p>Je suis là. Qu'est-ce qu'on fait ?</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-content">
              {msg.content.split('\n').map((line, j) => (
                <p key={j}>{line}</p>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className="message assistant">
            <div className="message-content typing">
              <span>●</span><span>●</span><span>●</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="input-bar">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écris ton message..."
          rows={1}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={!input.trim() || loading} className="send-btn">
          ➤
        </button>
      </div>
    </div>
  );
}
