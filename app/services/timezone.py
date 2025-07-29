import pytz
from datetime import datetime

def convert_time_to_user_timezone(dt: datetime, user_timezone: str):
    """將UTC時間轉換為用戶時區時間字串"""
    try:
        user_tz = pytz.timezone(user_timezone)
        utc_dt = pytz.utc.localize(dt)
        local_dt = utc_dt.astimezone(user_tz)
        return local_dt
    except Exception as e:
        print("時區轉換失敗:", e)
        return dt

def get_current_time_in_timezone(user_timezone: str):
    try:
        user_tz = pytz.timezone(user_timezone)
        return datetime.now(user_tz)
    except Exception as e:
        print("取得時區當地時間失敗:", e)
        return datetime.utcnow()
