import io
import uuid
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
ORIGINALS_DIR = UPLOAD_DIR / "originals"
THUMBS_DIR = UPLOAD_DIR / "thumbnails"

ORIGINALS_DIR.mkdir(parents=True, exist_ok=True)
THUMBS_DIR.mkdir(parents=True, exist_ok=True)

MAX_SIZE_BYTES = 5 * 1024 * 1024        
ALLOWED_MIME = {"image/png", "image/jpeg"}
ALLOWED_PIL_FORMATS = {"PNG", "JPEG"}
THUMB_SIZE = (300, 300)                  


app = FastAPI(title="Image Upload API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.mount("/static", StaticFiles(directory=UPLOAD_DIR), name="static")


def _build_url(request: Request, rel_path: str) -> str:
    """Собирает полный URL вида http://host:port/static/..."""
    return str(request.base_url).rstrip("/") + f"/static/{rel_path}"


@app.post("/upload")
async def upload_image(request: Request, file: UploadFile = File(...)):

    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимый тип файла: {file.content_type}. "
                   f"Разрешены только image/png и image/jpeg.",
        )


    data = await file.read()
    if len(data) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Файл слишком большой: {len(data) / 1024 / 1024:.2f} МБ. "
                   f"Максимум — 5 МБ.",
        )
    if not data:
        raise HTTPException(status_code=400, detail="Пустой файл.")

  
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()                           
        img = Image.open(io.BytesIO(data))     
    except (UnidentifiedImageError, Exception):
        raise HTTPException(
            status_code=400,
            detail="Файл не является корректным изображением.",
        )

    if img.format not in ALLOWED_PIL_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Формат {img.format} не поддерживается. Разрешены PNG и JPEG.",
        )

    ext = "png" if img.format == "PNG" else "jpg"
    uid = uuid.uuid4().hex
    original_name = f"{uid}.{ext}"
    original_path = ORIGINALS_DIR / original_name

  
    if ext == "jpg" and img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    img.save(original_path, format=img.format)


    thumb_name = f"{uid}_thumb.{ext}"
    thumb_path = THUMBS_DIR / thumb_name

    thumb = img.copy()
    thumb.thumbnail(THUMB_SIZE, Image.LANCZOS)   
    thumb.save(thumb_path, format=img.format)


    return {
        "id": uid,
        "original_url": _build_url(request, f"originals/{original_name}"),
        "thumbnail_url": _build_url(request, f"thumbnails/{thumb_name}"),
        "width": img.width,
        "height": img.height,
        "thumb_width": thumb.width,
        "thumb_height": thumb.height,
        "size_bytes": len(data),
    }


@app.get("/health")
def health():
    return {"status": "ok"}