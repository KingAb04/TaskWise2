import unittest
from flask import json
from app import app
from models import db, Task, Project, TaskStatus, Priority
from datetime import datetime

class TestRoutes(unittest.TestCase):
    def setUp(self):
        """Set up test client and test database"""
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///test.db'
        self.client = app.test_client()
        with app.app_context():
            db.create_all()

    def tearDown(self):
        """Clean up after each test"""
        with app.app_context():
            db.session.remove()
            db.drop_all()

    def test_create_task(self):
        """Test task creation endpoint"""
        task_data = {
            'title': 'Test Task',
            'description': 'Test Description',
            'priority': 'medium',
            'due_date': datetime.utcnow().isoformat()
        }
        
        response = self.client.post('/api/tasks',
                                  data=json.dumps(task_data),
                                  content_type='application/json')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 201)
        self.assertTrue(data['success'])
        self.assertEqual(data['task']['title'], task_data['title'])

    def test_get_tasks(self):
        """Test retrieving tasks"""
        # Create a test task first
        with app.app_context():
            task = Task(title='Test Task', priority=Priority.MEDIUM)
            db.session.add(task)
            db.session.commit()

        response = self.client.get('/api/tasks')
        data = json.loads(response.data)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(data['success'])
        self.assertEqual(len(data['tasks']), 1)

    def test_update_task(self):
        """Test task update endpoint"""
        # Create a test task
        with app.app_context():
            task = Task(title='Original Title', priority=Priority.MEDIUM)
            db.session.add(task)
            db.session.commit()
            task_id = task.id

        update_data = {
            'title': 'Updated Title',
            'status': 'completed'
        }

        response = self.client.put(f'/api/tasks/{task_id}',
                                 data=json.dumps(update_data),
                                 content_type='application/json')
        data = json.loads(response.data)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(data['success'])
        self.assertEqual(data['task']['title'], update_data['title'])
        self.assertEqual(data['task']['status'], 'completed')

    def test_delete_task(self):
        """Test task deletion"""
        # Create a test task
        with app.app_context():
            task = Task(title='Test Task', priority=Priority.MEDIUM)
            db.session.add(task)
            db.session.commit()
            task_id = task.id

        response = self.client.delete(f'/api/tasks/{task_id}')
        data = json.loads(response.data)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(data['success'])

        # Verify task is deleted
        check_response = self.client.get(f'/api/tasks/{task_id}')
        self.assertEqual(check_response.status_code, 404)

if __name__ == '__main__':
    unittest.main()