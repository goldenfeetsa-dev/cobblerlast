"""عقل الوكيل: Qwen2.5 عبر Ollama + استدعاء الدوال + خدمة FastAPI.
التشغيل:  uvicorn llm_agent:app --host 0.0.0.0 --port 8000
"""
import json, os
import httpx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
import analytics_reporter as ar

load_dotenv()
client = OpenAI(base_url=os.getenv("OLLAMA_URL", "http://localhost:11434/v1"), api_key="ollama")
MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct")
SB_URL, SB_KEY = os.getenv("SUPABASE_URL", ""), os.getenv("SUPABASE_SERVICE_KEY", "")
WA_URL, TOKEN = os.getenv("WHATSAPP_URL", "http://localhost:3001"), os.getenv("BOT_TOKEN", "")
PRICES = json.load(open(os.path.join(os.path.dirname(__file__), "prices.json"), encoding="utf-8"))

STATUS_AR = {"pending": "مستلم وبانتظار البدء", "in_progress": "قيد التنفيذ", "ready": "جاهز للتسليم",
             "completed": "تم التسليم", "cancelled": "ملغي"}

SYSTEM = """أنت مساعد "إبرة وخيط الإسكافي"، ورشة فاخرة في الرياض لصيانة وتجديد الأحذية والشنط والجلديات.
تتكلم بلهجة سعودية بيضاء مهذبة ومختصرة (جملتين أو ثلاث). تعرف: صباغة الجلد، تغيير سحاب YKK، تنظيف الجلود، الخياطة،
تبديل النعال والكعوب، ترقيع، تلميع، وتجديد الشنط الفاخرة.
قواعد صارمة: لا تخترع حالة طلب ولا سعراً؛ استعمل الدوال. السعر من calculate_repair_cost تقدير فقط والتسعير النهائي بعد الفحص.
لا تطلب بيانات حساسة. إذا الطلب شكوى أو خارج صلاحيتك قل إن المسؤول سيتواصل معه.
عند سؤال العميل عن طلبه اطلب رقم الطلب (مثل ORD-01002) إن لم يذكره."""

TOOLS = [
    {"type": "function", "function": {"name": "get_order_status", "description": "حالة طلب العميل برقم الطلب",
     "parameters": {"type": "object", "properties": {"order_id": {"type": "string"}}, "required": ["order_id"]}}},
    {"type": "function", "function": {"name": "calculate_repair_cost", "description": "تقدير تكلفة خدمة لنوع قطعة",
     "parameters": {"type": "object", "properties": {"service_type": {"type": "string", "description": "صباغة | تغيير سحاب YKK | تنظيف جلود | خياطة"},
                                                   "item_type": {"type": "string", "description": "حذاء | شنطة | حزام | جاكيت"}}, "required": ["service_type", "item_type"]}}},
    {"type": "function", "function": {"name": "notify_customer_ready", "description": "إرسال واتساب للعميل بجاهزية طلبه",
     "parameters": {"type": "object", "properties": {"phone": {"type": "string"}, "order_id": {"type": "string"}}, "required": ["phone", "order_id"]}}},
]


def get_order_status(order_id: str):
    num = "".join(ch for ch in order_id.upper() if ch.isalnum() or ch == "-")[:20]
    if not SB_URL or not SB_KEY:
        return {"error": "قاعدة الطلبات غير مربوطة"}
    r = httpx.get(f"{SB_URL}/rest/v1/orders", params={"order_number": f"eq.{num}", "select": "order_number,status,item_type,customer_name,created_at", "limit": 1},
                  headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"}, timeout=15)
    rows = r.json() if r.status_code == 200 else []
    if not rows:
        return {"found": False, "message": f"ما لقيت طلب برقم {num}"}
    o = rows[0]
    return {"found": True, "order_number": o["order_number"], "status": STATUS_AR.get(o["status"], o["status"]), "item": o.get("item_type")}


def calculate_repair_cost(service_type: str, item_type: str):
    svc = next((k for k in PRICES if k != "ملاحظة" and (k in service_type or service_type in k)), None)
    if not svc:
        return {"known": False, "message": "خدمة غير معروفة، المسؤول يحدد السعر بعد الفحص"}
    item = next((k for k in PRICES[svc] if k in item_type or item_type in k), None)
    if not item:
        return {"known": False, "message": "النوع غير مسعّر، يحدد بعد الفحص"}
    lo, hi = PRICES[svc][item]
    return {"known": True, "service": svc, "item": item, "estimate_sar": f"{lo} - {hi}", "note": "تقدير والسعر النهائي بعد الفحص"}


def notify_customer_ready(phone: str, order_id: str):
    text = f"هلا فيك 🌟 طلبك رقم {order_id} جاهز للتسليم في إبرة وخيط الإسكافي. ننتظرك!"
    try:
        r = httpx.post(f"{WA_URL}/send", headers={"x-token": TOKEN}, json={"phone": phone, "text": text}, timeout=15)
        return {"sent": r.status_code == 200}
    except Exception as e:
        return {"sent": False, "error": str(e)[:80]}


IMPL = {"get_order_status": get_order_status, "calculate_repair_cost": calculate_repair_cost, "notify_customer_ready": notify_customer_ready}
HISTORY: dict[str, list] = {}


def run_agent(phone: str, text: str, channel: str = "whatsapp") -> str:
    hist = HISTORY.setdefault(phone, [])
    messages = [{"role": "system", "content": SYSTEM}] + hist[-8:] + [{"role": "user", "content": text}]
    used = []
    reply = "ما قدرت أرد الحين، جرّب بعد شوي."
    for _ in range(4):
        r = client.chat.completions.create(model=MODEL, messages=messages, tools=TOOLS, temperature=0.4)
        msg = r.choices[0].message
        if not msg.tool_calls:
            reply = (msg.content or "").strip() or reply
            break
        messages.append(msg)
        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
                out = IMPL[name](**args) if name in IMPL else {"error": "unknown_tool"}
            except Exception as e:
                out = {"error": str(e)[:80]}
            used.append(name)
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(out, ensure_ascii=False)})
    hist += [{"role": "user", "content": text}, {"role": "assistant", "content": reply}]
    ar.log(channel, phone, text, reply, used)
    return reply


app = FastAPI(title="Ibra Local Agent")
ar.init_db()


class Chat(BaseModel):
    phone: str
    text: str


def auth(x_token: str | None):
    if TOKEN and x_token != TOKEN:
        raise HTTPException(401, "bad token")


@app.post("/chat")
def chat(body: Chat, x_token: str | None = Header(default=None)):
    auth(x_token)
    return {"reply": run_agent(body.phone, body.text[:1000])}


@app.get("/report")
def report(x_token: str | None = Header(default=None)):
    auth(x_token)
    return {"report": ar.daily_report()}


import voice_handler  # noqa: E402  (يسجّل مسار /voice)
app.include_router(voice_handler.router)

from apscheduler.schedulers.background import BackgroundScheduler  # noqa: E402
sched = BackgroundScheduler(timezone="Asia/Riyadh")
sched.add_job(ar.send_report_to_owner, "cron", hour=int(os.getenv("REPORT_HOUR", "21")), minute=0)
sched.start()
