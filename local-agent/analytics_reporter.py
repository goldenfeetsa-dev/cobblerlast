"""تسجيل المحادثات والمكالمات في SQLite + استخراج بيانات العملية + التقرير اليومي."""
import json, os, re, sqlite3, time, datetime as dt
import httpx
from dotenv import load_dotenv

load_dotenv()
DB = os.path.join(os.path.dirname(__file__), "interactions.db")
SERVICES = ["صباغة", "سحاب", "YKK", "تنظيف", "خياطة", "تجديد"]


def _conn():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    with _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS interactions(
            id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, channel TEXT, phone TEXT,
            user_text TEXT, reply TEXT, service TEXT, order_number TEXT, urgent INTEGER DEFAULT 0,
            tools TEXT)""")


def extract(user_text: str, reply: str):
    blob = f"{user_text} {reply}"
    service = next((s for s in SERVICES if s.lower() in blob.lower()), None)
    m = re.search(r"ORD-?\d+", blob, re.I)
    urgent = int(bool(re.search(r"مستعجل|ضروري|اليوم|زعلان|شكوى|متأخر|تأخر", user_text)))
    return service, (m.group(0).upper() if m else None), urgent


def log(channel, phone, user_text, reply, tools_used=None):
    service, order, urgent = extract(user_text, reply)
    with _conn() as c:
        c.execute("INSERT INTO interactions(ts,channel,phone,user_text,reply,service,order_number,urgent,tools) VALUES(?,?,?,?,?,?,?,?,?)",
                  (int(time.time()), channel, phone, user_text, reply, service, order, urgent, json.dumps(tools_used or [], ensure_ascii=False)))


def daily_report(day: dt.date | None = None) -> str:
    day = day or dt.date.today()
    start = int(dt.datetime.combine(day, dt.time.min).timestamp())
    end = start + 86400
    with _conn() as c:
        rows = c.execute("SELECT * FROM interactions WHERE ts>=? AND ts<?", (start, end)).fetchall()
    calls = sum(r["channel"] == "voice" for r in rows)
    chats = len(rows) - calls
    ready = sorted({r["order_number"] for r in rows if r["order_number"] and "notify_customer_ready" in (r["tools"] or "")})
    by_service = {}
    for r in rows:
        if r["service"]:
            by_service[r["service"]] = by_service.get(r["service"], 0) + 1
    urgent = [r for r in rows if r["urgent"]]
    lines = [f"📊 تقرير إبرة وخيط — {day.isoformat()}",
             f"• الاستفسارات: {len(rows)} (واتساب {chats} / مكالمات {calls})",
             f"• طلبات أُبلغ العميل بجاهزيتها: {len(ready)} {('— ' + '، '.join(ready)) if ready else ''}"]
    if by_service:
        lines.append("• الخدمات المطلوبة: " + "، ".join(f"{k} ({v})" for k, v in by_service.items()))
    if urgent:
        lines.append("⚠️ ملاحظات عاجلة:")
        for r in urgent[:10]:
            lines.append(f"  - {r['phone']}: {r['user_text'][:90]}")
    else:
        lines.append("✅ لا توجد ملاحظات عاجلة")
    return "\n".join(lines)


def send_report_to_owner():
    text = daily_report()
    print(text)
    owner = os.getenv("OWNER_PHONE")
    if not owner:
        return
    try:
        httpx.post(os.getenv("WHATSAPP_URL", "http://localhost:3001") + "/send",
                   headers={"x-token": os.getenv("BOT_TOKEN", "")}, json={"phone": owner, "text": text}, timeout=15)
    except Exception as e:
        print("تعذّر إرسال التقرير:", e)


if __name__ == "__main__":
    init_db()
    send_report_to_owner()
