# TaskWise Setup Instructions

## Phase 1: Basic Task Management System

### Prerequisites
1. **Python 3.8+** installed
2. **MySQL Server** running (XAMPP recommended)
3. **pip** package manager

### Installation Steps

#### 1. Setup Python Environment and Install Dependencies
```bash
# Navigate to the TaskWise directory
cd c:\xampp\htdocs\TaskWise

# The project uses a virtual environment (.venv) that's automatically configured
# Dependencies are installed automatically when you run the setup
# Required packages: Flask, Flask-SQLAlchemy, Flask-CORS, PyMySQL, python-dotenv, etc.
```

#### 2. Configure Database
1. Start XAMPP and ensure MySQL is running
2. Update `.env` file with your MySQL credentials:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=taskwise_db
   DB_PORT=3306
   ```

#### 3. Initialize Database
```bash
# Run the database setup script
python setup_db.py
```

#### 4. Start the Application
```bash
# Run the Flask application using the virtual environment
C:/xampp/htdocs/TaskWise/.venv/Scripts/python.exe app.py

# Or if you're in the virtual environment:
python app.py
```
# TaskWise — Setup & Run (Windows / XAMPP)

This document explains how to get the TaskWise project running locally on Windows using XAMPP for MySQL. It includes exact PowerShell commands, troubleshooting, and an option to run without initializing the DB (useful while you're testing UI or code changes).

## Quick checklist (recommended order)
- Install Python 3.8+ if not already installed
- Start XAMPP and ensure MySQL is running
- Create and activate the project's virtual environment
- Install Python dependencies
- Configure environment variables in `.env`
- (Optional) Initialize the database or skip DB init for quick testing
- Start the Flask app

---

## 1) Prepare your environment

Open a new PowerShell window (important — do not run MySQL client there). Run the following commands:

```powershell
cd C:\xampp\htdocs\TaskWise-main
# Create venv (if not already present)
python -m venv venv

# Allow activate script for this session (temporary)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# Activate the virtualenv
.\venv\Scripts\Activate.ps1

# Install dependencies
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

If you prefer Command Prompt (cmd.exe) instead of PowerShell, activate with:

```cmd
venv\Scripts\activate.bat
```

---

## 2) Configure environment variables

Edit the project's `.env` file (project root) to match your MySQL/XAMPP setup. Example:

```
FLASK_APP=app.py
FLASK_ENV=development
SECRET_KEY=dev-secret-key
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=taskwise
```

By default XAMPP's MySQL uses `root` with an empty password. Change these values for your environment.

---

## 3a) (Recommended) Initialize the database

If you want the database and sample data created automatically (recommended), run:

```powershell
.\venv\Scripts\python.exe reset_db.py
```

This script will create the DB tables and insert sample data (it uses the `.env` values).

If reset_db.py fails due to MySQL connection errors, ensure MySQL is running in the XAMPP Control Panel and that `.env` credentials are correct.

---

## 3b) (Optional) Run without initializing DB

If you only want to start the server for UI/JS testing and avoid DB errors while MySQL isn't configured, temporarily start the app without calling `db.create_all()`.

Option A — set an environment flag before starting (recommended when you don't want to edit files):

```powershell
$env:SKIP_DB = '1'
.\venv\Scripts\python.exe app.py
```

Then, edit `app.py` to respect `SKIP_DB` (one-time edit) if you prefer a permanent safe-start path. Example change in `app.py`:

```python
import os
from config import create_app, db

app = create_app()

if __name__ == '__main__':
   if os.getenv('SKIP_DB') != '1':
      with app.app_context():
         db.create_all()
   app.run(debug=True, host='127.0.0.1', port=5000)
```

If you'd like, I can apply that small change for you.

---

## 4) Start the Flask app

With venv activated (PowerShell):

```powershell
# recommended (uses the venv python explicitly)
.\venv\Scripts\python.exe app.py
```

Or using `flask run` after activation:

```powershell
$env:FLASK_APP = 'app.py'
$env:FLASK_ENV = 'development'
flask run
```

Successful startup will show lines like:

- "* Serving Flask app 'config'"
- "* Running on http://127.0.0.1:5000"

Then open your browser to: http://127.0.0.1:5000

---

## 5) Troubleshooting (common causes of ERR_CONNECTION_REFUSED)

- You are accidentally in the MySQL client instead of PowerShell — exit MySQL client by typing `exit`.
- The Flask process is not running. Check running Python processes:

```powershell
Get-Process -Name python -ErrorAction SilentlyContinue | Format-Table Id,ProcessName,StartTime,Path
Get-NetTCPConnection -LocalPort 5000 | Select-Object LocalAddress,LocalPort,State,OwningProcess
Test-NetConnection -ComputerName 127.0.0.1 -Port 5000
```

- MySQL connection errors on startup (traceback referencing `pymysql` or `sqlalchemy`) — ensure XAMPP MySQL is running and `.env` values are correct, then run `reset_db.py`.
- PowerShell execution policy blocking activation — use `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in the current session.
- Firewall blocking (rare for localhost): allow `python.exe` or open port 5000 for private networks in Windows Defender Firewall.

If you see a traceback in the terminal, copy the first 20 lines here and I will diagnose it.

---

## 6) Quick verification checklist

1. In a fresh PowerShell window run:

```powershell
cd C:\xampp\htdocs\TaskWise-main
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
.\venv\Scripts\python.exe reset_db.py    # optional, to create DB
.\venv\Scripts\python.exe app.py
```

2. Open http://127.0.0.1:5000 in your browser

3. If the page doesn't load, paste the terminal output here (the first 30 lines) and I'll continue troubleshooting.

---

If you'd like, I can:
- Edit `app.py` to add the `SKIP_DB` option so the app starts without DB initialization, or
- Run the necessary commands in this environment to start the server and report back the output.

Tell me which you'd prefer (apply SKIP_DB change or start the server now) and I'll proceed.
