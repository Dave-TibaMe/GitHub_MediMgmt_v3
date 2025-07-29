from sqlalchemy import Column, Integer, String, Date, JSON
from app.db.database import Base

class Medication(Base):
    __tablename__ = "medications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    name = Column(String)
    dose = Column(String)
    frequency = Column(String)
    effect = Column(String)
    remind_times = Column(JSON)
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(String, default="進行中")  # 進行中/已停藥
