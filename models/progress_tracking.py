from config import db
from datetime import datetime, timedelta
from models import Task  # Import Task model for relationships

class TimeEntry(db.Model):
    __tablename__ = 'time_entries'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    end_time = db.Column(db.DateTime)
    duration = db.Column(db.Interval)  # Stored as timedelta
    description = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'duration': str(self.duration) if self.duration else None,
            'description': self.description
        }

class Subtask(db.Model):
    __tablename__ = 'subtasks'
    
    id = db.Column(db.Integer, primary_key=True)
    parent_task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    order = db.Column(db.Integer, default=0)  # For ordering subtasks
    
    def to_dict(self):
        return {
            'id': self.id,
            'parent_task_id': self.parent_task_id,
            'title': self.title,
            'completed': self.completed,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'order': self.order
        }

class TaskDependency(db.Model):
    __tablename__ = 'task_dependencies'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False)
    depends_on_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class ProgressSnapshot(db.Model):
    """Stores daily progress snapshots for analytics"""
    __tablename__ = 'progress_snapshots'
    
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'))
    total_tasks = db.Column(db.Integer, default=0)
    completed_tasks = db.Column(db.Integer, default=0)
    total_time_spent = db.Column(db.Interval, default=timedelta())
    completion_rate = db.Column(db.Float, default=0.0)
    
    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat(),
            'project_id': self.project_id,
            'total_tasks': self.total_tasks,
            'completed_tasks': self.completed_tasks,
            'total_time_spent': str(self.total_time_spent),
            'completion_rate': self.completion_rate
        }

# Add relationships to Task model
from models import Task

Task.time_entries = db.relationship('TimeEntry', backref='task', lazy=True, cascade='all, delete-orphan')
Task.subtasks = db.relationship('Subtask', backref='parent_task', lazy=True, cascade='all, delete-orphan')
Task.dependencies = db.relationship(
    'Task', 
    secondary='task_dependencies',
    primaryjoin='Task.id == TaskDependency.task_id',
    secondaryjoin='Task.id == TaskDependency.depends_on_id',
    backref=db.backref('dependent_tasks', lazy=True)
)

def calculate_task_progress(task):
    """Calculate task progress based on multiple factors"""
    weights = {
        'subtasks': 0.4,      # 40% weight for subtasks completion
        'time_spent': 0.3,    # 30% weight for time spent vs estimated
        'manual': 0.3         # 30% weight for manual progress setting
    }
    
    progress = 0
    
    # Calculate subtasks progress
    if task.subtasks:
        completed_subtasks = sum(1 for subtask in task.subtasks if subtask.completed)
        subtask_progress = (completed_subtasks / len(task.subtasks)) * 100
        progress += subtask_progress * weights['subtasks']
    
    # Calculate time-based progress
    if task.estimated_hours and task.time_entries:
        total_time = sum((entry.duration.total_seconds() / 3600) for entry in task.time_entries if entry.duration)
        time_progress = min((total_time / task.estimated_hours) * 100, 100)
        progress += time_progress * weights['time_spent']
    
    # Include manual progress setting
    progress += task.progress * weights['manual']
    
    return min(round(progress), 100)  # Ensure progress doesn't exceed 100%