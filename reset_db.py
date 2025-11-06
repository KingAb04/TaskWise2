from config import create_app, db
import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

def reset_database():
    """Drop and recreate the database"""
    try:
        # Connect to MySQL server
        connection = pymysql.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            port=int(os.getenv('DB_PORT', 3306))
        )
        
        with connection.cursor() as cursor:
            # Drop database if exists
            cursor.execute(f"DROP DATABASE IF EXISTS {os.getenv('DB_NAME', 'taskwise_db')}")
            # Create database
            cursor.execute(f"CREATE DATABASE {os.getenv('DB_NAME', 'taskwise_db')} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            print(f"✅ Database reset successful!")
            
        connection.commit()
        connection.close()
        return True
        
    except Exception as e:
        print(f"❌ Error resetting database: {e}")
        return False

if __name__ == "__main__":
    if reset_database():
        # Create tables and insert sample data
        app = create_app()
        with app.app_context():
            # Import models BEFORE creating tables
            from models import Task, Project, TaskStatus, Priority
            from datetime import datetime, timedelta
            
            print("Creating tables...")
            db.create_all()
            print("✅ Tables created successfully!")
            
            # Create sample projects
            print("Creating sample projects...")
            projects = [
                Project(name="Website Redesign", description="Complete website overhaul with modern design", color="#667eea"),
                Project(name="Mobile App", description="iOS and Android app development", color="#f093fb"),
                Project(name="Marketing Campaign", description="Q4 marketing initiatives", color="#22c55e"),
                Project(name="Personal Goals", description="Personal development and learning", color="#f59e0b")
            ]
            
            for project in projects:
                db.session.add(project)
            db.session.commit()
            
            # Create sample tasks
            print("Creating sample tasks...")
            tasks = [
                Task(
                    title="Homepage Design",
                    description="Create mockups and prototypes for the new homepage",
                    priority=Priority.HIGH,
                    status=TaskStatus.IN_PROGRESS,
                    progress=75,
                    card_color='#fecaca',
                    due_date=datetime.now() + timedelta(days=2),
                    project_id=1,
                    estimated_hours=16.0,
                    actual_hours=12.0,
                    start_date=datetime.now() - timedelta(days=3),
                    is_tracking=False
                )
            ]
            
            for task in tasks:
                db.session.add(task)
            db.session.commit()
            
            print("✅ Sample data created successfully!")
    else:
        print("❌ Database reset failed!")