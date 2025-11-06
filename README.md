# TaskWise

TaskWise is a task management app built with Flask, SQLAlchemy, and modern web technologies (HTML/CSS/JS).

## Quick start (SQLite, no external DB)

This project now supports a zero-config SQLite fallback so you can get a login-ready database without installing MySQL.

1) Create a virtual environment and install dependencies (Windows cmd):

```
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
```

2) Create the database and seed a demo user:

```
.\.venv\Scripts\python init_login_db.py
```

This creates a `taskwise.db` file and a demo user: `demo / demo1234`.

3) Run the app (DB enabled):

```
.\start_db.cmd
```

Open http://127.0.0.1:5000 and log in.

## MySQL setup (optional)

If you prefer MySQL, copy `.env.example` to `.env` and fill in your credentials. Either set `DATABASE_URL` or the discrete `DB_*` variables.

Create the database and sample data:

```
.\.venv\Scripts\python setup_db.py
```

Then start with DB enabled:

```
.\start_db.cmd
```

## Notes

- To run without a database (for quick UI demo), use `start_dev.cmd`.
- Registration and login routes are implemented at `/register` and `/login`.
- The app will automatically create tables on startup when DB is enabled.
