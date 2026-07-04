import { useState, useRef, useEffect } from 'react';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [memory, setMemory] = useState([]);
  const [rules, setRules] = useState([]);
  const [rulesCount, setRulesCount] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('chat_messages');
    if (saved) setMessages(JSON.parse(saved));
    fetchRulesCount();
  }, []);

  useEffect(() => {
    localStorage.setItem('chat_messages', JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchRulesCount = async () => {
    try {
      const res = await fetch('/api/rules');
      const data = await res.json();
      setRules(data.rules || []);
      setRulesCount(data.rules?.length || 0);
    } catch (err) {}
  };

  const fetchMemory = async () => {
    try {
      const res = await fetch('/api/memory');
      const data = await res.json();
      setMemory(data.entries || []);
    } catch (err) {}
  };

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/rules');
      const data = await res.json();
      setRules(data.rules || []);
      setRulesCount(data.rules?.length || 0);
    } catch (err) {}
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
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
        // Si c'était une commande de règle, refresh le compteur
        if (data.isCommand && (data.commandType === 'rule_added' || data.commandType === 'rule_deleted' || data.commandType === 'rules_cleared')) {
          fetchRulesCount();
        }
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

  // Suggérer les commandes slash
  const slashCommands = [
    { cmd: '/rule: ', desc: 'Ajouter une règle' },
    { cmd: '/rules', desc: 'Voir les règles' },
    { cmd: '/delrule: ', desc: 'Supprimer une règle' },
    { cmd: '/clearrules', desc: 'Supprimer toutes les règles' },
    { cmd: '/memory', desc: 'Voir la mémoire' },
    { cmd: '/remember: ', desc: 'Ajouter un souvenir' },
    { cmd: '/help', desc: 'Aide' },
  ];

  const showSlashSuggestions = input.startsWith('/') && !input.includes('\n');

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="avatar">👻</div>
          <div className="header-info">
            <h1>Superagent</h1>
            <span className="status">
              {loading ? 'écrit...' : 'en ligne'}
              {rulesCount > 0 && <span className="rules-badge"> {rulesCount} règle{rulesCount > 1 ? 's' : ''}</span>}
              {rulesCount === 0 && <span className="free-badge"> SANS LIMITES</span>}
            </span>
          </div>
        </div>
        <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>⋮</button>
      </header>

      {/* Menu */}
      {showMenu && (
        <div className="menu-dropdown">
          <button onClick={() => { fetchRules(); setShowRules(true); setShowMenu(false); }}>📏 Règles ({rulesCount})</button>
          <button onClick={() => { fetchMemory(); setShowMemory(true); setShowMenu(false); }}>🧠 Mémoire</button>
          <button onClick={clearChat}>🗑️ Effacer chat</button>
        </div>
      )}

      {/* Rules panel */}
      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📏 Règles {rulesCount === 0 && <span className="free-badge">SANS LIMITES</span>}</h2>
              <button onClick={() => setShowRules(false)}>✕</button>
            </div>
            <div className="modal-list">
              {rules.length === 0 ? (
                <p className="empty">Aucune règle définie. L'agent est totalement libre.<br/><br/>Utilise <code>/rule: texte</code> dans le chat pour en ajouter.</p>
              ) : (
                rules.map(r => (
                  <div key={r.id} className="list-item">
                    <div className="list-item-text">{r.content}</div>
                    <button className="delete-btn" onClick={async () => {
                      await fetch(`/api/rules/${r.id}`, { method: 'DELETE' });
                      fetchRules();
                    }}>✕</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Memory panel */}
      {showMemory && (
        <div className="overlay" onClick={() => setShowMemory(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🧠 Mémoire</h2>
              <button onClick={() => setShowMemory(false)}>✕</button>
            </div>
            <div className="modal-list">
              {memory.length === 0 ? (
                <p className="empty">Aucun souvenir</p>
              ) : (
                memory.map(entry => (
                  <div key={entry.id} className="list-item">
                    <div>
                      <div className="list-item-title">{entry.title}</div>
                      <div className="list-item-text">{entry.content}</div>
                      <div className="list-item-date">{entry.date}</div>
                    </div>
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
            <p>Je suis là, sans limites. Qu'est-ce qu'on fait ?</p>
            <p className="welcome-hint">Tape /help pour voir les commandes</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role} ${msg.content.startsWith('✅') || msg.content.startsWith('🗑️') || msg.content.startsWith('📋') || msg.content.startsWith('🔧') || msg.content.startsWith('🧠') ? 'system' : ''}`}>
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

      {/* Slash suggestions */}
      {showSlashSuggestions && (
        <div className="slash-suggestions">
          {slashCommands.filter(s => s.cmd.startsWith(input)).map(s => (
            <button key={s.cmd} className="slash-item" onClick={() => { setInput(s.cmd); inputRef.current?.focus(); }}>
              <span className="slash-cmd">{s.cmd}</span>
              <span className="slash-desc">{s.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="input-bar">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écris ton message... ou /help"
          rows={1}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={!input.trim() || loading} className="send-btn">➤</button>
      </div>
    </div>
  );
}
