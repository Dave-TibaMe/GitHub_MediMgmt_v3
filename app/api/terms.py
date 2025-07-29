from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_terms():
    # 建議將條款內容移到檔案或資料庫，這裡直接寫死
    terms = """
    本系統僅提供用藥紀錄、提醒與資訊參考，任何用藥行為請務必諮詢專業醫療人員，所有數據僅供參考。
    """
    return {"terms": terms}
