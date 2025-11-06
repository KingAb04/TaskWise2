import unittest
from models import Task, Project, TaskStatus, Priority
from datetime import datetime, timedelta

class TestModels(unittest.TestCase):
    def test_task_creation(self):
        """Test task model creation and defaults"""
        task = Task(title='Test Task')
        
        self.assertEqual(task.title, 'Test Task')
        self.assertEqual(task.status, TaskStatus.TODO)
        self.assertEqual(task.priority, Priority.MEDIUM)
        self.assertEqual(task.progress, 0)
        self.assertIsNone(task.due_date)
        self.assertIsNone(task.completed_at)
        self.assertEqual(task.time_spent, 0)

    def test_task_completion(self):
        """Test task completion functionality"""
        task = Task(title='Test Task')
        task.mark_completed()

        self.assertEqual(task.status, TaskStatus.COMPLETED)
        self.assertEqual(task.progress, 100)
        self.assertIsNotNone(task.completed_at)
        self.assertIsNotNone(task.updated_at)

    def test_task_overdue(self):
        """Test overdue task detection"""
        past_date = datetime.utcnow() - timedelta(days=1)
        task = Task(
            title='Test Task',
            due_date=past_date
        )
        self.assertTrue(task.is_overdue())

        # Completed tasks should not be overdue
        task.mark_completed()
        self.assertFalse(task.is_overdue())

        # Future tasks should not be overdue
        future_task = Task(
            title='Future Task',
            due_date=datetime.utcnow() + timedelta(days=1)
        )
        self.assertFalse(future_task.is_overdue())

    def test_project_creation(self):
        """Test project model creation"""
        project = Project(
            name='Test Project',
            description='Test Description',
            color='#667eea'
        )

        self.assertEqual(project.name, 'Test Project')
        self.assertEqual(project.color, '#667eea')
        self.assertIsNotNone(project.created_at)
        self.assertIsNotNone(project.updated_at)

    def test_task_progress_calculation(self):
        """Test task progress calculation logic"""
        task = Task(title='Test Task', estimated_hours=10)
        
        # Test progress based on time spent
        task.time_spent = 5
        self.assertEqual(task.calculate_task_progress(), 50)
        
        # Test completed task
        task.mark_completed()
        self.assertEqual(task.calculate_task_progress(), 100)
        
        # Test todo task
        new_task = Task(title='New Task')
        new_task.status = TaskStatus.TODO
        self.assertEqual(new_task.calculate_task_progress(), 0)
        
        # Test task without estimated hours
        no_estimate = Task(title='No Estimate')
        no_estimate.status = TaskStatus.IN_PROGRESS
        self.assertEqual(no_estimate.calculate_task_progress(), 50)

    def test_task_time_tracking(self):
        """Test task time tracking features"""
        task = Task(
            title='Time Tracked Task',
            estimated_hours=8.0
        )
        
        # Test initial values
        self.assertEqual(task.time_spent, 0)
        self.assertFalse(task.is_tracking)
        self.assertIsNone(task.last_tracked)
        
        # Test tracking fields
        task.is_tracking = True
        task.last_tracked = datetime.utcnow()
        task.time_spent = 2.5
        
        self.assertTrue(task.is_tracking)
        self.assertIsNotNone(task.last_tracked)
        self.assertEqual(task.time_spent, 2.5)

    def test_task_to_dict(self):
        """Test task serialization"""
        project = Project(name='Test Project', color='#ff0000')
        task = Task(
            title='Test Task',
            description='Test Description',
            priority=Priority.HIGH,
            progress=50,
            project=project,
            estimated_hours=8.0,
            actual_hours=4.0,
            is_tracking=True
        )

        task_dict = task.to_dict()

        self.assertEqual(task_dict['title'], 'Test Task')
        self.assertEqual(task_dict['description'], 'Test Description')
        self.assertEqual(task_dict['priority'], 'high')
        self.assertEqual(task_dict['progress'], 50)
        self.assertEqual(task_dict['project_name'], 'Test Project')
        self.assertEqual(task_dict['project_color'], '#ff0000')
        self.assertEqual(task_dict['estimated_hours'], 8.0)
        self.assertEqual(task_dict['actual_hours'], 4.0)
        self.assertTrue(task_dict['is_tracking'])

    def test_project_to_dict(self):
        """Test project serialization"""
        project = Project(
            name='Test Project',
            description='Test Description',
            color='#667eea'
        )
        task1 = Task(title='Task 1', project=project)
        task2 = Task(title='Task 2', project=project)

        project_dict = project.to_dict()

        self.assertEqual(project_dict['name'], 'Test Project')
        self.assertEqual(project_dict['description'], 'Test Description')
        self.assertEqual(project_dict['color'], '#667eea')
        self.assertEqual(project_dict['task_count'], 2)
        self.assertIsNotNone(project_dict['created_at'])
        self.assertIsNotNone(project_dict['updated_at'])

if __name__ == '__main__':
    unittest.main()