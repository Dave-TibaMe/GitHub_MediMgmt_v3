# medication.py (修改後，支援批次新增並加入日誌)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, validator
from typing import List, Optional
from datetime import date
import logging  # 1. (新增) 匯入 logging 模組
import json     # 2. (新增) 匯入 json 模組以便更好地格式化日誌

from app.db.database import get_db
from app.models.medication import Medication

# 3. (新增) 設定日誌記錄，確保訊息會被印出
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [MEDICATION_API] - %(message)s')

router = APIRouter()

# --- Pydantic 模型 (Schemas) ---
# (您的模型定義很棒，維持原樣)
class MedicationBase(BaseModel):
    user_id: str
    name: str
    dose: Optional[str] = None
    frequency: Optional[str] = None
    effect: Optional[str] = None
    remind_times: Optional[dict] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = "進行中"

    class Config:
        orm_mode = True

class MedicationCreate(MedicationBase):
    @validator('start_date', 'end_date', pre=True)
    def parse_date_string(cls, v):
        if v == '' or v is None:
            return None
        return v

class MedicationUpdate(MedicationBase):
    user_id: Optional[str] = None
    name: Optional[str] = None
    @validator('start_date', 'end_date', pre=True)
    def parse_date_string(cls, v):
        if v == '' or v is None:
            return None
        return v

class MedicationResponse(MedicationBase):
    id: int

# --- API 端點 (Endpoints) ---

@router.get("/", response_model=List[MedicationResponse])
def list_medications(user_id: str, db: Session = Depends(get_db)):
    meds = db.query(Medication).filter(Medication.user_id == user_id).all()
    return meds

# ▼▼▼▼▼ 主要修改區域 ▼▼▼▼▼

# 4. (重大修改) 修改 POST 端點以接收一個「列表」，並加入日誌
@router.post("/", response_model=List[MedicationResponse], status_code=201)
def create_medications_in_batch(
    medications_to_create: List[MedicationCreate], # 接收一個列表
    db: Session = Depends(get_db)
):
    # 日誌記錄：確認函式被觸發
    logging.info("--- 成功進入 `create_medications_in_batch` 函式 ---")
    
    try:
        # 日誌記錄：印出收到的完整資料，方便除錯
        received_data = [med.dict() for med in medications_to_create]
        logging.info(f"收到批次藥物資料: {json.dumps(received_data, indent=2, ensure_ascii=False)}")

        created_medications_db = []
        # 迴圈處理每一筆要新增的藥物
        for med_data in medications_to_create:
            logging.info(f"正在處理藥物: {med_data.name} (使用者 ID: {med_data.user_id})")
            
            # 檢查 user_id，確保資料完整性
            if not med_data.user_id:
                logging.error("儲存失敗：有一筆藥物資料缺少 'user_id'。")
                raise HTTPException(status_code=400, detail="所有藥物紀錄都必須包含使用者 ID (user_id)。")

            db_med = Medication(**med_data.dict())
            db.add(db_med)
            created_medications_db.append(db_med)
        
        # 在迴圈外一次性提交所有變更，效率更高
        db.commit()
        
        # 提交後，刷新每個物件以獲取資料庫生成的 ID
        for med in created_medications_db:
            db.refresh(med)
            
        logging.info(f"資料庫操作完成，成功建立 {len(created_medications_db)} 筆藥物紀錄。")
        return created_medications_db

    except Exception as e:
        # 日誌記錄：捕捉任何未預期的錯誤
        logging.error(f"在批次建立藥物時發生嚴重錯誤: {e}", exc_info=True)
        db.rollback() # 如果出錯，撤銷這次的所有操作，避免部分成功部分失敗
        raise HTTPException(status_code=500, detail=f"伺服器內部發生嚴重錯誤: {str(e)}")

# ▲▲▲▲▲ 主要修改區域結束 ▲▲▲▲▲


@router.put("/{med_id}", response_model=MedicationResponse)
def update_medication(med_id: int, update_data: MedicationUpdate, db: Session = Depends(get_db)):
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    update_dict = update_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(med, key, value)
        
    db.commit()
    db.refresh(med)
    return med

@router.delete("/{med_id}")
def delete_medication(med_id: int, db: Session = Depends(get_db)):
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    db.delete(med)
    db.commit()

    return {"ok": True}
