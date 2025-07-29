# main.py (修正版 - 保留 URL 參數的重定向)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from configparser import ConfigParser
import logging
import json

# 匯入您的 API 路由模組和資料庫初始化函式
from app.api import medication, prescription, alert, user, reminder, terms
from app.db.database import init_db

# --- 1. 設定與初始化 ---

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [MAIN] - %(message)s')

config = ConfigParser()
config.read('app/config/config.ini')

try:
    allowed_origins = config.get('SECURITY', 'allowed_origins').split(',')
except (config.NoSectionError, config.NoOptionError):
    allowed_origins = ["https://liff.line.me"]
    logging.warning("在 config.ini 中找不到 [SECURITY] -> allowed_origins 設定，使用預設值。")

app = FastAPI(
    title="MediMgmt API",
    description="用藥管理系統後端 API",
    version="1.0.4"
)

# --- 2. 中介軟體 (Middleware) ---

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_request_body(request: Request, call_next):
    """記錄請求內文的中介軟體"""
    body_bytes = await request.body()
    
    if request.method == "POST" and str(request.url.path) == "/api/medications/":
        if body_bytes:
            try:
                body_json = json.loads(body_bytes)
                log_message = json.dumps(body_json, indent=2, ensure_ascii=False)
                logging.info(f"↓↓↓ 收到 /api/medications/ 的請求內文 (Request Body) ↓↓↓\n{log_message}")
            except json.JSONDecodeError:
                logging.info(f"↓↓↓ 收到 /api/medications/ 的非 JSON 請求內文 ↓↓↓\n{body_bytes.decode(errors='ignore')}")
        else:
            logging.info("↓↓↓ 收到 /api/medications/ 的請求，但請求內文為空 ↓↓↓")

    async def receive():
        return {"type": "http.request", "body": body_bytes}
    
    new_request = Request(request.scope, receive)
    response = await call_next(new_request)
    return response

# --- 3. API 路由註冊 ---
app.include_router(medication.router, prefix="/api/medications", tags=["藥物 (Medications)"])
app.include_router(prescription.router, prefix="/api/prescription", tags=["處方箋 (Prescription)"])
app.include_router(alert.router, prefix="/api/alert", tags=["用藥提醒 (Alerts)"])
app.include_router(user.router, prefix="/api/user", tags=["使用者 (Users)"])
app.include_router(reminder.router, prefix="/api/reminder", tags=["提醒事項 (Reminders)"])
app.include_router(terms.router, prefix="/api/terms", tags=["服務條款 (Terms)"])

# --- 4. 生命週期事件 ---
@app.on_event("startup")
def on_startup():
    """應用程式啟動時，初始化資料庫連線與表格。"""
    init_db()

# --- 5. 靜態檔案與根路徑處理 ---
app.mount("/liff", StaticFiles(directory="app/liff", html=True), name="liff-app")

# ▼▼▼▼▼ 主要修正區域 ▼▼▼▼▼

@app.get("/", include_in_schema=False)
async def read_root(request: Request):
    """
    訪問根目錄時，保留查詢參數並重新導向到 LIFF 應用程式。
    特別處理 LINE 的 liff.state 參數。
    """
    # 取得完整的查詢字串
    query_string = str(request.url.query)
    
    # 如果有查詢參數，保留它們
    if query_string:
        redirect_url = f"/liff/?{query_string}"
        logging.info(f"根路徑重定向，保留參數：{redirect_url}")
    else:
        redirect_url = "/liff/"
        logging.info("根路徑重定向到預設 LIFF 頁面")
    
    return RedirectResponse(url=redirect_url)

# ▲▲▲▲▲ 主要修正區域結束 ▲▲▲▲▲