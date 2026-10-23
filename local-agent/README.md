# وكيل إبرة وخيط المحلي (Qwen2.5 + Whisper + Piper + واتساب)

## المتطلبات
- جهاز يبقى شغّالاً (كمبيوتر/ميني PC). Qwen 7B يحتاج ~8GB رام على الأقل (ويفضّل كرت شاشة NVIDIA).
- Python 3.10+، Node 18+، ffmpeg، Ollama.

## الخطوات بالترتيب
1. تثبيت Ollama من ollama.com ثم: `ollama pull qwen2.5:7b-instruct`
2. `pip install -r requirements.txt`  (ويحتاج ffmpeg: `winget install ffmpeg` أو `apt install ffmpeg`)
3. Piper: نزّل الملف التنفيذي من github.com/rhasspy/piper/releases، وضع الصوت العربي (`ar_JO-kareem-medium.onnx` و`.json`) في مجلد `voices/`. (لا يوجد صوت سعودي في Piper؛ الأقرب أردني.)
4. `cp .env.example .env` واملأه (SUPABASE_SERVICE_KEY من لوحة Supabase، ورقم المالك، وBOT_TOKEN نص عشوائي طويل).
5. شغّل الوكيل:  `uvicorn llm_agent:app --host 127.0.0.1 --port 8000`
6. في نافذة ثانية: `npm install` ثم `BOT_TOKEN=... node whatsapp_bot.js` ← يظهر QR، امسحه من واتساب (الأجهزة المرتبطة). يفضّل رقم مخصص للورشة.
7. جرّب: أرسل من رقم آخر «وين طلبي ORD-01002؟».
8. المكالمات: `curl -F audio=@call.wav -F phone=966500000000 -H "x-token: TOKEN" localhost:8000/voice -o reply.wav`
9. التقرير يُرسل تلقائياً للمالك كل يوم الساعة 21:00، ويدوياً: `python analytics_reporter.py`

## تنبيهات مهمة
- Baileys غير رسمي: قد يُحظر الرقم. لا ترسل رسائل جماعية، واستخدم رقماً غير رقمك الأساسي.
- المكالمات الحقيقية على واتساب/الجوال غير مدعومة؛ الوحدة تستقبل ملفات صوتية (رسائل صوتية أو تسجيل مكالمة عبر نظام اتصال).
- مفتاح service_role يبقى في `.env` على جهازك فقط.
