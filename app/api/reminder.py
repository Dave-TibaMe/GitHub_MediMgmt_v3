from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.reminder import Reminder

router = APIRouter()

@router.get("/")
def list_reminders(medication_id: int, db: Session = Depends(get_db)):
    reminders = db.query(Reminder).filter(Reminder.medication_id == medication_id).all()
    return [r.__dict__ for r in reminders]

@router.post("/")
def create_reminder(data: dict, db: Session = Depends(get_db)):
    reminder = Reminder(**data)
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder.__dict__

@router.put("/{reminder_id}")
def update_reminder(reminder_id: int, data: dict, db: Session = Depends(get_db)):
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    for k, v in data.items():
        setattr(reminder, k, v)
    db.commit()
    db.refresh(reminder)
    return reminder.__dict__

@router.delete("/{reminder_id}")
def delete_reminder(reminder_id: int, db: Session = Depends(get_db)):
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.delete(reminder)
    db.commit()
    return {"ok": True}
