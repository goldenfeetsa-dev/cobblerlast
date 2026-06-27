import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, MicOff, Send, X, Sparkles, Loader2, 
  CheckCircle, AlertTriangle, Volume2, VolumeX, Bot, User, Trash2
} from 'lucide-react';
import { base44 } from '@/api/supabaseApi';
import { getSession } from '@/lib/sessionStore';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

// ── Gemini API ─────────────────────────────────────────────────
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ── System Prompt ───────────────────────────────────────────────
const SYSTEM_PROMPT = `أنت مساعد ذكي لنظام إدارة ورشة "إبرة وخيط الإسكافي" في الرياض.
تتحدث باللغة العربية دائماً بأسلوب ودي ومهني.

لديك صلاحية تنفيذ الأوامر التالية في النظام. عندما يطلب المستخدم تنفيذ أي أمر، قم بتحليل الطلب وأرجع استجابة JSON فقط عند الحاجة للتنفيذ.

الأوامر المتاحة:
1. تحديث حالة طلب: {"action": "UPDATE_ORDER_STATUS", "orderId": "...", "status": "pending|in_progress|ready|completed|cancelled", "reason": "سبب التغيير"}
2. إنشاء طلب جديد: {"action": "CREATE_ORDER", "customerName": "...", "customerPhone": "...", "itemType": "shoes|bag|dress|suit|jacket|pants|shirt|other", "description": "..."}
3. البحث عن طلبات: {"action": "SEARCH_ORDERS", "query": "..."}
4. عرض الإحصائيات: {"action": "GET_STATS"}
5. الانتقال لصفحة: {"action": "NAVIGATE", "path": "/orders|/customers|/new-order|/dashboard|/sales|/workshop|/operations"}
6. تحديث حجز: {"action": "UPDATE_BOOKING_STATUS", "bookingId": "...", "status": "pending|confirmed|completed|cancelled"}

إذا كان الطلب يحتاج تنفيذ أمر، أجب بهذا الشكل:
{
  "message": "رسالتك للمستخدم هنا (ماذا ستفعل)",
  "command": { الأمر هنا },
  "requiresConfirmation": true/false
}

إذا كان requiresConfirmation = false سيتم التنفيذ فوراً.
إذا كان requiresConfirmation = true سيُطلب من المستخدم الموافقة أولاً.

للأوامر الخطيرة (حذف، إلغاء، إنشاء) اجعل requiresConfirmation = true.
للاستعلامات (بحث، عرض، إحصائيات، انتقال) اجعل requiresConfirmation = false.

إذا لم يكن هناك أمر للتنفيذ، أجب فقط بـ:
{
  "message": "ردك هنا"
}`;

// ── حالات الطلبات بالعربية ──────────────────────────────────────
const STATUS_MAP = {
  'قيد الانتظار': 'pending', 'انتظار': 'pending',
  'جارٍ التنفيذ': 'in_progress', 'قيد التنفيذ': 'in_progress', 'جاري': 'in_progress',
  'جاهز': 'ready', 'اكتمل': 'ready',
  'مكتمل': 'completed', 'تم': 'completed',
  'ملغى': 'cancelled', 'الغاء': 'cancelled', 'إلغاء': 'cancelled',
};

// ── Command Executor ────────────────────────────────────────────
async function executeCommand(command, queryClient, navigate) {
  const { action } = command;

  switch (action) {
    case 'UPDATE_ORDER_STATUS': {
      const orders = await base44.entities.Order.list('-created_at', 200);
      const order = orders.find(o => 
        o.id === command.orderId || 
        o.order_number === command.orderId ||
        o.customer_name?.includes(command.orderId)
      );
      if (!order) return { success: false, message: `لم أجد الطلب: ${command.orderId}` };
      await base44.entities.Order.update(order.id, { status: command.status });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      return { success: true, message: `✅ تم تحديث حالة طلب ${order.order_number || order.id} إلى "${command.status}" بنجاح` };
    }

    case 'CREATE_ORDER': {
      const session = getSession();
      const newOrder = {
        customer_name: command.customerName,
        customer_phone: command.customerPhone,
        item_type: command.itemType || 'other',
        description: command.description,
        status: 'pending',
        employee_id: session?.id,
        employee_name: session?.name,
        branch_id: session?.branch_id,
        branch_name: session?.branch_name,
        created_at: new Date().toISOString(),
      };
      const created = await base44.entities.Order.create(newOrder);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      return { success: true, message: `✅ تم إنشاء الطلب للعميل ${command.customerName} بنجاح` };
    }

    case 'SEARCH_ORDERS': {
      const orders = await base44.entities.Order.list('-created_at', 200);
      const q = command.query?.toLowerCase();
      const results = orders.filter(o =>
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_phone?.includes(q) ||
        o.order_number?.includes(q)
      ).slice(0, 5);
      if (!results.length) return { success: true, message: `لم أجد طلبات تطابق "${command.query}"` };
      const list = results.map(o => `• ${o.order_number || o.id} — ${o.customer_name} — ${o.status}`).join('\n');
      return { success: true, message: `وجدت ${results.length} طلب:\n${list}` };
    }

    case 'GET_STATS': {
      const orders = await base44.entities.Order.list('-created_at', 200);
      const stats = orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {});
      return {
        success: true,
        message: `📊 إحصائيات الطلبات:\n• إجمالي: ${orders.length}\n• قيد الانتظار: ${stats.pending || 0}\n• جارٍ التنفيذ: ${stats.in_progress || 0}\n• جاهز: ${stats.ready || 0}\n• مكتمل: ${stats.completed || 0}\n• ملغى: ${stats.cancelled || 0}`
      };
    }

    case 'NAVIGATE': {
      navigate(command.path);
      return { success: true, message: `🧭 تم الانتقال إلى ${command.path}` };
    }

    case 'UPDATE_BOOKING_STATUS': {
      await base44.entities.Booking.update(command.bookingId, { status: command.status });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      return { success: true, message: `✅ تم تحديث حالة الحجز بنجاح` };
    }

    default:
      return { success: false, message: `أمر غير معروف: ${action}` };
  }
}

// ── Main Component ───────────────────────────────────────────────
export default function GeminiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'مرحباً! أنا مساعدك الذكي. يمكنني مساعدتك في إدارة الطلبات، البحث، وتنفيذ الأوامر. تحدث معي أو اكتب طلبك 👋', timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pendingCommand, setPendingCommand] = useState(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Check voice support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SpeechRecognition);
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 200);
  }, [isOpen]);

  // ── Voice Recognition ─────────────────────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('');
      setInput(transcript);
      if (event.results[0].isFinal) {
        setTimeout(() => handleSend(transcript), 300);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // ── Text to Speech ────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!speechEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    utterance.rate = 1.1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [speechEnabled]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  // ── Call Gemini ───────────────────────────────────────────────
  const callGemini = async (userMessage) => {
    if (!GEMINI_API_KEY) {
      return { message: '⚠️ مفتاح Gemini API غير مُعيّن. أضف VITE_GEMINI_API_KEY في ملف .env' };
    }

    const history = messages
      .filter(m => m.role !== 'system')
      .slice(-10)
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    const payload = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        ...history,
        { role: 'user', parts: [{ text: userMessage }] }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      }
    };

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData?.error?.message || errData?.message || `HTTP ${res.status}`;
      if (res.status === 400) throw new Error(`مفتاح API غير صالح أو طلب خاطئ: ${msg}`);
      if (res.status === 429) throw new Error('تجاوزت حد الطلبات، انتظر دقيقة وحاول مجدداً');
      if (res.status === 403) throw new Error('مفتاح VITE_GEMINI_API_KEY غير مفعّل، تحقق من Google AI Studio');
      throw new Error(`خطأ Gemini: ${msg}`);
    }
    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Try to parse JSON response
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {}

    return { message: rawText };
  };

  // ── Handle Send ───────────────────────────────────────────────
  const handleSend = useCallback(async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || isLoading) return;

    setInput('');
    const userMsg = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await callGemini(text);
      const assistantMsg = {
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        command: response.command,
        requiresConfirmation: response.requiresConfirmation,
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (response.command) {
        if (!response.requiresConfirmation) {
          // Execute immediately
          const result = await executeCommand(response.command, queryClient, navigate);
          setMessages(prev => [...prev, {
            role: 'system-result',
            content: result.message,
            success: result.success,
            timestamp: new Date()
          }]);
          if (speechEnabled) speak(result.message.replace(/[✅❌📊🧭•]/g, ''));
        } else {
          // Queue for confirmation
          setPendingCommand({ command: response.command, label: response.message });
          if (speechEnabled) speak(response.message + ' — هل تريد التأكيد؟');
        }
      } else {
        if (speechEnabled) speak(response.message);
      }
    } catch (err) {
      const errMsg = { role: 'assistant', content: `حدث خطأ: ${err.message}`, timestamp: new Date(), isError: true };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, queryClient, navigate, speechEnabled, speak]);

  // ── Confirm Command ───────────────────────────────────────────
  const handleConfirm = async () => {
    if (!pendingCommand) return;
    setIsLoading(true);
    try {
      const result = await executeCommand(pendingCommand.command, queryClient, navigate);
      setMessages(prev => [...prev, {
        role: 'system-result',
        content: result.message,
        success: result.success,
        timestamp: new Date()
      }]);
      if (speechEnabled) speak(result.message.replace(/[✅❌📊🧭•]/g, ''));
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'system-result',
        content: `فشل التنفيذ: ${err.message}`,
        success: false,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
      setPendingCommand(null);
    }
  };

  const handleReject = () => {
    setPendingCommand(null);
    setMessages(prev => [...prev, {
      role: 'system-result',
      content: '↩️ تم إلغاء الأمر',
      success: null,
      timestamp: new Date()
    }]);
  };

  const clearMessages = () => {
    setMessages([{ role: 'assistant', content: 'تمت إعادة المحادثة. كيف يمكنني مساعدتك؟', timestamp: new Date() }]);
    setPendingCommand(null);
  };

  // ── Key handler ───────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #4285f4, #8b5cf6)' }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        animate={isOpen ? { opacity: 0, scale: 0.8, pointerEvents: 'none' } : { opacity: 1, scale: 1 }}
        title="المساعد الذكي"
      >
        <Sparkles className="w-6 h-6 text-white" />
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ background: '#4285f4' }} />
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 left-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            style={{ height: '560px', background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 shrink-0"
              style={{ background: 'linear-gradient(135deg, #4285f4, #8b5cf6)' }}>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-white">المساعد الذكي</div>
                <div className="text-xs text-white/70">مدعوم بـ Gemini AI</div>
              </div>
              <div className="flex items-center gap-1">
                {/* Speech toggle */}
                <button onClick={isSpeaking ? stopSpeaking : () => setSpeechEnabled(v => !v)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title={speechEnabled ? 'إيقاف الصوت' : 'تشغيل الصوت'}>
                  {speechEnabled ? <Volume2 className="w-4 h-4 text-white" /> : <VolumeX className="w-4 h-4 text-white/50" />}
                </button>
                {/* Clear */}
                <button onClick={clearMessages} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="مسح المحادثة">
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
                {/* Close */}
                <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" dir="rtl"
              style={{ background: '#f8fafc' }}>
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  {msg.role !== 'system-result' && (
                    <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs
                      ${msg.role === 'user' 
                        ? 'bg-gray-200' 
                        : 'bg-gradient-to-br from-blue-500 to-purple-600'}`}>
                      {msg.role === 'user' 
                        ? <User className="w-3.5 h-3.5 text-gray-600" />
                        : <Bot className="w-3.5 h-3.5 text-white" />}
                    </div>
                  )}
                  {/* Bubble */}
                  <div className={`max-w-[85%] ${msg.role === 'system-result' ? 'mx-auto w-full max-w-full' : ''}`}>
                    <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                      ${msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-sm'
                        : msg.role === 'system-result'
                          ? msg.success === true
                            ? 'bg-green-50 border border-green-200 text-green-800 text-center rounded-xl text-xs'
                            : msg.success === false
                              ? 'bg-red-50 border border-red-200 text-red-800 text-center rounded-xl text-xs'
                              : 'bg-gray-100 text-gray-500 text-center rounded-xl text-xs'
                          : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
                      }`}>
                      {msg.content}
                    </div>
                    <div className={`text-[10px] text-gray-400 mt-0.5 ${msg.role === 'user' ? 'text-left' : 'text-right'}`}>
                      {msg.timestamp?.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading */}
              {isLoading && (
                <div className="flex gap-2 flex-row">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1 items-center">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmation dialog */}
              {pendingCommand && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm"
                  dir="rtl">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-semibold text-amber-800">تأكيد التنفيذ</span>
                  </div>
                  <p className="text-amber-700 text-xs mb-3">هل أنت متأكد من تنفيذ هذا الأمر؟</p>
                  <div className="flex gap-2">
                    <button onClick={handleConfirm}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700 transition-colors flex items-center justify-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />نعم، نفّذ
                    </button>
                    <button onClick={handleReject}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center justify-center gap-1">
                      <X className="w-3.5 h-3.5" />إلغاء
                    </button>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions */}
            <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto shrink-0 border-t border-gray-100" dir="rtl">
              {['الإحصائيات', 'الطلبات المعلقة', 'انتقل للعملاء', 'أنشئ طلب جديد'].map(s => (
                <button key={s} onClick={() => { setInput(s); handleSend(s); }}
                  className="shrink-0 px-2.5 py-1 rounded-full text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 transition-colors whitespace-nowrap">
                  {s}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="px-3 py-2.5 border-t border-gray-100 bg-white shrink-0">
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus-within:border-blue-300 transition-colors">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isListening ? '🎙️ جارٍ الاستماع...' : 'اكتب أو تحدث...'}
                  dir="rtl"
                  className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder-gray-400 min-w-0"
                  disabled={isLoading || isListening}
                />

                {/* Mic button */}
                {voiceSupported && (
                  <button
                    onClick={isListening ? stopListening : startListening}
                    className={`p-1.5 rounded-lg transition-all ${
                      isListening 
                        ? 'bg-red-100 text-red-600 animate-pulse' 
                        : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                    title={isListening ? 'إيقاف التسجيل' : 'تسجيل صوتي'}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                )}

                {/* Send button */}
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="p-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                >
                  {isLoading 
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                </button>
              </div>

              {isSpeaking && (
                <div className="mt-1 flex items-center gap-1.5 justify-center">
                  <Volume2 className="w-3 h-3 text-purple-500 animate-pulse" />
                  <span className="text-[10px] text-purple-500">جارٍ النطق...</span>
                  <button onClick={stopSpeaking} className="text-[10px] text-gray-400 hover:text-red-500 underline">إيقاف</button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
