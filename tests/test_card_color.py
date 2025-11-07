import unittest
from flask import json
from app import app
from models import db
from datetime import datetime


class TestCardColorPersistence(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///test.db'
        self.client = app.test_client()
        with app.app_context():
            db.create_all()

    def tearDown(self):
        with app.app_context():
            db.session.remove()
            db.drop_all()

    def test_card_color_persisted_on_create_and_returned(self):
        """Create a task with a card_color and ensure API returns it"""
        payload = {
            'title': 'Color Test Task',
            'card_color': '#abcdef'
        }

        response = self.client.post('/api/tasks', data=json.dumps(payload), content_type='application/json')
        data = json.loads(response.data)

        # Created
        self.assertEqual(response.status_code, 201)
        self.assertTrue(data.get('success'))
        task = data.get('task')
        self.assertIsNotNone(task)
        # card_color should be present and match
        self.assertIn('card_color', task)
        self.assertEqual(task['card_color'].lower(), payload['card_color'].lower())

        # Also GET the task by id and confirm the field is present
        task_id = task.get('id')
        self.assertIsNotNone(task_id)

        get_resp = self.client.get(f'/api/tasks/{task_id}')
        self.assertEqual(get_resp.status_code, 200)
        get_data = json.loads(get_resp.data)
        self.assertTrue(get_data.get('success'))
        fetched = get_data.get('task')
        self.assertIsNotNone(fetched)
        self.assertIn('card_color', fetched)
        self.assertEqual(fetched['card_color'].lower(), payload['card_color'].lower())


if __name__ == '__main__':
    unittest.main()
