import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

def create_database():
    """Create the TaskWise database if it doesn't exist"""
    try:
        # Connect to MySQL server (without specifying database)
        connection = pymysql.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            port=int(os.getenv('DB_PORT', 3306))
        )
        
        with connection.cursor() as cursor:
            # Create database
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {os.getenv('DB_NAME', 'taskwise_db')} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            print(f"✅ Database '{os.getenv('DB_NAME', 'taskwise_db')}' created successfully!")
            
        connection.commit()
        connection.close()
        
    except Exception as e:
        print(f"❌ Error creating database: {e}")
        return False
    
    return True

def insert_sample_data():
    """Insert sample data for testing (targets MySQL by default).

    Note: If DATABASE_URL is set (e.g., SQLite), we temporarily ignore it so that
    the SQLAlchemy engine uses the discrete MySQL env vars instead.
    """
    # Ensure we don't accidentally use a SQLite DATABASE_URL here
    os.environ.pop('DATABASE_URL', None)

    from config import create_app, db
    # Import all models so metadata knows about them before create_all
    from models import Project, Task, Priority, TaskStatus, User
    from datetime import datetime, timedelta

    app = create_app()
    with app.app_context():
        # Drop existing tables and create new ones
        print("Dropping existing tables...")
        db.drop_all()
        print("Creating new tables...")
        db.create_all()
        
        print("Inserting sample data...")
        
        # Create sample projects
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
        tasks = [
            Task(
                title="Homepage Design",
                description="Create mockups and prototypes for the new homepage",
                priority=Priority.HIGH,
                status=TaskStatus.IN_PROGRESS,
                progress=75,
                due_date=datetime.now() + timedelta(days=2),
                project_id=1,
                estimated_hours=16.0,
                actual_hours=12.0,
                start_date=datetime.now() - timedelta(days=3),
                is_tracking=False
            ),
            Task(
                title="API Documentation",
                description="Write comprehensive documentation for REST API endpoints",
                priority=Priority.MEDIUM,
                status=TaskStatus.TODO,
                progress=45,
                due_date=datetime.now() + timedelta(days=5),
                project_id=1
            ),
            Task(
                title="User Authentication",
                description="Implement secure login and registration system",
                priority=Priority.HIGH,
                status=TaskStatus.COMPLETED,
                progress=100,
                due_date=datetime.now() - timedelta(days=1),
                project_id=2
            ),
            Task(
                title="Database Migration",
                description="Migrate data from old system to new database",
                priority=Priority.MEDIUM,
                status=TaskStatus.TODO,
                progress=20,
                due_date=datetime.now() + timedelta(days=7),
                project_id=1
            ),
            Task(
                title="Social Media Strategy",
                description="Develop comprehensive social media marketing plan",
                priority=Priority.LOW,
                status=TaskStatus.IN_PROGRESS,
                progress=60,
                due_date=datetime.now() + timedelta(days=10),
                project_id=3
            ),
            Task(
                title="Learn Python Flask",
                description="Complete online Flask course and build sample project",
                priority=Priority.MEDIUM,
                status=TaskStatus.TODO,
                progress=30,
                due_date=datetime.now() + timedelta(days=14),
                project_id=4
            )
        ]
        
        for task in tasks:
            db.session.add(task)

        # Seed a demo user for login if not present
        if not User.query.filter((User.username == "demo") | (User.email == "demo@example.com")).first():
            demo = User(username="demo", email="demo@example.com")
            demo.set_password("demo1234")
            db.session.add(demo)

        db.session.commit()
        print("✅ Sample data inserted successfully!")

if __name__ == "__main__":
    print("🚀 Setting up TaskWise Database...")
    
    if create_database():
        print("📊 Inserting sample data...")
        insert_sample_data()
        print("🎉 Database setup complete!")
    else:
        print("❌ Database setup failed!")