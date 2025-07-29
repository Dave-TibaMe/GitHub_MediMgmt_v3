from sqlalchemy import Column, Integer, String, DateTime, Boolean
from app.db.database import Base

class Reminder(Base):
    __tablename__ = "reminders"
    id = Column(Integer, primary_key=True, index=True)
    medication_id = Column(Integer)
    remind_time = Column(DateTime)
    taken = Column(Boolean, default=False)
