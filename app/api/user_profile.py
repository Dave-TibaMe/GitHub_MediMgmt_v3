# app/api/user_profile.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import logging

from app.db.database import get_db
from app.models.user_profile import UserProfile

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# --- Pydantic 模型 ---
class UserProfileResponse(BaseModel):
    id: int
    user_id: str
    
    # 飲食習慣
    diet_alcohol: bool
    diet_caffeine: bool
    diet_grapefruit: bool
    diet_milk: bool
    diet_high_fat: bool
    diet_high_vitamin_k: bool
    diet_tyramine: bool
    
    # 正在服用的保健食品/中藥
    supp_st_johns_wort: bool
    supp_ginkgo: bool
    supp_ginseng: bool
    supp_garlic: bool
    supp_grape_seed: bool
    supp_fish_oil: bool
    supp_omega3: bool
    supp_licorice: bool
    supp_red_yeast_rice: bool
    
    # 個人病史
    history_asthma: bool
    history_diabetes: bool
    history_hypertension: bool
    history_liver_dysfunction: bool
    history_kidney_dysfunction: bool
    history_gastric_ulcer: bool
    history_epilepsy: bool
    history_arrhythmia: bool
    
    # 特殊生理狀況
    condition_pregnancy: bool
    condition_breastfeeding: bool
    condition_infant: bool
    condition_elderly: bool
    condition_obesity: bool

    class Config:
        orm_mode = True

class UserProfileUpdate(BaseModel):
    # 飲食習慣
    diet_alcohol: Optional[bool] = None
    diet_caffeine: Optional[bool] = None
    diet_grapefruit: Optional[bool] = None
    diet_milk: Optional[bool] = None
    diet_high_fat: Optional[bool] = None
    diet_high_vitamin_k: Optional[bool] = None
    diet_tyramine: Optional[bool] = None
    
    # 正在服用的保健食品/中藥
    supp_st_johns_wort: Optional[bool] = None
    supp_ginkgo: Optional[bool] = None
    supp_ginseng: Optional[bool] = None
    supp_garlic: Optional[bool] = None
    supp_grape_seed: Optional[bool] = None
    supp_fish_oil: Optional[bool] = None
    supp_omega3: Optional[bool] = None
    supp_licorice: Optional[bool] = None
    supp_red_yeast_rice: Optional[bool] = None
    
    # 個人病史
    history_asthma: Optional[bool] = None
    history_diabetes: Optional[bool] = None
    history_hypertension: Optional[bool] = None
    history_liver_dysfunction: Optional[bool] = None
    history_kidney_dysfunction: Optional[bool] = None
    history_gastric_ulcer: Optional[bool] = None
    history_epilepsy: Optional[bool] = None
    history_arrhythmia: Optional[bool] = None
    
    # 特殊生理狀況
    condition_pregnancy: Optional[bool] = None
    condition_breastfeeding: Optional[bool] = None
    condition_infant: Optional[bool] = None
    condition_elderly: Optional[bool] = None
    condition_obesity: Optional[bool] = None

# --- API 端點 ---

@router.get("/{user_id}", response_model=UserProfileResponse)
def get_user_profile(user_id: str, db: Session = Depends(get_db)):
    """取得使用者個人資料"""
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    
    if not profile:
        # 如果沒有資料，建立預設的個人資料
        profile = UserProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
        logger.info(f"為使用者 {user_id} 建立新的個人資料")
    
    return profile

@router.put("/{user_id}", response_model=UserProfileResponse)
def update_user_profile(
    user_id: str, 
    profile_data: UserProfileUpdate, 
    db: Session = Depends(get_db)
):
    """更新使用者個人資料"""
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    
    if not profile:
        # 如果沒有資料，建立新的個人資料
        profile = UserProfile(user_id=user_id)
        db.add(profile)
    
    # 更新資料
    update_dict = profile_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(profile, key, value)
    
    db.commit()
    db.refresh(profile)
    
    logger.info(f"成功更新使用者 {user_id} 的個人資料")
    return profile

@router.delete("/{user_id}")
def delete_user_profile(user_id: str, db: Session = Depends(get_db)):
    """刪除使用者個人資料"""
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="使用者個人資料不存在")
    
    db.delete(profile)
    db.commit()
    
    logger.info(f"成功刪除使用者 {user_id} 的個人資料")
    return {"message": "個人資料已刪除"}