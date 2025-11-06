from config import db
from datetime import datetime, timedelta
from enum import Enum

class TaskStatus(Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OVERDUE = "overdue"

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


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
class Project(db.Model):
    __tablename__ = 'projects'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    color = db.Column(db.String(7), default='#667eea')  # Hex color code
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    tasks = db.relationship('Task', backref='project', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Project {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'color': self.color,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'task_count': len(self.tasks)
        }

class Task(db.Model):
    __tablename__ = 'tasks'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.Enum(TaskStatus), default=TaskStatus.TODO, nullable=False)
    priority = db.Column(db.Enum(Priority), default=Priority.MEDIUM, nullable=False)
    progress = db.Column(db.Integer, default=0)  # 0-100
    card_color = db.Column(db.String(7), default='#fecaca')  # Hex color code for card background
    due_date = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    time_spent = db.Column(db.Float, default=0)
    
    # Progress tracking fields
    estimated_hours = db.Column(db.Float)  # Estimated hours to complete
    actual_hours = db.Column(db.Float)     # Actual hours spent
    start_date = db.Column(db.DateTime)    # When work actually started
    last_tracked = db.Column(db.DateTime)  # Last time tracking entry
    is_tracking = db.Column(db.Boolean, default=False)  # Currently tracking time
    
    # Foreign Keys
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'))
    parent_task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'))  # For task hierarchy
    
    def __repr__(self):
        return f'<Task {self.title}>'
    
    def to_dict(self):
        # Get time tracking stats
        total_time = timedelta()
        for entry in self.time_entries:
            if entry.duration:
                total_time += entry.duration
                
        # Calculate subtask progress
        subtask_count = len(self.subtasks) if hasattr(self, 'subtasks') else 0
        completed_subtasks = sum(1 for subtask in self.subtasks if subtask.completed) if hasattr(self, 'subtasks') else 0
        subtask_progress = (completed_subtasks / subtask_count * 100) if subtask_count > 0 else 0
        
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'status': self.status.value if self.status else None,
            'priority': self.priority.value if self.priority else None,
            'progress': self.progress,
            'card_color': self.card_color,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'project_id': self.project_id,
            'project_name': self.project.name if self.project else None,
            'project_color': self.project.color if self.project else '#667eea',
            
            # Progress tracking data
            'estimated_hours': self.estimated_hours,
            'actual_hours': self.actual_hours,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'is_tracking': self.is_tracking,
            'last_tracked': self.last_tracked.isoformat() if self.last_tracked else None,
            
            # Time tracking stats
            'total_time_spent': str(total_time),
            'time_entries': [entry.to_dict() for entry in self.time_entries] if hasattr(self, 'time_entries') else [],
            
            # Subtask information
            'subtasks': [subtask.to_dict() for subtask in self.subtasks] if hasattr(self, 'subtasks') else [],
            'subtask_count': subtask_count,
            'completed_subtasks': completed_subtasks,
            'subtask_progress': subtask_progress,
            
            # Dependencies
            'dependencies': [task.id for task in self.dependencies] if hasattr(self, 'dependencies') else [],
            'dependent_tasks': [task.id for task in self.dependent_tasks] if hasattr(self, 'dependent_tasks') else [],
            
            # Task hierarchy
            'parent_task_id': self.parent_task_id,
            
            # Calculated overall progress
            'calculated_progress': self.calculate_task_progress()
        }
    
    def calculate_task_progress(self):
        if self.status == TaskStatus.COMPLETED:
            return 100
        elif self.status == TaskStatus.TODO:
            return 0
        
        # For IN_PROGRESS tasks
        if self.estimated_hours and self.estimated_hours > 0:
            progress = (self.time_spent / self.estimated_hours) * 100
            return min(99, progress)  # Cap at 99% until explicitly completed
        
        return 50  # Default to 50% if no estimated hours
    
    def mark_completed(self):
        self.status = TaskStatus.COMPLETED
        self.progress = 100
        self.completed_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def is_overdue(self):
        if self.due_date and self.status != TaskStatus.COMPLETED:
            return datetime.utcnow() > self.due_date
        return False

# Import progress tracking models to ensure they're registered with SQLAlchemy
try:
    from models.progress_tracking import TimeEntry, Subtask, TaskDependency, ProgressSnapshot
except ImportError:
    pass  # Models not available yet during initial setup
