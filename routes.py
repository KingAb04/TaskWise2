from flask import request, jsonify, render_template, session, redirect, url_for, flash
from config import db
from models import Task, Project, TaskStatus, Priority, User, Subtask, Activity
from datetime import datetime
import json
import os
from types import SimpleNamespace

def register_routes(app):
    skip_db = os.getenv('SKIP_DB') == '1'
    # In-memory idempotency map for task creation: client_token -> task (or task id)
    # This prevents duplicate tasks when client retries/create is called multiple times.
    idempotency_map = {}
    # Helper utilities for in-memory session-backed dev data when SKIP_DB is enabled
    def _ensure_dev_data():
        """Ensure that session has sample projects and tasks for dev mode."""
        if 'dev_tasks' not in session:
            now = datetime.utcnow().isoformat() + 'Z'
            session.setdefault('dev_projects', [
                {'id': 1, 'name': 'Sample Project', 'description': 'Dev project', 'color': '#667eea'}
            ])
            session.setdefault('dev_tasks', [
                {
                    'id': 1,
                    'title': 'Sample Task',
                    'description': 'This is a sample task to get you started.',
                    'status': 'todo',
                    'priority': 'medium',
                    'project_id': 1,
                    'progress': 0,
                    'due_date': None,
                    'created_at': now,
                    'updated_at': now
                }
            ])

    def _get_dev_tasks():
        _ensure_dev_data()
        return session.get('dev_tasks', [])

    def _save_dev_tasks(tasks):
        session['dev_tasks'] = tasks

    def _next_dev_task_id():
        tasks = _get_dev_tasks()
        return max((t.get('id', 0) for t in tasks), default=0) + 1

    def _get_dev_projects():
        _ensure_dev_data()
        return session.get('dev_projects', [])

    def _save_dev_projects(projects):
        session['dev_projects'] = projects

    # Simple login_required decorator
    def login_required(fn):
        from functools import wraps
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not session.get('user_id'):
                return redirect(url_for('login'))
            return fn(*args, **kwargs)
        return wrapper

    # Inject current_user into all templates
    @app.context_processor
    def inject_user():
        user = None
        if session.get('user_id'):
            # If running in SKIP_DB mode, create a lightweight user object from session
            if skip_db:
                username = session.get('username', 'Dev')
                email = session.get('email', 'dev@local')
                user = SimpleNamespace(id=session.get('user_id'), username=username, email=email)
            else:
                try:
                    user = User.query.get(session.get('user_id'))
                except Exception:
                    user = None
        return {'current_user': user}

    # Authentication routes
    @app.route('/register', methods=['GET', 'POST'])
    def register():
        if request.method == 'GET':
            return render_template('register.html')
        # POST: create user
        data = request.form
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        if not username or not email or not password:
            flash('All fields are required', 'error')
            return redirect(url_for('register'))

        # If SKIP_DB is enabled, don't try to write to the database — store a lightweight user in session
        if skip_db:
            session['user_id'] = 1
            session['username'] = username
            session['email'] = email
            flash('Account created (dev mode) and logged in', 'success')
            return redirect(url_for('dashboard'))

        # Check if user exists
        if User.query.filter((User.email == email) | (User.username == username)).first():
            flash('User with that email or username already exists', 'error')
            return redirect(url_for('register'))

        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        session['user_id'] = user.id
        flash('Account created and logged in', 'success')
        return redirect(url_for('dashboard'))

    @app.route('/login', methods=['GET', 'POST'])
    def login():
        if request.method == 'GET':
            return render_template('login.html')
        data = request.form
        identifier = data.get('identifier')  # username or email
        password = data.get('password')

        # If SKIP_DB is enabled, accept any credentials and store user info in session
        if skip_db:
            session['user_id'] = 1
            # store username/email for template usage
            if '@' in (identifier or ''):
                session['email'] = identifier
                session['username'] = identifier.split('@')[0]
            else:
                session['username'] = identifier
                session['email'] = f"{identifier}@local"
            flash('Logged in (dev mode)', 'success')
            return redirect(url_for('dashboard'))

        user = None
        if '@' in (identifier or ''):
            user = User.query.filter_by(email=identifier).first()
        else:
            user = User.query.filter_by(username=identifier).first()

        if not user or not user.check_password(password):
            flash('Invalid credentials', 'error')
            return redirect(url_for('login'))

        session['user_id'] = user.id
        flash('Logged in successfully', 'success')
        return redirect(url_for('dashboard'))

    @app.route('/logout')
    def logout():
        session.pop('user_id', None)
        session.pop('username', None)
        session.pop('email', None)
        session.clear()  # Clear all flash messages
        flash('Logged out successfully', 'success')
        return redirect(url_for('login'))
    
    # Dashboard route - serve the main page
    @app.route('/')
    @login_required
    def dashboard():
        return render_template('index.html')
        
    @app.route('/focus')
    @app.route('/focus')
    @login_required
    def focus():
        """Serve the Pomodoro focus timer page"""
        return render_template('focus.html')
        
    @app.route('/tasks')
    @login_required
    def tasks():
        """Serve the All Tasks page"""
        return render_template('tasks.html')

    @app.route('/calendar')
    @login_required
    def calendar():
        """Serve the Calendar page"""
        return render_template('calendar.html')

    @app.route('/analytics')
    @login_required
    def analytics():
        """Serve the Analytics page (placeholder)"""
        # If there's no dedicated analytics template, reuse a simple page
        try:
            return render_template('analytics.html')
        except Exception:
            # Fallback: render dashboard if analytics template missing
            return render_template('index.html')

    # API Routes for Tasks
    @app.route('/api/tasks', methods=['GET'])
    def get_tasks():
        """Get all tasks with optional filtering"""
        try:
            if skip_db:
                # Use session-backed dev tasks
                tasks = _get_dev_tasks()
                # Apply simple filtering
                status = request.args.get('status')
                priority = request.args.get('priority')
                project_id = request.args.get('project_id')

                def match(t):
                    if status and t.get('status') != status:
                        return False
                    if priority and t.get('priority') != priority:
                        return False
                    if project_id and str(t.get('project_id')) != str(project_id):
                        return False
                    return True

                filtered = [t for t in tasks if match(t)]
                # sort by created_at desc if available
                try:
                    filtered.sort(key=lambda x: x.get('created_at') or '', reverse=True)
                except Exception:
                    pass
                return jsonify({'success': True, 'tasks': filtered, 'count': len(filtered)})

            # DB-backed path
            # Get query parameters
            status = request.args.get('status')
            priority = request.args.get('priority')
            project_id = request.args.get('project_id')
            
            # Build query
            query = Task.query
            if status:
                query = query.filter(Task.status == TaskStatus(status))
            if priority:
                query = query.filter(Task.priority == Priority(priority))
            if project_id:
                query = query.filter(Task.project_id == project_id)
            
            # Order by created_at desc
            tasks = query.order_by(Task.created_at.desc()).all()
            
            return jsonify({'success': True, 'tasks': [task.to_dict() for task in tasks], 'count': len(tasks)})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/activity', methods=['GET'])
    def get_activity():
        try:
            limit = int(request.args.get('limit', 50))
            if skip_db:
                logs = session.get('activity_log', [])
                return jsonify({'success': True, 'activities': logs[:limit]})
            acts = Activity.query.order_by(Activity.created_at.desc()).limit(limit).all()
            return jsonify({'success': True, 'activities': [a.to_dict() for a in acts]})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/tasks', methods=['POST'])
    def create_task():
        """Create a new task"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({'success': False, 'error': 'Invalid payload'}), 400
            # idempotency: if client provided a client_token and we've already processed it,
            # return the previous result to avoid duplicates
            client_token = data.get('client_token')
            if client_token:
                prev = idempotency_map.get(client_token)
                if prev:
                    # prev may be a dict (dev) or a task id (db)
                    if skip_db:
                        return jsonify({'success': True, 'message': 'Task created (dev, idempotent)', 'task': prev}), 200
                    else:
                        # return the stored task representation if we cached it, else fetch from DB by id
                        if isinstance(prev, dict):
                            return jsonify({'success': True, 'message': 'Task created (idempotent)', 'task': prev}), 200
                        else:
                            try:
                                task = Task.query.get(int(prev))
                                if task:
                                    return jsonify({'success': True, 'message': 'Task created (idempotent)', 'task': task.to_dict()}), 200
                            except Exception:
                                pass
            # Validate required fields
            if not data.get('title'):
                return jsonify({'success': False, 'error': 'Title is required'}), 400

            if skip_db:
                tasks = _get_dev_tasks()
                now = datetime.utcnow().isoformat() + 'Z'
                task = {
                    'id': _next_dev_task_id(),
                    'title': data['title'],
                    'description': data.get('description', ''),
                    'priority': data.get('priority', 'medium'),
                    'project_id': data.get('project_id'),
                    'progress': data.get('progress', 0),
                    'status': data.get('status', 'todo'),
                    'due_date': data.get('due_date'),
                    'card_color': data.get('card_color', '#fecaca'),
                    'created_at': now,
                    'updated_at': now
                }
                tasks.append(task)
                # record activity in dev session
                notifs = session.get('activity_log', [])
                notifs.insert(0, {
                    'id': len(notifs) + 1,
                    'event_type': 'task_created',
                    'message': f"Task created: {task['title']}",
                    'task_id': task['id'],
                    'created_at': now
                })
                session['activity_log'] = notifs
                # store idempotency mapping for dev mode
                if client_token:
                    try:
                        idempotency_map[client_token] = task
                    except Exception:
                        pass
                _save_dev_tasks(tasks)
                return jsonify({'success': True, 'message': 'Task created (dev)', 'task': task}), 201

            # DB-backed path
            task = Task(
                title=data['title'],
                description=data.get('description', ''),
                priority=Priority(data.get('priority', 'medium')),
                project_id=data.get('project_id'),
                progress=data.get('progress', 0),
                card_color=data.get('card_color', '#fecaca')
            )
            if data.get('due_date'):
                task.due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
            db.session.add(task)
            db.session.commit()
            # record activity in DB
            try:
                act = Activity(event_type='task_created', message=f"Task created: {task.title}", task_id=task.id)
                db.session.add(act)
                db.session.commit()
            except Exception:
                db.session.rollback()
            # record idempotency mapping for DB-backed mode
            if client_token:
                try:
                    idempotency_map[client_token] = task.id
                except Exception:
                    pass
            return jsonify({'success': True, 'message': 'Task created successfully', 'task': task.to_dict()}), 201
        except Exception as e:
            if not skip_db:
                db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/tasks/<int:task_id>', methods=['GET'])
    def get_task(task_id):
        """Get a specific task"""
        try:
            if skip_db:
                tasks = _get_dev_tasks()
                for t in tasks:
                    if int(t.get('id')) == int(task_id):
                        return jsonify({'success': True, 'task': t})
                return jsonify({'success': False, 'error': 'Not found'}), 404

            task = Task.query.get_or_404(task_id)
            return jsonify({'success': True, 'task': task.to_dict()})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/tasks/<int:task_id>', methods=['PUT'])
    def update_task(task_id):
        """Update a task"""
        try:
            data = request.get_json() or {}
            if skip_db:
                tasks = _get_dev_tasks()
                found = False
                for t in tasks:
                    if int(t.get('id')) == int(task_id):
                        found = True
                        # Update allowed fields
                        for field in ('title', 'description', 'status', 'priority', 'progress', 'project_id', 'due_date', 'card_color'):
                            if field in data:
                                t[field] = data[field]
                        t['updated_at'] = datetime.utcnow().isoformat() + 'Z'
                        break
                if not found:
                    return jsonify({'success': False, 'error': 'Not found'}), 404
                _save_dev_tasks(tasks)
                # record activity in dev session
                notifs = session.get('activity_log', [])
                now = datetime.utcnow().isoformat() + 'Z'
                notifs.insert(0, {
                    'id': len(notifs) + 1,
                    'event_type': 'task_updated',
                    'message': f"Task updated: {t.get('title')}",
                    'task_id': t.get('id'),
                    'created_at': now
                })
                session['activity_log'] = notifs
                return jsonify({'success': True, 'message': 'Task updated (dev)', 'task': t})

            task = Task.query.get_or_404(task_id)
            # Update fields
            if 'title' in data:
                task.title = data['title']
            if 'description' in data:
                task.description = data['description']
            if 'status' in data:
                task.status = TaskStatus(data['status'])
                if data['status'] == 'completed':
                    task.mark_completed()
            if 'priority' in data:
                task.priority = Priority(data['priority'])
            if 'progress' in data:
                task.progress = data['progress']
            if 'project_id' in data:
                task.project_id = data['project_id']
            if 'card_color' in data:
                task.card_color = data['card_color']
            if 'due_date' in data:
                if data['due_date']:
                    task.due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
                else:
                    task.due_date = None
            task.updated_at = datetime.utcnow()
            db.session.commit()
            # record activity
            try:
                act = Activity(event_type='task_updated', message=f"Task updated: {task.title}", task_id=task.id)
                db.session.add(act)
                db.session.commit()
            except Exception:
                db.session.rollback()
            return jsonify({'success': True, 'message': 'Task updated successfully', 'task': task.to_dict()})
        except Exception as e:
            if not skip_db:
                db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
    def delete_task(task_id):
        """Delete a task"""
        try:
            if skip_db:
                tasks = _get_dev_tasks()
                new_tasks = [t for t in tasks if int(t.get('id')) != int(task_id)]
                if len(new_tasks) == len(tasks):
                    return jsonify({'success': False, 'error': 'Not found'}), 404
                # record activity
                now = datetime.utcnow().isoformat() + 'Z'
                notifs = session.get('activity_log', [])
                notifs.insert(0, {
                    'id': len(notifs) + 1,
                    'event_type': 'task_deleted',
                    'message': f"Task deleted: {task_id}",
                    'task_id': task_id,
                    'created_at': now
                })
                session['activity_log'] = notifs
                _save_dev_tasks(new_tasks)
                return jsonify({'success': True, 'message': 'Task deleted (dev)'})

            task = Task.query.get_or_404(task_id)
            db.session.delete(task)
            db.session.commit()
            # record activity
            try:
                act = Activity(event_type='task_deleted', message=f"Task deleted: {task.title}", task_id=task.id)
                db.session.add(act)
                db.session.commit()
            except Exception:
                db.session.rollback()
            return jsonify({'success': True, 'message': 'Task deleted successfully'})
        except Exception as e:
            if not skip_db:
                db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    # API Routes for Projects
    @app.route('/api/projects', methods=['GET'])  
    def get_projects():
        """Get all projects"""
        try:
            if skip_db:
                projects = _get_dev_projects()
                return jsonify({'success': True, 'projects': projects, 'count': len(projects)})

            projects = Project.query.order_by(Project.name).all()
            return jsonify({'success': True, 'projects': [project.to_dict() for project in projects], 'count': len(projects)})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/projects', methods=['POST'])
    def create_project():
        """Create a new project"""
        try:
            data = request.get_json()
            if not data or not data.get('name'):
                return jsonify({'success': False, 'error': 'Project name is required'}), 400

            if skip_db:
                projects = _get_dev_projects()
                new_id = max((p.get('id', 0) for p in projects), default=0) + 1
                project = {'id': new_id, 'name': data['name'], 'description': data.get('description', ''), 'color': data.get('color', '#667eea')}
                projects.append(project)
                _save_dev_projects(projects)
                return jsonify({'success': True, 'message': 'Project created (dev)', 'project': project}), 201

            project = Project(name=data['name'], description=data.get('description', ''), color=data.get('color', '#667eea'))
            db.session.add(project)
            db.session.commit()
            return jsonify({'success': True, 'message': 'Project created successfully', 'project': project.to_dict()}), 201
        except Exception as e:
            if not skip_db:
                db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/projects/<int:project_id>', methods=['PUT'])
    def update_project(project_id):
        """Update an existing project"""
        try:
            data = request.get_json() or {}
            if skip_db:
                projects = _get_dev_projects()
                found = False
                for p in projects:
                    if int(p.get('id')) == int(project_id):
                        found = True
                        p['name'] = data.get('name', p.get('name'))
                        p['description'] = data.get('description', p.get('description'))
                        p['color'] = data.get('color', p.get('color'))
                        break
                if not found:
                    return jsonify({'success': False, 'error': 'Not found'}), 404
                _save_dev_projects(projects)
                return jsonify({'success': True, 'message': 'Project updated (dev)', 'project': next((x for x in projects if int(x.get("id"))==int(project_id)), None)})

            project = Project.query.get_or_404(project_id)
            if 'name' in data:
                project.name = data['name']
            if 'description' in data:
                project.description = data['description']
            if 'color' in data:
                project.color = data['color']
            db.session.commit()
            return jsonify({'success': True, 'message': 'Project updated successfully', 'project': project.to_dict()})
        except Exception as e:
            if not skip_db:
                db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/projects/<int:project_id>', methods=['DELETE'])
    def delete_project(project_id):
        """Delete a project and disassociate its tasks"""
        try:
            if skip_db:
                projects = _get_dev_projects()
                new_projects = [p for p in projects if int(p.get('id')) != int(project_id)]
                if len(new_projects) == len(projects):
                    return jsonify({'success': False, 'error': 'Not found'}), 404
                # Remove project and set tasks' project_id to None
                tasks = _get_dev_tasks()
                for t in tasks:
                    if int(t.get('project_id') or 0) == int(project_id):
                        t['project_id'] = None
                _save_dev_projects(new_projects)
                _save_dev_tasks(tasks)
                return jsonify({'success': True, 'message': 'Project deleted (dev)'})

            project = Project.query.get_or_404(project_id)
            # Disassociate tasks instead of cascading delete
            Task.query.filter(Task.project_id == project_id).update({Task.project_id: None})
            db.session.delete(project)
            db.session.commit()
            return jsonify({'success': True, 'message': 'Project deleted successfully'})
        except Exception as e:
            if not skip_db:
                db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    # Dashboard Statistics API
    @app.route('/api/stats', methods=['GET'])
    def get_dashboard_stats():
        """Get dashboard statistics"""
        try:
            if skip_db:
                tasks = _get_dev_tasks()
                total_tasks = len(tasks)
                completed_tasks = len([t for t in tasks if t.get('status') == 'completed'])
                in_progress_tasks = len([t for t in tasks if t.get('status') == 'in_progress'])
                overdue_tasks = 0
                now = datetime.utcnow()
                for t in tasks:
                    due = t.get('due_date')
                    if due:
                        try:
                            dt = datetime.fromisoformat(due.replace('Z', '+00:00'))
                            if dt < now and t.get('status') != 'completed':
                                overdue_tasks += 1
                        except Exception:
                            pass
                completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
                return jsonify({'success': True, 'stats': {'total_tasks': total_tasks, 'completed_tasks': completed_tasks, 'in_progress_tasks': in_progress_tasks, 'overdue_tasks': overdue_tasks, 'completion_rate': round(completion_rate, 1), 'todo_tasks': total_tasks - completed_tasks - in_progress_tasks}})

            total_tasks = Task.query.count()
            completed_tasks = Task.query.filter(Task.status == TaskStatus.COMPLETED).count()
            in_progress_tasks = Task.query.filter(Task.status == TaskStatus.IN_PROGRESS).count()
            overdue_tasks = Task.query.filter(Task.due_date < datetime.utcnow(), Task.status != TaskStatus.COMPLETED).count()
            completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
            return jsonify({'success': True, 'stats': {'total_tasks': total_tasks, 'completed_tasks': completed_tasks, 'in_progress_tasks': in_progress_tasks, 'overdue_tasks': overdue_tasks, 'completion_rate': round(completion_rate, 1), 'todo_tasks': total_tasks - completed_tasks - in_progress_tasks}})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    # Recent tasks for dashboard
    @app.route('/api/tasks/recent', methods=['GET'])
    def get_recent_tasks():
        """Get recent tasks for dashboard"""
        try:
            limit = request.args.get('limit', 6, type=int)
            if skip_db:
                tasks = _get_dev_tasks()
                # sort by updated_at desc
                try:
                    tasks_sorted = sorted(tasks, key=lambda x: x.get('updated_at') or '', reverse=True)
                except Exception:
                    tasks_sorted = tasks
                return jsonify({'success': True, 'tasks': tasks_sorted[:limit]})

            tasks = Task.query.order_by(Task.updated_at.desc()).limit(limit).all()
            return jsonify({'success': True, 'tasks': [task.to_dict() for task in tasks]})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    # Simple notifications API (stored in session for demo)
    @app.route('/api/notifications', methods=['GET'])
    def get_notifications():
        try:
            notifs = session.get('notifications')
            if not notifs:
                # seed some sample notifications
                now = datetime.utcnow().isoformat() + 'Z'
                notifs = [
                    {'id': 1, 'title': 'Welcome to TaskWise', 'message': 'Thanks for joining TaskWise — get productive!', 'read': False, 'time': now},
                    {'id': 2, 'title': 'Sample Task Added', 'message': 'We created a sample task to get you started.', 'read': False, 'time': now}
                ]
                session['notifications'] = notifs
            return jsonify({'success': True, 'notifications': session.get('notifications', [])})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/notifications/mark_read', methods=['POST'])
    def mark_notification_read():
        try:
            data = request.get_json() or {}
            nid = data.get('id')
            if not nid:
                return jsonify({'success': False, 'error': 'id required'}), 400
            notifs = session.get('notifications', [])
            for n in notifs:
                if n.get('id') == nid:
                    n['read'] = True
            session['notifications'] = notifs
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    # ============ SUBTASK ROUTES ============
    
    @app.route('/api/tasks/<int:task_id>/subtasks', methods=['GET'])
    def get_subtasks(task_id):
        """Get all subtasks for a task"""
        try:
            if skip_db:
                # Dev mode - return from session
                subtasks = session.get(f'subtasks_{task_id}', [])
                return jsonify({'success': True, 'subtasks': subtasks})
            
            from models import Subtask
            task = Task.query.get_or_404(task_id)
            subtasks = Subtask.query.filter_by(parent_task_id=task_id).order_by(Subtask.order).all()
            return jsonify({'success': True, 'subtasks': [s.to_dict() for s in subtasks]})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/tasks/<int:task_id>/subtasks', methods=['POST'])
    def create_subtask(task_id):
        """Create a new subtask"""
        try:
            data = request.get_json()
            if not data or not data.get('title'):
                return jsonify({'success': False, 'error': 'Title is required'}), 400
            
            if skip_db:
                # Dev mode
                subtasks = session.get(f'subtasks_{task_id}', [])
                new_id = max([s.get('id', 0) for s in subtasks], default=0) + 1
                subtask = {
                    'id': new_id,
                    'task_id': task_id,
                    'title': data['title'],
                    'completed': False,
                    'order': len(subtasks),
                    'created_at': datetime.utcnow().isoformat() + 'Z'
                }
                subtasks.append(subtask)
                session[f'subtasks_{task_id}'] = subtasks
                # record activity
                now = datetime.utcnow().isoformat() + 'Z'
                notifs = session.get('activity_log', [])
                notifs.insert(0, {
                    'id': len(notifs) + 1,
                    'event_type': 'subtask_created',
                    'message': f"Subtask created for task {task_id}: {subtask['title']}",
                    'task_id': task_id,
                    'created_at': now
                })
                session['activity_log'] = notifs
                return jsonify({'success': True, 'subtask': subtask}), 201
            
            task = Task.query.get_or_404(task_id)
            
            # Create subtask by setting attributes directly
            subtask = Subtask()
            subtask.parent_task_id = task_id
            subtask.title = data['title']
            subtask.order = len(task.subtasks)
            
            db.session.add(subtask)
            db.session.commit()
            
            # Update task progress based on subtasks
            update_task_progress_from_subtasks(task)
            # record activity
            try:
                act = Activity(event_type='subtask_created', message=f"Subtask created for task {task.id}: {subtask.title}", task_id=task.id)
                db.session.add(act)
                db.session.commit()
            except Exception:
                db.session.rollback()
            
            return jsonify({'success': True, 'subtask': subtask.to_dict()}), 201
        except Exception as e:
            if not skip_db:
                db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/subtasks/<int:subtask_id>/toggle', methods=['PUT'])
    def toggle_subtask(subtask_id):
        """Toggle subtask completion status"""
        try:
            if skip_db:
                # Dev mode
                for key in session.keys():
                    if key.startswith('subtasks_'):
                        subtasks = session[key]
                        for s in subtasks:
                            if s.get('id') == subtask_id:
                                s['completed'] = not s.get('completed', False)
                                if s['completed']:
                                    s['completed_at'] = datetime.utcnow().isoformat() + 'Z'
                                else:
                                    s['completed_at'] = None
                                session[key] = subtasks
                                # record activity
                                now = datetime.utcnow().isoformat() + 'Z'
                                notifs = session.get('activity_log', [])
                                notifs.insert(0, {
                                    'id': len(notifs) + 1,
                                    'event_type': 'subtask_toggled',
                                    'message': f"Subtask toggled for task {s.get('task_id')}: {s.get('title')}",
                                    'task_id': s.get('task_id'),
                                    'created_at': now
                                })
                                session['activity_log'] = notifs
                                return jsonify({'success': True, 'subtask': s})
                return jsonify({'success': False, 'error': 'Subtask not found'}), 404
            
            subtask = Subtask.query.get_or_404(subtask_id)
            subtask.toggle_completed()
            db.session.commit()
            
            # Update task progress
            task = Task.query.get(subtask.parent_task_id)
            if task:
                update_task_progress_from_subtasks(task)
            # record activity
            try:
                act = Activity(event_type='subtask_toggled', message=f"Subtask toggled for task {subtask.parent_task_id}: {subtask.title}", task_id=subtask.parent_task_id)
                db.session.add(act)
                db.session.commit()
            except Exception:
                db.session.rollback()

            return jsonify({'success': True, 'subtask': subtask.to_dict()})
        except Exception as e:
            if not skip_db:
                db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/subtasks/<int:subtask_id>', methods=['DELETE'])
    def delete_subtask(subtask_id):
        """Delete a subtask"""
        try:
            if skip_db:
                # Dev mode
                for key in session.keys():
                    if key.startswith('subtasks_'):
                        subtasks = session[key]
                        session[key] = [s for s in subtasks if s.get('id') != subtask_id]
                return jsonify({'success': True})
            
            subtask = Subtask.query.get_or_404(subtask_id)
            task_id = subtask.parent_task_id
            db.session.delete(subtask)
            db.session.commit()
            
            # Update task progress
            task = Task.query.get(task_id)
            if task:
                update_task_progress_from_subtasks(task)
            
            return jsonify({'success': True})
        except Exception as e:
            if not skip_db:
                db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    def update_task_progress_from_subtasks(task):
        """Update task progress based on completed subtasks"""
        if not skip_db:
            subtask_count = len(task.subtasks)
            if subtask_count > 0:
                completed_count = sum(1 for s in task.subtasks if s.completed)
                task.progress = int((completed_count / subtask_count) * 100)
                db.session.commit()