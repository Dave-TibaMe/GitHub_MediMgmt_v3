# app/services/germini_service.py

import requests
from configparser import ConfigParser
import base64
import json
from datetime import date
from typing import Dict, Any
import logging

# --- 設定 ---
# 建議將日誌記錄器放在檔案頂部
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 讀取設定檔
config = ConfigParser()
try:
    config.read('./app/config/config.ini')
    API_KEY = config.get('GEMINI', 'api_key')
    TEXT_URL = config.get('GEMINI', 'text_url')
    VISION_URL = config.get('GEMINI', 'vision_url')
except Exception as e:
    logger.error(f"讀取 config.ini 設定檔失敗: {e}")
    API_KEY, TEXT_URL, VISION_URL = None, None, None

# --- Prompt 生成函式 ---
def create_prescription_prompt(user_timezone: str, current_date: str) -> str:
    """
    生成用於藥單辨識的、詳細的 Gemini 提示詞。
    【已修正】使用 {{ 和 }} 來轉義 JSON 範例中的大括號，以避免 f-string 格式錯誤。
    """
    return f"""
    你是一位專業且細心的智慧藥劑師助理。你的任務是分析使用者上傳的處方箋或藥袋圖片，並以純粹的 JSON 格式回傳結構化的藥物資訊。

    # 任務要求：
    1.  **辨識所有藥物**：從圖片中找出所有獨立的藥物項目。
    2.  **提取關鍵資訊**：對於每一種藥物，提取以下資訊：
        - `name` (藥物名稱): 完整的藥物商品名或學名。
        - `dose` (劑量): 每次服用的劑量，例如 "1顆" 或 "10mg"。
        - `frequency` (服藥頻率): 服用的頻率。請將常見的醫療縮寫轉換為使用者易於理解的中文，對照如下：
            - QD (每日一次) -> "每日一次"
            - BID (每日兩次) -> "每日二次"
            - TID (每日三次) -> "每日三次"
            - QID (每日四次) -> "每日四次"
            - QOD (每隔一日) -> "每隔一日"
            - HS (睡前) -> "睡前"
            - PC (飯後) -> 在頻率後補充 "(飯後)"
            - AC (飯前) -> 在頻率後補充 "(飯前)"
    3.  **補充關聯資訊 (AI 推斷)**：
        - `effect` (藥物作用): 根據藥物名稱，從你的知識庫中找出最主要、最常見的作用。內容需簡潔有力，長度約 3-7 個字，例如 "降血壓"、"抗生素"、"止痛藥"。
        - `remind_times` (建議提醒時間): 根據 `frequency` (服藥頻率) 和常規作息，推斷出建議的提醒時間。格式必須是 JSON 物件陣列 `[{{\"hour\": H, \"minute\": M}}]`。範例如下：
            - "每日一次": `[{{\"hour\": 9, \"minute\": 0}}]`
            - "每日二次": `[{{\"hour\": 9, \"minute\": 0}}, {{\"hour\": 21, \"minute\": 0}}]`
            - "每日三次": `[{{\"hour\": 9, \"minute\": 0}}, {{\"hour\": 14, \"minute\": 0}}, {{\"hour\": 19, \"minute\": 0}}]`
            - "睡前": `[{{\"hour\": 22, \"minute\": 0}}]`
        - `start_date` (開始日期): 預設為今天的日期: `{current_date}`。
        - `end_date` (結束日期): 如果圖片中有明確的「天數」或「總量/用法」可推算出結束日期，請計算並填入。如果無法推算，則留空字串 `""`。

    # 輸出格式限制 (極度重要)：
    - **必須回傳純粹的 JSON 物件**，不要包含任何 `json` 標籤、註解或任何非 JSON 的文字。
    - JSON 的根物件必須包含一個名為 `medications` 的鍵，其值為一個陣列 (array)。
    - 陣列中的每個元素都是一個代表單一藥物的物件，包含 `name`, `effect`, `dose`, `frequency`, `remind_times`, `start_date`, `end_date` 這些鍵。
    - 如果圖片中沒有辨識到任何藥物，或圖片無關，請回傳 `{{\"medications\": []}}`。
    - 如果某個欄位的資訊在圖片上不存在或無法辨識，請在 JSON 中使用空字串 `""` (對於字串類型) 或空陣列 `[]` (對於 `remind_times`) 作為其值。

    # 使用者資訊：
    - 使用者目前時區: `{user_timezone}`
    - 今天日期: `{current_date}`
    """

# --- Gemini API 呼叫函式 ---
def call_gemini_text(prompt: str) -> Dict[str, Any]:
    """呼叫 Gemini Text API (例如 gemini-1.5-flash)"""
    if not API_KEY or not TEXT_URL:
        raise ValueError("Gemini API 金鑰或文字 API URL 未設定。")
    
    headers = {"Content-Type": "application/json", "X-Goog-Api-Key": API_KEY}
    body = {"contents": [{"parts": [{"text": prompt}]}]}
    
    try:
        r = requests.post(TEXT_URL, headers=headers, json=body, timeout=60)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"呼叫 Gemini Text API 時發生網路錯誤: {e}")
        raise

def call_gemini_vision(image_bytes: bytes, user_timezone: str) -> Dict[str, Any]:
    """
    呼叫 Gemini Vision API (例如 gemini-1.5-flash) 進行藥單辨識。
    此函式會自動生成詳細的 Prompt。
    """
    if not API_KEY or not VISION_URL:
        raise ValueError("Gemini API 金鑰或視覺 API URL 未設定。")

    # 1. 準備 Prompt 所需的動態資料
    current_date_str = date.today().isoformat()

    # 2. 生成詳細的 Prompt
    prompt_text = create_prescription_prompt(user_timezone, current_date_str)

    # 3. 準備 API 請求內容
    headers = {"Content-Type": "application/json", "X-Goog-Api-Key": API_KEY}
    img_base64 = base64.b64encode(image_bytes).decode("utf-8")
    
    body = {
        "contents": [{
            "parts": [
                {"text": prompt_text},
                {"inline_data": {
                    "mime_type": "image/jpeg",
                    "data": img_base64
                }}
            ]
        }],
        "generationConfig": {
            "response_mime_type": "application/json"
        }
    }
    
    try:
        logger.info("正在向 Gemini Vision API 發送請求...")
        r = requests.post(VISION_URL, headers=headers, json=body, timeout=120)
        r.raise_for_status() # 如果 API 回傳錯誤 (如 4xx, 5xx)，會在此拋出異常
        
        # 【核心修正】
        # 因為我們設定了 response_mime_type: "application/json",
        # API 會直接回傳解析好的 JSON 物件 (也就是一個 Python dict)，
        # 不再需要從 'candidates' 結構中提取文字再用 json.loads() 解析。
        # r.json() 的結果就是我們最終想要的字典。
        response_data = r.json()
        logger.info(f"成功從 Gemini 收到已解析的 JSON 回應。")
        
        # 增加一個檢查，確保回傳的資料是字典格式
        if not isinstance(response_data, dict):
            logger.error(f"Gemini 回傳的 JSON 不是物件 (dict)，而是 {type(response_data)}。原始回應: {response_data}")
            raise ValueError("AI 服務回傳的資料格式不符預期 (非物件)。")

        return response_data

    except requests.exceptions.RequestException as e:
        logger.error(f"呼叫 Gemini Vision API 時發生網路錯誤: {e}")
        if e.response is not None:
            logger.error(f"Gemini API 錯誤回應 (狀態碼 {e.response.status_code}): {e.response.text}")
        raise ValueError("AI 辨識服務網路連線失敗。")
        
    except json.JSONDecodeError as e:
        # 這個錯誤可能在 API 回傳非 JSON 格式的錯誤訊息時發生
        logger.error(f"解析 Gemini 回應的 JSON 時失敗: {e}")
        logger.error(f"收到的原始文字內容: {r.text}")
        raise ValueError("Gemini 回傳的內容不是有效的 JSON 格式。")

    except Exception as e:
        # 捕獲其他所有可能的意外錯誤
        logger.error(f"處理 Gemini 回應時發生未預期錯誤: {e}", exc_info=True)
        # 重新拋出原始錯誤，讓上層可以捕捉到更詳細的資訊
        raise

