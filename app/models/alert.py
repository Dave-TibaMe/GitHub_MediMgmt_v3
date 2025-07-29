from sqlalchemy import Column, Integer, String, DateTime, JSON
from app.db.database import Base

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    alert_time = Column(DateTime)
    result = Column(JSON)
