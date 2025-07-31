# app/api/alert.py (修复版本 - 完整药物警戒功能)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import logging

from app.db.database import get_db
from app.services.germini_service import call_gemini_text
#from app.models.alert import Alert
from app.models.medication import Medication
from app.models.user_profile import UserProfile

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

class AnalyzeRequest(BaseModel):
    user_id: str

@router.post("/analyze")
def analyze_interaction(request: AnalyzeRequest, db: Session = Depends(get_db)):
    """
    综合分析用户的药物交互作用，考虑：
    1. 用户当前服用的所有药物
    2. 用户的个人资料（饮食习惯、病史、生理状况等）
    3. 通过 AI 进行深度分析
    """
    try:
        user_id = request.user_id
        logger.info(f"开始为用户 {user_id} 进行药物交互作用分析")
        
        # 1. 获取用户当前的药物清单
        medications = db.query(Medication).filter(
            Medication.user_id == user_id,
            Medication.status == "進行中"
        ).all()
        
        if not medications:
            return {
                "analysis_result": "目前沒有正在服用的藥物紀錄，無法進行交互作用分析。請先新增用藥紀錄。",
                "has_interactions": False,
                "medication_count": 0
            }
        
        # 2. 获取用户个人资料
        user_profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        
        # 3. 构建分析提示词
        prompt = build_analysis_prompt(medications, user_profile)
        logger.info(f"生成的分析提示词长度: {len(prompt)} 字符")
        
        # 4. 调用 AI 进行分析
        gemini_result = call_gemini_text(prompt)
        
        # 5. 提取分析结果
        analysis_text = extract_analysis_result(gemini_result)
        
        # 6. 保存分析记录到数据库
        alert = Alert(
            user_id=user_id, 
            result={
                "analysis": analysis_text,
                "medication_count": len(medications),
                "has_profile": user_profile is not None
            }
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        
        logger.info(f"成功完成用户 {user_id} 的药物交互作用分析")
        
        return analysis_text
        
    except Exception as e:
        logger.error(f"药物交互作用分析失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"分析過程中發生錯誤: {str(e)}"
        )

def build_analysis_prompt(medications: List[Medication], user_profile: Optional[UserProfile]) -> str:
    """构建详细的药物交互作用分析提示词"""
    
    # 构建药物清单
    med_list = []
    for med in medications:
        med_info = f"• {med.name}"
        if med.dose:
            med_info += f" ({med.dose})"
        if med.frequency:
            med_info += f" - {med.frequency}"
        if med.effect:
            med_info += f" [作用: {med.effect}]"
        med_list.append(med_info)
    
    medications_text = "\n".join(med_list)
    
    # 构建个人资料信息
    profile_info = []
    
    if user_profile:
        # 饮食习惯
        diet_items = []
        if user_profile.diet_alcohol: diet_items.append("酒精")
        if user_profile.diet_caffeine: diet_items.append("咖啡因")
        if user_profile.diet_grapefruit: diet_items.append("葡萄柚")
        if user_profile.diet_milk: diet_items.append("牛奶/乳製品")
        if user_profile.diet_high_fat: diet_items.append("高脂餐")
        if user_profile.diet_high_vitamin_k: diet_items.append("高維他命K食物")
        if user_profile.diet_tyramine: diet_items.append("含酪胺食物")
        
        if diet_items:
            profile_info.append(f"飲食習慣: {', '.join(diet_items)}")
        
        # 保健食品/中药
        supp_items = []
        if user_profile.supp_st_johns_wort: supp_items.append("聖約翰草")
        if user_profile.supp_ginkgo: supp_items.append("銀杏")
        if user_profile.supp_ginseng: supp_items.append("人蔘")
        if user_profile.supp_garlic: supp_items.append("大蒜")
        if user_profile.supp_grape_seed: supp_items.append("葡萄籽")
        if user_profile.supp_fish_oil: supp_items.append("魚油")
        if user_profile.supp_omega3: supp_items.append("Omega-3")
        if user_profile.supp_licorice: supp_items.append("甘草")
        if user_profile.supp_red_yeast_rice: supp_items.append("紅麴")
        
        if supp_items:
            profile_info.append(f"保健食品/中藥: {', '.join(supp_items)}")
        
        # 病史
        history_items = []
        if user_profile.history_asthma: history_items.append("氣喘")
        if user_profile.history_diabetes: history_items.append("糖尿病")
        if user_profile.history_hypertension: history_items.append("高血壓")
        if user_profile.history_liver_dysfunction: history_items.append("肝功能不全")
        if user_profile.history_kidney_dysfunction: history_items.append("腎功能不全")
        if user_profile.history_gastric_ulcer: history_items.append("胃潰瘍")
        if user_profile.history_epilepsy: history_items.append("癲癇")
        if user_profile.history_arrhythmia: history_items.append("心律不整")
        
        if history_items:
            profile_info.append(f"個人病史: {', '.join(history_items)}")
        
        # 特殊生理状况
        condition_items = []
        if user_profile.condition_pregnancy: condition_items.append("懷孕")
        if user_profile.condition_breastfeeding: condition_items.append("哺乳")
        if user_profile.condition_infant: condition_items.append("嬰幼兒")
        if user_profile.condition_elderly: condition_items.append("老年人")
        if user_profile.condition_obesity: condition_items.append("肥胖")
        
        if condition_items:
            profile_info.append(f"特殊生理狀況: {', '.join(condition_items)}")
    
    profile_text = "\n".join(profile_info) if profile_info else "未提供個人健康資料"
    
    # 构建完整提示词
    prompt = f"""
你是一位專業的臨床藥師，請針對以下用藥組合進行詳細的交互作用分析：

**目前服用藥物：**
{medications_text}

**個人健康資料：**
{profile_text}

**分析要求：**
1. 檢查藥物之間是否存在交互作用
2. 分析藥物與飲食/保健食品的交互作用
3. 根據個人病史評估用藥風險
4. 考慮特殊生理狀況對用藥的影響
5. 提供具體的用藥建議和注意事項

**回覆格式：**
請以條列方式，用繁體中文回覆，包含以下內容：

### 🔍 分析結果

### ⚠️ 發現的交互作用
（如有發現）

### 💊 用藥建議
（具體建議）

### 📋 注意事項
（重要提醒）

### 🏥 就醫建議
（何時需要諮詢醫師）

請提供專業、實用的分析，但避免過度驚嚇患者。
"""
    
    return prompt

def extract_analysis_result(gemini_response: dict) -> str:
    """从 Gemini API 响应中提取分析结果"""
    try:
        # 从 Gemini 响应中提取文本内容
        if 'candidates' in gemini_response and len(gemini_response['candidates']) > 0:
            candidate = gemini_response['candidates'][0]
            if 'content' in candidate and 'parts' in candidate['content']:
                parts = candidate['content']['parts']
                if len(parts) > 0 and 'text' in parts[0]:
                    return parts[0]['text'].strip()
        
        # 如果无法提取，返回错误信息
        logger.error(f"无法从 Gemini 响应中提取文本内容: {gemini_response}")
        return "分析結果提取失敗，請稍後再試。"
        
    except Exception as e:
        logger.error(f"提取分析结果时发生错误: {e}")
        return "分析結果處理時發生錯誤，請稍後再試。"