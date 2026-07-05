import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User } from 'lucide-react';

interface AIAssistantChatProps {
  API_BASE: string;
}

export const AIAssistantChat: React.FC<AIAssistantChatProps> = ({ API_BASE }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'bot' | 'user'; text: string }>>([
    {
      sender: 'bot',
      text: "Hello! I am the **CYCLONE AI Decision Assistant**.\n\n" +
            "You can query the database using natural language. Try asking me:\n" +
            "- *'Show strongest cyclone after 1999'*\n" +
            "- *'Compare Amphan and Fani'*\n" +
            "- *'Predict landfall'*\n" +
            "- *'List evacuation shelters'*"
    }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userText = message;
    setChatHistory(prev => [...prev, { sender: 'user', text: userText }]);
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText })
      });
      const data = await res.json();
      setChatHistory(prev => [...prev, { sender: 'bot', text: data.response }]);
    } catch (err) {
      console.error("Error talking to AI Assistant:", err);
      setChatHistory(prev => [
        ...prev,
        { sender: 'bot', text: "Sorry, I'm experiencing connectivity issues. Please verify the backend FastAPI server is running." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Convert markdown-like syntax to HTML strings
  const formatMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="fixed bottom-4 right-4 z-[999] flex flex-col items-end pointer-events-auto">
      {/* Chat Drawer window */}
      {isOpen && (
        <div className="w-80 h-96 glass-panel rounded-xl shadow-2xl flex flex-col mb-3 border border-indigo-500/20 overflow-hidden">
          {/* Header */}
          <div className="bg-slate-950/80 p-3.5 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold tracking-wider uppercase text-slate-200">AI Assistant R2-D2</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatHistory.map((chat, idx) => (
              <div
                key={idx}
                className={`flex gap-2 max-w-[85%] ${chat.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div className={`p-1.5 rounded-full shrink-0 h-fit ${chat.sender === 'user' ? 'bg-indigo-600/30' : 'bg-slate-900/50 border border-white/5'}`}>
                  {chat.sender === 'user' ? <User className="w-3.5 h-3.5 text-indigo-300" /> : <Bot className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
                <div
                  className={`text-xs rounded-lg p-2.5 leading-relaxed ${
                    chat.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-900/80 border border-white/5 text-slate-300 rounded-tl-none'
                  }`}
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(chat.text) }}
                />
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 max-w-[80%]">
                <div className="p-1.5 rounded-full bg-slate-900/50 border border-white/5 shrink-0">
                  <Bot className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                </div>
                <div className="bg-slate-900/80 border border-white/5 text-slate-500 rounded-lg p-2.5 text-xs animate-pulse rounded-tl-none">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          {/* Input field form */}
          <form onSubmit={handleSendMessage} className="p-2 border-t border-white/5 bg-slate-950/40 flex gap-1.5">
            <input
              type="text"
              placeholder="Ask a question..."
              className="flex-1 bg-slate-900 border border-white/10 rounded px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/40 rounded p-1.5 text-white transition-all shadow-glow-blue flex items-center justify-center shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-2xl transition-transform hover:scale-105 border border-indigo-400/30 shadow-glow-blue"
      >
        <MessageSquare className="w-5 h-5 animate-pulse" />
      </button>
    </div>
  );
};
