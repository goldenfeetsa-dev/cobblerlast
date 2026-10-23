"""المكالمات: ملف صوتي ← Whisper ← Qwen ← Piper ← ملف صوتي."""
import os, subprocess, tempfile
from fastapi import APIRouter, UploadFile, File, Form, Header, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

router = APIRouter()
_whisper = None


def whisper_model():
    global _whisper
    if _whisper is None:
        import whisper
        _whisper = whisper.load_model(os.getenv("WHISPER_MODEL", "small"))
    return _whisper


def transcribe(path: str) -> str:
    r = whisper_model().transcribe(path, language="ar", initial_prompt="إبرة وخيط الإسكافي، صباغة، سحاب YKK، شنطة، حذاء، طلب رقم")
    return r["text"].strip()


def synthesize(text: str) -> str:
    out = tempfile.mktemp(suffix=".wav")
    p = subprocess.run([os.getenv("PIPER_BIN", "piper"), "--model", os.getenv("PIPER_VOICE", "./voices/ar_JO-kareem-medium.onnx"), "--output_file", out],
                       input=text.encode("utf-8"), capture_output=True, timeout=60)
    if p.returncode != 0 or not os.path.exists(out):
        raise RuntimeError("piper_failed: " + p.stderr.decode(errors="ignore")[:150])
    return out


@router.post("/voice")
async def voice(audio: UploadFile = File(...), phone: str = Form("call"), x_token: str | None = Header(default=None)):
    from llm_agent import run_agent, TOKEN  # استيراد متأخر لتفادي الدوران
    if TOKEN and x_token != TOKEN:
        raise HTTPException(401, "bad token")
    src = tempfile.mktemp(suffix=os.path.splitext(audio.filename or ".wav")[1] or ".wav")
    with open(src, "wb") as f:
        f.write(await audio.read())
    try:
        heard = transcribe(src)
        if not heard:
            raise HTTPException(422, "لم أسمع كلاماً واضحاً")
        reply = run_agent(phone, heard, channel="voice")
        wav = synthesize(reply)
    finally:
        os.path.exists(src) and os.remove(src)
    return FileResponse(wav, media_type="audio/wav", headers={"x-heard": heard.encode("utf-8").hex()[:400]},
                        background=BackgroundTask(lambda: os.remove(wav)))
