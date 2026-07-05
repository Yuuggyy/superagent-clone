import { useState, useRef, useEffect } from 'react';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [memory, setMemory] = useState([]);
  const [rules, setRules] = useState([]);
  const [rulesCount, setRulesCount] = useState(0);
  const [scripts, setScripts] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('chat_messages');
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch { setMessages([]); }
    }
    fetchRulesCount();
    fetchScripts();
  }, []);

  useEffect(() => {
    localStorage.setItem('chat_messages', JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchRulesCount = async () => {
    try { const res = await fetch('/api/rules'); const data = await res.json(); setRules(data.rules || []); setRulesCount(data.rules?.length || 0); } catch {}
  };
  const fetchMemory = async () => {
    try { const res = await fetch('/api/memory'); const data = await res.json(); setMemory(data.entries || []); } catch {}
  };
  const fetchRules = async () => {
    try { const res = await fetch('/api/rules'); const data = await res.json(); setRules(data.rules || []); setRulesCount(data.rules?.length || 0); } catch {}
  };
  const fetchScripts = async () => {
    try { const res = await fetch('/api/scripts'); const data = await res.json(); setScripts(data.scripts || []); } catch {}
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

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Erreur serveur' }));
        setMessages([...newMessages, { role: 'assistant', content: `⚠️ ${errData.error || 'Erreur'}` }]);
        setLoading(false);
        return;
      }

      const data = await res.json();

      if (data.error) {
        setMessages([...newMessages, { role: 'assistant', content: `⚠️ ${data.error}` }]);
      } else {
        const assistantMsg = { role: 'assistant', content: data.reply };
        if (data.image) assistantMsg.image = data.image;
        setMessages([...newMessages, assistantMsg]);
        if (data.isCommand && ['rule_added', 'rule_deleted', 'rules_cleared'].includes(data.commandType)) {
          fetchRulesCount();
        }
      }
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `Erreur: ${err.message}` }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem('chat_messages');
    setShowMenu(false);
  };

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
      <header className="header">
        <div className="header-left">
          <div className="avatar">👻</div>
          <div className="header-info">
            <h1>Superagent</h1>
            <span className="status">
              {loading ? 'écrit...' : 'en ligne'}
              {rulesCount > 0 && <span className="rules-badge"> {rulesCount} règle{rulesCount > 1 ? 's' : ''}</span>}
              {rulesCount === 0 && <span className="free-badge"> FREE</span>}
            </span>
          </div>
        </div>
        <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>⋮</button>
      </header>

      {showMenu && (
        <div className="menu-dropdown">
          <button onClick={() => { fetchRules(); setShowRules(true); setShowMenu(false); }}>📏 Règles ({rulesCount})</button>
          <button onClick={() => { fetchScripts(); setShowTools(true); setShowMenu(false); }}>🔧 Tools & Scripts ({scripts.length})</button>
          <button onClick={() => { fetchMemory(); setShowMemory(true); setShowMenu(false); }}>🧠 Mémoire</button>
          <button onClick={clearChat}>🗑️ Effacer chat</button>
        </div>
      )}

      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📏 Règles {rulesCount === 0 && <span className="free-badge">SANS LIMITES</span>}</h2>
              <button onClick={() => setShowRules(false)}>✕</button>
            </div>
            <div className="modal-list">
              {rules.length === 0 ? (
                <p className="empty">Aucune règle. L'agent est libre.<br/>Utilise <code>/rule: texte</code> pour en ajouter.</p>
              ) : (
                rules.map(r => (
                  <div key={r.id} className="list-item">
                    <div className="list-item-text">{r.content}</div>
                    <button className="delete-btn" onClick={async () => { await fetch(`/api/rules/${r.id}`, { method: 'DELETE' }); fetchRules(); }}>✕</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showTools && (
        <div className="overlay" onClick={() => setShowTools(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔧 Tools & Scripts</h2>
              <button onClick={() => setShowTools(false)}>✕</button>
            </div>
            <div className="modal-list">
              <div className="list-item-title" style={{marginBottom: '8px'}}>Tools intégrés:</div>
              <div className="list-item">
                <div className="list-item-text">run_bash, read_file, write_file, list_files, web_search, run_script, github_tool, write_and_run, install_package</div>
              </div>
              <div className="list-item-title" style={{marginTop: '12px', marginBottom: '8px'}}>Scripts:</div>
              {scripts.map(s => (
                <div key={s.file} className="list-item">
                  <div>
                    <div className="list-item-title">{s.name}</div>
                    <div className="list-item-text">{s.description || s.file}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showMemory && (
        <div className="overlay" onClick={() => setShowMemory(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🧠 Mémoire</h2>
              <button onClick={() => setShowMemory(false)}>✕</button>
            </div>
            <div className="modal-list">
              {memory.length === 0 ? (<p className="empty">Aucun souvenir</p>) : (
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

      <div className="messages">
        {messages.length === 0 && (
          <div className="welcome">
            <div className="welcome-icon">👻</div>
            <h2>Salut Michael 👊</h2>
            <p>Agent autonome — sans limites, avec tools et scripts.</p>
            <p className="welcome-hint">Essaie: "génère une image de..." ou "mes repos GitHub"</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-content">
              {msg.content && msg.content.split('\n').map((line, j) => (
                <p key={j}>{line}</p>
              ))}
              {msg.image && (
                <img src={msg.image} alt="Générée" className="chat-image" />
              )}
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

      <div className="input-bar">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Demande quelque chose... ou /help"
          rows={1}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={!input.trim() || loading} className="send-btn">➤</button>
      </div>
    </div>
  );
}
