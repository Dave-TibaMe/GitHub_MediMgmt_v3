from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.base import JobLookupError

scheduler = BackgroundScheduler()

def start_scheduler():
    if not scheduler.running:
        scheduler.start()

def schedule_reminder(func, run_date, args=None, job_id=None):
    """新增一筆服藥提醒排程（run_date 必須為 UTC）"""
    job = scheduler.add_job(func, 'date', run_date=run_date, args=args or [], id=job_id)
    return job

def remove_reminder(job_id):
    try:
        scheduler.remove_job(job_id)
    except JobLookupError:
        pass  # 任務不存在可忽略
