# 在 app/db/database.py 的 init_db() 函式中確保匯入所有模型

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from configparser import ConfigParser

config = ConfigParser()
config.read('./app/config/config.ini')
SQLALCHEMY_DATABASE_URL = f"sqlite:///{config.get('DATABASE', 'sqlite_path')}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def init_db():
    # 匯入所有模型以確保它們被註冊到 Base.metadata
    from app.models.medication import Medication
    from app.models.user import User
    from app.models.alert import Alert
    from app.models.reminder import Reminder
    from app.models.user_profile import UserProfile  # 新增
    
    # 建立所有資料表
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()