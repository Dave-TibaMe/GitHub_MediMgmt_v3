# app/models/user_profile.py

from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.db.database import Base

class UserProfile(Base):
    __tablename__ = "user_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True)  # LINE User ID
    
    # 飲食習慣
    diet_alcohol = Column(Boolean, default=False)  # 酒精
    diet_caffeine = Column(Boolean, default=False)  # 咖啡因（咖啡、茶、巧克力）
    diet_grapefruit = Column(Boolean, default=False)  # 葡萄柚(汁)
    diet_milk = Column(Boolean, default=False)  # 牛奶/乳製品（含鈣）
    diet_high_fat = Column(Boolean, default=False)  # 高脂餐
    diet_high_vitamin_k = Column(Boolean, default=False)  # 高維他命K食物（深綠色蔬菜）
    diet_tyramine = Column(Boolean, default=False)  # 含酪胺食物（起司、紅酒、醃肉）
    
    # 正在服用的保健食品/中藥
    supp_st_johns_wort = Column(Boolean, default=False)  # 聖約翰草
    supp_ginkgo = Column(Boolean, default=False)  # 銀杏
    supp_ginseng = Column(Boolean, default=False)  # 人蔘
    supp_garlic = Column(Boolean, default=False)  # 大蒜
    supp_grape_seed = Column(Boolean, default=False)  # 葡萄籽
    supp_fish_oil = Column(Boolean, default=False)  # 魚油
    supp_omega3 = Column(Boolean, default=False)  # Omega-3
    supp_licorice = Column(Boolean, default=False)  # 甘草（Licorice）
    supp_red_yeast_rice = Column(Boolean, default=False)  # 紅麴
    
    # 個人病史
    history_asthma = Column(Boolean, default=False)  # 氣喘
    history_diabetes = Column(Boolean, default=False)  # 糖尿病
    history_hypertension = Column(Boolean, default=False)  # 高血壓
    history_liver_dysfunction = Column(Boolean, default=False)  # 肝功能不全
    history_kidney_dysfunction = Column(Boolean, default=False)  # 腎功能不全
    history_gastric_ulcer = Column(Boolean, default=False)  # 胃潰瘍或消化道出血
    history_epilepsy = Column(Boolean, default=False)  # 癲癇
    history_arrhythmia = Column(Boolean, default=False)  # 心律不整
    
    # 特殊生理狀況
    condition_pregnancy = Column(Boolean, default=False)  # 懷孕
    condition_breastfeeding = Column(Boolean, default=False)  # 哺乳
    condition_infant = Column(Boolean, default=False)  # 嬰幼兒
    condition_elderly = Column(Boolean, default=False)  # 老年人
    condition_obesity = Column(Boolean, default=False)  # 肥胖
    
    # 系統欄位
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())