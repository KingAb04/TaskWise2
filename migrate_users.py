"""
Export users from SQLite to JSON, then import to MySQL.
"""
import json
from config import create_app, db
from models import User

def export_users_from_sqlite():
    """Export all users from the current DB (SQLite) to a JSON file."""
    app = create_app()
    users = []
    with app.app_context():
        all_users = User.query.all()
        for user in all_users:
            users.append({
                'username': user.username,
                'email': user.email,
                'password_hash': user.password_hash,
                'created_at': user.created_at.isoformat() if user.created_at else None
            })
    
    with open('users_export.json', 'w') as f:
        json.dump(users, f, indent=2)
    
    print(f"✅ Exported {len(users)} users to users_export.json")
    return len(users)

def import_users_to_current_db():
    """Import users from JSON file into the current DB (MySQL)."""
    try:
        with open('users_export.json', 'r') as f:
            users_data = json.load(f)
    except FileNotFoundError:
        print("❌ users_export.json not found. Run export first.")
        return 0
    
    app = create_app()
    imported = 0
    with app.app_context():
        for data in users_data:
            # Check if user already exists
            existing = User.query.filter(
                (User.username == data['username']) | (User.email == data['email'])
            ).first()
            if existing:
                print(f"⚠️  Skipping {data['username']} (already exists)")
                continue
            
            user = User(
                username=data['username'],
                email=data['email']
            )
            # Set password_hash directly (already hashed)
            user.password_hash = data['password_hash']
            
            if data.get('created_at'):
                from datetime import datetime
                user.created_at = datetime.fromisoformat(data['created_at'])
            
            db.session.add(user)
            imported += 1
        
        db.session.commit()
    
    print(f"✅ Imported {imported} users to MySQL")
    return imported

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python migrate_users.py [export|import]")
        sys.exit(1)
    
    command = sys.argv[1]
    if command == 'export':
        export_users_from_sqlite()
    elif command == 'import':
        import_users_to_current_db()
    else:
        print(f"Unknown command: {command}")
        print("Usage: python migrate_users.py [export|import]")
