# app/api/prescription.py (已修正)

import json
import re
from fastapi import APIRouter, UploadFile, File, Form, HTTPException # 修改點：匯入 Form
from app.services.germini_service import call_gemini_vision
from datetime import date
import logging
from typing import List, Dict, Any

# 設定日誌，方便追蹤問題
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

def _parse_gemini_response(response: dict) -> List[Dict[str, Any]]:
    """
    解析並清理 Gemini API 的回應，並將其轉換為前端需求的格式。
    此版本針對新的、更詳細的 Prompt 進行了優化。
    """
    try:
        # 提取模型回應的文字內容
        text_content = response['candidates'][0]['content']['parts'][0]['text']
        
        # 尋找被 ```json ... ``` 包裹的區塊，或直接處理純 JSON 字串
        json_match = re.search(r'```json\s*(\{.*?\})\s*```', text_content, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            # 如果沒有 Markdown 標記，直接將整個文字視為 JSON 字串
            json_str = text_content.strip()

        data = json.loads(json_str)

        if "medications" not in data or not isinstance(data["medications"], list):
            logger.warning(f"Gemini 回應中缺少 'medications' 陣列或格式不符。回應: {data}")
            return []

        # --- (新增) 驗證與格式化每個藥物物件 ---
        validated_medications = []
        for med in data["medications"]:
            # 使用 .get() 提供預設值，避免因缺少鍵而崩潰
            validated_med = {
                "name": med.get("name", ""),
                "effect": med.get("effect", ""),
                "dose": med.get("dose", ""),
                "frequency": med.get("frequency", ""),
                "remind_times": med.get("remind_times", []), # 預設為空陣列
                "start_date": med.get("start_date", date.today().isoformat()),
                "end_date": med.get("end_date", ""),
                "status": "進行中" # 提供預設狀態，方便前端使用
            }
            # 基本驗證：至少藥物名稱不能為空
            if validated_med["name"]:
                validated_medications.append(validated_med)
            else:
                logger.warning(f"捨棄一筆無效的藥物紀錄 (缺少名稱): {med}")
        
        logger.info(f"成功解析並驗證了 {len(validated_medications)} 筆藥物紀錄。")
        return validated_medications

    except (KeyError, IndexError) as e:
        logger.error(f"解析 Gemini 回應時發生索引或鍵錯誤: {e}\n原始回應: {response}")
        raise HTTPException(status_code=500, detail="解析藥單辨識結果失敗：回應結構不符預期。")
    except json.JSONDecodeError as e:
        logger.error(f"解析 Gemini 回應時發生 JSON 解碼錯誤: {e}\n無效的 JSON 字串: '{json_str}'")
        raise HTTPException(status_code=500, detail="解析藥單辨識結果失敗：回應的並非有效的 JSON 格式。")
    except Exception as e:
        logger.error(f"解析 Gemini 回應時發生未預期錯誤: {e}")
        raise HTTPException(status_code=500, detail=f"解析藥單辨識結果時發生未知錯誤。")


@router.post("/recognize", summary="上傳並辨識處方箋圖片 (v2)", tags=["處方箋 (Prescription)"])
async def upload_prescription(
    # --- 修改點 1: 將 Header 改為 Form，並使用更簡潔的變數名稱 ---
    file: UploadFile = File(..., description="使用者上傳的藥單圖片檔"),
    user_id: str = Form(..., description="LINE User ID"),
    user_timezone: str = Form("Asia/Taipei", description="用戶端時區，例如 'Asia/Taipei'")
):
    """
    接收使用者上傳的處方箋圖片，呼叫 AI 模型進行辨識，並回傳結構化的藥物資料。

    **功能 (4-1.2 & 4-1.3):**
    - **智慧辨識**: 使用詳細 Prompt 指導 AI 提取藥物名稱、作用、劑量、頻率。
    - **自動補充**: AI 自動推斷建議提醒時間、預設服藥期間。
    - **格式驗證**: 後端對 AI 回傳的 JSON 進行嚴格的格式驗證與清理。
    - **錯誤處理**: 若 AI 服務或解析過程出錯，將回傳具體的錯誤訊息。
    """
    # --- 修改點 2: 增加日誌，確認收到正確的 user_id 和 timezone ---
    logger.info(f"接收到來自 user_id: {user_id} 的辨識請求，時區為: {user_timezone}")

    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="上傳的檔案必須是圖片格式。")

    image_bytes = await file.read()

    try:
        # 呼叫 Gemini 服務
        # --- 修改點 3: 更新傳遞給 gemini 服務的變數名稱 ---
        gemini_response = call_gemini_vision(
            image_bytes=image_bytes, 
            user_timezone=user_timezone # 使用新的變數名稱 user_timezone
        )
        
        # 使用內部解析函式來處理回應
        parsed_medications = _parse_gemini_response(gemini_response)
        
        # 將驗證和清理後的結果以 { "medications": [...] } 格式回傳給前端
        return {"medications": parsed_medications}

    except HTTPException as e:
        # 如果是我們已知的 HTTP 錯誤，直接重新拋出
        raise e
    except Exception as e:
        logger.error(f"處方箋辨識 API (upload) 發生未預期錯誤: {e}", exc_info=True)
        # 對於其他所有未預期的錯誤，回傳通用的 503 服務異常
        raise HTTPException(status_code=503, detail="AI 辨識服務暫時無法連線，請稍後再試。")

