import os
from config import create_app, db

app = create_app()


def start_app():
    """Start the Flask app. If SKIP_DB=1 in the environment, skip creating DB tables.

    This is useful for local development when MySQL is not configured yet.
    """
    skip_db = os.getenv('SKIP_DB') == '1'
    if not skip_db:
        try:
            with app.app_context():
                db.create_all()
        except Exception as e:
            # Log the error and re-raise so the developer sees the traceback
            print(f"Error creating database tables: {e}")
            raise

    app.run(debug=True, host='127.0.0.1', port=5000)


if __name__ == '__main__':
    start_app()