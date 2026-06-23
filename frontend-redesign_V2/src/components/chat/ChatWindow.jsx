import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { FiSend, FiX, FiMessageSquare } from "react-icons/fi";

export default function ChatWindow({ onClose }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("chat_messages");
      return saved ? JSON.parse(saved) : [
        { sender: "bot", text: "hello what you want to know in bangalore traffic?" }
      ];
    } catch (err) {
      console.error("Error loading chat messages from localStorage:", err);
      return [
        { sender: "bot", text: "hello what you want to know in bangalore traffic?" }
      ];
    }
  });
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    localStorage.setItem("chat_messages", JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!message.trim() || loading) return;

    const currentMsg = message;
    const userMessage = {
      sender: "user",
      text: currentMsg,
    };

    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setLoading(true);

    const isReset = ["reset", "restart", "clear"].includes(currentMsg.trim().toLowerCase());

    try {
      const response = await axios.post(
        "https://traffic-ai-backend-36vm.onrender.com/chat",
        { message: currentMsg }
      );

      if (isReset) {
        setMessages([
          { sender: "bot", text: "Conversation reset. Hello! What would you like to know about Bangalore traffic?" }
        ]);
        localStorage.removeItem("chat_messages");
      } else {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: response.data.answer,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Sorry, the traffic engine is temporarily offline. Please try again shortly.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="fixed bottom-24 right-6 w-[420px] h-[580px] bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden text-slate-100"
    >
      {/* Header */}
      <div className="flex justify-between items-center px-5 py-4 bg-slate-950/50 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-lg">
            <FiMessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-white">Traffic Assistant</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">AI Engined</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg, index) => {
          const isUser = msg.sender === "user";
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              key={index}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs font-normal leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? "bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-600/10"
                    : "bg-slate-800/90 text-slate-100 border border-slate-700/30 rounded-bl-none"
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          );
        })}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800/90 text-slate-100 border border-slate-700/30 rounded-2xl rounded-bl-none px-4 py-3 text-xs flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 bg-slate-950/40 border-t border-slate-800/80 flex gap-2.5">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about traffic, peak hours, or mock forecasts..."
          className="flex-1 bg-slate-850 border border-slate-800 hover:border-slate-700 focus:border-blue-600/80 text-white rounded-xl px-4 py-2.5 text-xs outline-none focus:outline-none transition-all placeholder-slate-500"
        />

        <button
          onClick={sendMessage}
          disabled={!message.trim() || loading}
          className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20 hover:shadow-blue-500/30 transition-all cursor-pointer"
        >
          <FiSend className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
