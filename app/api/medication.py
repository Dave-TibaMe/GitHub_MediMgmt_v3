# medication.py (修正版 - 解決 JSON 序列化問題)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, validator
from typing import List, Optional
from datetime import date
import logging
import json

from app.db.database import get_db
from app.models.medication import Medication

# 設定日誌記錄
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [MEDICATION_API] - %(message)s')

router = APIRouter()

# --- 自訂 JSON 編碼器，用來處理 date 物件 ---
class DateTimeEncoder(json.JSONEncoder):
    """自訂 JSON 編碼器，能夠處理 date 和 datetime 物件"""
    def default(self, obj):
        if isinstance(obj, date):
            return obj.isoformat()
        return super().default(obj)

# --- Pydantic 模型 (Schemas) ---
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

# 修正批次新增藥物的端點
@router.post("/", response_model=List[MedicationResponse], status_code=201)
def create_medications_in_batch(
    medications_to_create: List[MedicationCreate],
    db: Session = Depends(get_db)
):
    logging.info("--- 成功進入 `create_medications_in_batch` 函式 ---")
    
    try:
        # 修正：使用自訂的 DateTimeEncoder 來處理日期物件
        received_data = [med.dict() for med in medications_to_create]
        logging.info(f"收到批次藥物資料: {json.dumps(received_data, indent=2, ensure_ascii=False, cls=DateTimeEncoder)}")

        created_medications_db = []
        
        for med_data in medications_to_create:
            logging.info(f"正在處理藥物: {med_data.name} (使用者 ID: {med_data.user_id})")
            
            # 檢查 user_id
            if not med_data.user_id:
                logging.error("儲存失敗：有一筆藥物資料缺少 'user_id'。")
                raise HTTPException(status_code=400, detail="所有藥物紀錄都必須包含使用者 ID (user_id)。")

            # 建立資料庫物件
            db_med = Medication(**med_data.dict())
            db.add(db_med)
            created_medications_db.append(db_med)
        
        # 一次性提交所有變更
        db.commit()
        
        # 刷新每個物件以獲取資料庫生成的 ID
        for med in created_medications_db:
            db.refresh(med)
            
        logging.info(f"資料庫操作完成，成功建立 {len(created_medications_db)} 筆藥物紀錄。")
        return created_medications_db

    except HTTPException as e:
        # 重新拋出 HTTP 異常
        db.rollback()
        raise e
    except Exception as e:
        # 捕捉其他未預期的錯誤
        logging.error(f"在批次建立藥物時發生嚴重錯誤: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"伺服器內部發生嚴重錯誤: {str(e)}")

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

# 新增：根據 user_id 查詢藥物的端點
@router.get("/user/{user_id}", response_model=List[MedicationResponse])
def list_medications_by_user_id(user_id: str, db: Session = Depends(get_db)):
    """根據使用者 ID 查詢該使用者的所有藥物紀錄"""
    meds = db.query(Medication).filter(Medication.user_id == user_id).all()
    return meds