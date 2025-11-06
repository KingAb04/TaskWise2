"""
TaskWise models package
"""
from config import db
from datetime import datetime, timedelta
from enum import Enum

# Enums
class TaskStatus(Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OVERDUE = "overdue"

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

# Simple User model for authentication
class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        from werkzeug.security import generate_password_hash
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        from werkzeug.security import check_password_hash
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
# Import all models
from .base import Project, Task
from .progress_tracking import TimeEntry, Subtask, TaskDependency, ProgressSnapshot

__all__ = [
    'Project', 'Task', 'TimeEntry', 'Subtask', 'TaskDependency', 
    'User',
    'ProgressSnapshot', 'TaskStatus', 'Priority'
]