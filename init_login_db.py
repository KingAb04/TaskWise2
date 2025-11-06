from config import create_app, db
from models import User


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        db.create_all()
        if not User.query.first():
            u = User(username="demo", email="demo@example.com")
            u.set_password("demo1234")
            db.session.add(u)
            db.session.commit()
            print("Seeded demo user: demo / demo1234")
        print("Initialized DB and ensured 'users' table exists.")
