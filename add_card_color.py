from config import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    try:
        # Add card_color column to tasks table
        with db.engine.connect() as conn:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN card_color VARCHAR(7) DEFAULT '#fecaca'"))
            conn.commit()
        print("✅ Successfully added card_color column to tasks table!")
    except Exception as e:
        print(f"Note: {e}")
        print("Column might already exist or migration not needed.")
