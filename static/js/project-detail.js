// Project Detail Page - loads project data and tasks
document.addEventListener('DOMContentLoaded', async function() {
  const pathParts = window.location.pathname.split('/');
  const projectId = parseInt(pathParts[pathParts.length - 1]);
  
  if (!projectId || isNaN(projectId)) {
    window.location.href = '/projects';
    return;
  }

  // Load project details
  try {
    const response = await fetch(`/api/projects/${projectId}`);
    const data = await response.json();
    
    if (data.success) {
      const project = data.project;
      document.getElementById('projectName').textContent = project.name;
      document.getElementById('projectNameBreadcrumb').textContent = project.name;
      document.getElementById('projectDescription').textContent = project.description || 'No description';
      document.getElementById('projectColorLarge').style.background = project.color || '#3b82f6';
      document.getElementById('statTotalTasks').textContent = project.total_tasks || 0;
      document.getElementById('statCompleted').textContent = project.completed_tasks || 0;
      document.getElementById('statInProgress').textContent = (project.total_tasks - project.completed_tasks) || 0;
    }
  } catch(e) {
    console.error('Error loading project:', e);
  }

  // Load tasks for this project
  try {
    const tasksResponse = await fetch('/api/tasks');
    const tasksData = await tasksResponse.json();
    
    if (tasksData.success) {
      // Filter tasks by project_id
      const projectTasks = tasksData.tasks.filter(task => task.project_id === projectId);
      
      const tasksGrid = document.getElementById('tasksGrid');
      const emptyState = document.getElementById('emptyState');
      
      if (projectTasks.length === 0) {
        tasksGrid.style.display = 'none';
        emptyState.style.display = 'flex';
      } else {
        tasksGrid.style.display = 'grid';
        emptyState.style.display = 'none';
        
        // Display tasks
        tasksGrid.innerHTML = projectTasks.map(task => createTaskCard(task)).join('');
        
        // Add event listeners to task cards
        attachTaskEventListeners();
      }
    }
  } catch(e) {
    console.error('Error loading tasks:', e);
  }

  // Add task button handler
  document.getElementById('addTaskBtn').addEventListener('click', () => {
    // Use taskwise modal if available
    if (window.taskWise && window.taskWise.showTaskModal) {
      // Store the default project ID
      window.taskWise.defaultProjectId = projectId;
      
      // Store original createTask to intercept success
      const originalCreateTask = window.taskWise.createTask.bind(window.taskWise);
      window.taskWise.createTask = async function(taskData) {
        const result = await originalCreateTask(taskData);
        // Reload the page to show the new task
        window.location.reload();
        return result;
      };
      
      window.taskWise.showTaskModal();
    } else {
      // Fallback: redirect to tasks page with project filter
      window.location.href = `/tasks?project=${projectId}`;
    }
  });
});

function createTaskCard(task) {
  const priorityClass = task.priority?.toLowerCase() || 'medium';
  const statusClass = task.status?.toLowerCase() || 'todo';
  const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date';
  const completedSubtasks = task.subtasks?.filter(st => st.completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;
  const progressPercent = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks * 100) : 0;
  
  return `
    <div class="task-card" data-task-id="${task.id}">
      <div class="task-header">
        <h3 class="task-title">${escapeHtml(task.title)}</h3>
        <div class="task-badges">
          <span class="priority-badge priority-${priorityClass}">${task.priority || 'Medium'}</span>
          <span class="status-badge status-${statusClass}">${formatStatus(task.status)}</span>
        </div>
      </div>
      
      ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
      
      ${totalSubtasks > 0 ? `
        <div class="task-progress">
          <div class="progress-header">
            <span class="progress-label">Progress</span>
            <span class="progress-text">${completedSubtasks}/${totalSubtasks} subtasks</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
        </div>
      ` : ''}
      
      <div class="task-footer">
        <div class="task-meta">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke-width="2"/>
            <path d="M16 2V6M8 2V6M3 10H21" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>${dueDate}</span>
        </div>
        <button class="task-action-btn" data-task-id="${task.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="1" fill="currentColor"/>
            <circle cx="12" cy="5" r="1" fill="currentColor"/>
            <circle cx="12" cy="19" r="1" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function formatStatus(status) {
  if (!status) return 'To Do';
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function attachTaskEventListeners() {
  // Add click handlers to task cards
  document.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.task-action-btn')) {
        const taskId = card.dataset.taskId;
        window.location.href = `/tasks?id=${taskId}`;
      }
    });
  });
  
  // Add click handlers to action buttons
  document.querySelectorAll('.task-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      // Could open a menu here for edit/delete actions
      console.log('Task action clicked:', taskId);
    });
  });
}
