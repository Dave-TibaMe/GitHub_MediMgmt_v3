from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User

router = APIRouter()

@router.get("/")
def get_user(line_user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.line_user_id == line_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user.__dict__

@router.post("/")
def create_user(data: dict, db: Session = Depends(get_db)):
    user = User(**data)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user.__dict__

@router.put("/")
def update_user(line_user_id: str, data: dict, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.line_user_id == line_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for k, v in data.items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return user.__dict__
