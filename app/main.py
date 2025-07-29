# main.py (修改後，加入請求日誌中介軟體)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from configparser import ConfigParser
import logging  # --- (新增) --- 匯入 logging 模組
import json     # --- (新增) --- 匯入 json 模組

# 匯入您的 API 路由模組和資料庫初始化函式
from app.api import medication, prescription, alert, user, reminder, terms
from app.db.database import init_db

# --- 1. 設定與初始化 ---

# --- (新增) --- 設定日誌，確保訊息能被看見
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
    version="1.0.3" # 版本號更新
)

# --- 2. 中介軟體 (Middleware) ---

# 您的 CORS 中介軟體 (維持原樣)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ▼▼▼▼▼ 主要修改區域 ▼▼▼▼▼

# --- (新增) --- 加入中介軟體，用來記錄所有請求的內文
@app.middleware("http")
async def log_request_body(request: Request, call_next):
    """
    這個中介軟體會攔截所有進來的請求，
    並在 uvicorn 終端機印出其內文 (body)，
    讓我們能看到前端到底傳了什麼資料過來，特別是針對 POST/PUT 請求。
    """
    # 為了能重複讀取 request body，需要先將它讀取出來
    body_bytes = await request.body()
    
    # 我們只關心造成 422 錯誤的 /api/medications/ 請求
    if request.method == "POST" and str(request.url.path) == "/api/medications/":
        if body_bytes:
            try:
                # 嘗試將 body 解碼為 JSON 並格式化輸出
                body_json = json.loads(body_bytes)
                log_message = json.dumps(body_json, indent=2, ensure_ascii=False)
                logging.info(f"↓↓↓ 收到 /api/medications/ 的請求內文 (Request Body) ↓↓↓\n{log_message}")
            except json.JSONDecodeError:
                # 如果不是 JSON，就直接印出原始文字
                logging.info(f"↓↓↓ 收到 /api/medications/ 的非 JSON 請求內文 ↓↓↓\n{body_bytes.decode(errors='ignore')}")
        else:
            logging.info("↓↓↓ 收到 /api/medications/ 的請求，但請求內文為空 ↓↓↓")

    # 重新建構請求，讓後續的 FastAPI 程式可以正常讀取 body
    # 這是必要的步驟，因為 request.body() 只能被讀取一次
    async def receive():
        return {"type": "http.request", "body": body_bytes}
    
    new_request = Request(request.scope, receive)
    
    # 繼續處理請求
    response = await call_next(new_request)
    return response

# ▲▲▲▲▲ 主要修改區域結束 ▲▲▲▲▲


# --- 3. API 路由註冊 ---
# (您的路由註冊維持原樣)
app.include_router(medication.router, prefix="/api/medications", tags=["藥物 (Medications)"])
app.include_router(prescription.router, prefix="/api/prescription", tags=["處方箋 (Prescription)"])
app.include_router(alert.router, prefix="/api/alert", tags=["用藥提醒 (Alerts)"])
app.include_router(user.router, prefix="/api/user", tags=["使用者 (Users)"])
app.include_router(reminder.router, prefix="/api/reminder", tags=["提醒事項 (Reminders)"])
app.include_router(terms.router, prefix="/api/terms", tags=["服務條款 (Terms)"])


# --- 4. 生命週期事件 ---
# (您的生命週期事件維持原樣)
@app.on_event("startup")
def on_startup():
    """應用程式啟動時，初始化資料庫連線與表格。"""
    init_db()

# --- 5. 靜態檔案與根路徑處理 ---
# (您的靜態檔案設定維持原樣)
app.mount("/liff", StaticFiles(directory="app/liff", html=True), name="liff-app")

@app.get("/", include_in_schema=False)
async def read_root():
    """訪問根目錄時，自動重新導向到 LIFF 應用程式。"""
    return RedirectResponse(url="/liff")
