"""
Add test tasks with subtasks to verify subtask functionality
"""
from config import create_app, db
from models import Task, Project, Priority, TaskStatus, User
from models.progress_tracking import Subtask
from datetime import datetime, timedelta

app = create_app()

with app.app_context():
    # Check if we have any tasks
    tasks = Task.query.all()
    
    if not tasks:
        # Create a sample project
        project = Project(
            name="Sample Project",
            description="Project for testing subtasks",
            color="#667eea"
        )
        db.session.add(project)
        db.session.commit()
        
        # Create a sample task
        task = Task(
            title="Complete Project Documentation",
            description="Write comprehensive documentation for the project",
            status=TaskStatus.IN_PROGRESS,
            priority=Priority.HIGH,
            project_id=project.id,
            due_date=datetime.utcnow() + timedelta(days=7),
            estimated_hours=10
        )
        db.session.add(task)
        db.session.commit()
        print(f"✅ Created task: {task.title} (ID: {task.id})")
        
        # Create some subtasks
        subtasks_data = [
            ("Write API documentation", False),
            ("Create user guide", False),
            ("Add code examples", True),
            ("Review and proofread", False)
        ]
        
        for idx, (title, completed) in enumerate(subtasks_data):
            subtask = Subtask(
                parent_task_id=task.id,
                title=title,
                completed=completed,
                order=idx,
                completed_at=datetime.utcnow() if completed else None
            )
            db.session.add(subtask)
        
        db.session.commit()
        print(f"✅ Created {len(subtasks_data)} subtasks")
    else:
        # Add subtasks to existing tasks
        for task in tasks[:3]:  # Add subtasks to first 3 tasks
            existing_subtasks = Subtask.query.filter_by(parent_task_id=task.id).count()
            if existing_subtasks == 0:
                subtasks_data = [
                    (f"Subtask 1 for {task.title[:20]}", False),
                    (f"Subtask 2 for {task.title[:20]}", True),
                    (f"Subtask 3 for {task.title[:20]}", False)
                ]
                
                for idx, (title, completed) in enumerate(subtasks_data):
                    subtask = Subtask(
                        parent_task_id=task.id,
                        title=title,
                        completed=completed,
                        order=idx,
                        completed_at=datetime.utcnow() if completed else None
                    )
                    db.session.add(subtask)
                
                print(f"✅ Added {len(subtasks_data)} subtasks to task: {task.title}")
        
        db.session.commit()
    
    # Verify subtasks were added
    all_subtasks = Subtask.query.all()
    print(f"\n📊 Total subtasks in database: {len(all_subtasks)}")
    for subtask in all_subtasks:
        status = "✓" if subtask.completed else "○"
        print(f"  {status} {subtask.title} (Task ID: {subtask.parent_task_id})")
    
    print("\n🎉 Subtasks added successfully!")
