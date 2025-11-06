@echo off
setlocal
cd /d %~dp0
set FLASK_ENV=development
set SKIP_DB=0
if exist .\.venv\Scripts\python.exe (
	.\.venv\Scripts\python.exe app.py
	goto :eof
) else if exist .\venv\Scripts\python.exe (
	.\venv\Scripts\python.exe app.py
	goto :eof
) else (
	echo Could not find .venv or venv. Please create a virtual environment and install requirements.
	echo Example:
	echo   python -m venv .venv
	echo   .\.venv\Scripts\pip install -r requirements.txt
)
endlocal
