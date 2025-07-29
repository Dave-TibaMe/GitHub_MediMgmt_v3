from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.germini_service import call_gemini_text
from app.models.alert import Alert

router = APIRouter()

@router.post("/analyze")
def analyze_interaction(user_id: str, medications: list = None, db: Session = Depends(get_db)):
    # 應由前端/DB取得所有該user的現行藥物紀錄（略）
    # 假設 medications = ["Aspirin 100mg", "Metformin 500mg", ...]
    prompt = f"""請分析以下用藥組合是否存在交互作用並說明理由：
{medications if medications else '（此處應填入用戶實際用藥清單）'}
請以簡明條列中文回覆，若有交互作用建議詳述。"""
    try:
        gemini_result = call_gemini_text(prompt)
        # 記錄到DB（如需求）
        alert = Alert(user_id=user_id, result=gemini_result)
        db.add(alert)
        db.commit()
        db.refresh(alert)
        return gemini_result
    except Exception as e:
        return {"error": "Gemini Text API失敗", "detail": str(e)}
