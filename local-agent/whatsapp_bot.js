// واتساب عبر Baileys: يستقبل الرسائل ← يمررها للوكيل ← يرد. وفيه /send لإشعارات النظام.
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import express from 'express';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

const AGENT = process.env.AGENT_URL || 'http://localhost:8000';
const TOKEN = process.env.BOT_TOKEN || '';
const PORT = Number(process.env.PORT || 3001);
let sock;

const toJid = (p) => `${String(p).replace(/\D/g, '')}@s.whatsapp.net`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, logger: pino({ level: 'silent' }), browser: ['Ibra', 'Chrome', '1.0'] });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) { console.log('امسح الرمز من واتساب ← الأجهزة المرتبطة:'); qrcode.generate(qr, { small: true }); }
    if (connection === 'open') console.log('✅ واتساب متصل');
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) setTimeout(start, 3000); else console.log('تم تسجيل الخروج؛ احذف مجلد auth وأعد التشغيل.');
    }
  });
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      try {
        if (!m.message || m.key.fromMe || m.key.remoteJid.endsWith('@g.us') || m.key.remoteJid === 'status@broadcast') continue;
        const text = m.message.conversation || m.message.extendedTextMessage?.text;
        if (!text) continue;
        const jid = m.key.remoteJid;
        await sock.sendPresenceUpdate('composing', jid);
        const r = await fetch(`${AGENT}/chat`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-token': TOKEN }, body: JSON.stringify({ phone: jid.split('@')[0], text }) });
        const { reply } = await r.json();
        await sleep(800 + Math.random() * 1200); // تأخير بشري يقلل خطر الحظر
        if (reply) await sock.sendMessage(jid, { text: reply });
      } catch (e) { console.error('msg error', e.message); }
    }
  });
}

const app = express();
app.use(express.json());
app.post('/send', async (req, res) => {
  if (TOKEN && req.get('x-token') !== TOKEN) return res.status(401).json({ error: 'bad token' });
  const { phone, text } = req.body || {};
  if (!phone || !text || !sock) return res.status(400).json({ error: 'bad request or not connected' });
  try { await sock.sendMessage(toJid(phone), { text: String(text).slice(0, 3000) }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.listen(PORT, '127.0.0.1', () => console.log(`bot api on :${PORT}`));
start();
