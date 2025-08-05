# medication.py (增強版 - 新增單一藥物查詢功能)

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
    """根據 user_id 查詢參數列出藥物"""
    meds = db.query(Medication).filter(Medication.user_id == user_id).all()
    return meds

@router.get("/{med_id}", response_model=MedicationResponse)
def get_medication_by_id(med_id: int, db: Session = Depends(get_db)):
    """根據藥物 ID 取得單一藥物詳細資料"""
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="找不到指定的藥物")
    return med

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
    """更新指定的藥物"""
    logging.info(f"--- 開始更新藥物 ID: {med_id} ---")
    
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="找不到指定的藥物")
    
    try:
        # 記錄更新前的資料
        logging.info(f"更新前藥物資料: {med.name}")
        
        # 收集要更新的欄位
        update_dict = update_data.dict(exclude_unset=True)
        logging.info(f"要更新的欄位: {json.dumps(update_dict, indent=2, ensure_ascii=False, cls=DateTimeEncoder)}")
        
        # 更新資料
        for key, value in update_dict.items():
            if hasattr(med, key):
                setattr(med, key, value)
                logging.info(f"已更新欄位 {key}: {value}")
        
        db.commit()
        db.refresh(med)
        
        logging.info(f"成功更新藥物 ID: {med_id}, 名稱: {med.name}")
        return med
        
    except Exception as e:
        logging.error(f"更新藥物時發生錯誤: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"更新藥物時發生錯誤: {str(e)}")

@router.delete("/{med_id}")
def delete_medication(med_id: int, db: Session = Depends(get_db)):
    """刪除指定的藥物"""
    logging.info(f"--- 開始刪除藥物 ID: {med_id} ---")
    
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="找不到指定的藥物")
    
    try:
        medication_name = med.name
        db.delete(med)
        db.commit()
        
        logging.info(f"成功刪除藥物: {medication_name} (ID: {med_id})")
        return {"ok": True, "message": f"藥物 '{medication_name}' 已成功刪除"}
        
    except Exception as e:
        logging.error(f"刪除藥物時發生錯誤: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"刪除藥物時發生錯誤: {str(e)}")

# 根據 user_id 查詢藥物的端點
@router.get("/user/{user_id}", response_model=List[MedicationResponse])
def list_medications_by_user_id(user_id: str, db: Session = Depends(get_db)):
    """根據使用者 ID 查詢該使用者的所有藥物紀錄"""
    logging.info(f"查詢使用者 {user_id} 的藥物紀錄")
    
    meds = db.query(Medication).filter(Medication.user_id == user_id).all()
    
    logging.info(f"找到 {len(meds)} 筆藥物紀錄")
    return meds