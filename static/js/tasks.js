// Task management functionality
let tasks = [];
let projects = [];

// DOM Elements
const tasksList = document.getElementById('tasksList');
const taskForm = document.getElementById('taskForm');
const taskModal = document.getElementById('taskModal');
const modalTitle = document.getElementById('modalTitle');
const closeModalBtn = taskModal.querySelector('.close');
const taskSearch = document.getElementById('taskSearch');
const statusFilter = document.getElementById('statusFilter');
const priorityFilter = document.getElementById('priorityFilter');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('Tasks page loaded, initializing...');
    loadTasks();
    loadProjects();
    setupEventListeners();
    console.log('Initialization complete');
});

function setupEventListeners() {
    taskForm.addEventListener('submit', handleTaskSubmit);
    closeModalBtn.addEventListener('click', closeTaskModal);
    taskSearch.addEventListener('input', filterTasks);
    statusFilter.addEventListener('change', filterTasks);
    priorityFilter.addEventListener('change', filterTasks);
}

// Task CRUD Operations
async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        const data = await response.json();
        if (data.success) {
            tasks = data.tasks;
            renderTasks();
        } else {
            throw new Error(data.error || 'Failed to load tasks');
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        showErrorMessage('Failed to load tasks');
    }
}

async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        const data = await response.json();
        if (data.success) {
            projects = data.projects;
            updateProjectDropdown();
        } else {
            throw new Error(data.error || 'Failed to load projects');
        }
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

function updateProjectDropdown() {
    const projectSelect = document.getElementById('taskProject');
    projectSelect.innerHTML = '<option value="">Select Project</option>';
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        projectSelect.appendChild(option);
    });
}

function renderTasks() {
    if (tasks.length === 0) {
        tasksList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tasks"></i>
                <h3>No tasks found</h3>
                <p>Create your first task to get started!</p>
            </div>
        `;
        return;
    }

    tasksList.innerHTML = '';
    tasks.forEach(task => {
        const taskElement = createTaskElement(task);
        tasksList.appendChild(taskElement);
    });
}

function createTaskElement(task) {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-item';
    taskDiv.innerHTML = `
        <div class="task-content">
            <div class="task-header">
                <h3 class="task-title">${task.title}</h3>
                <span class="task-priority priority-${task.priority.toLowerCase()}">
                    <i class="fas fa-${task.priority.toLowerCase() === 'high' ? 'exclamation' : task.priority.toLowerCase() === 'medium' ? 'minus' : 'arrow-down'}"></i>
                    ${task.priority}
                </span>
                <span class="task-status status-${task.status.toLowerCase()}">
                    <i class="fas fa-${task.status === 'COMPLETED' ? 'check-circle' : task.status === 'IN_PROGRESS' ? 'spinner' : task.status === 'OVERDUE' ? 'exclamation-circle' : 'circle'}"></i>
                    ${formatStatus(task.status)}
                </span>
            </div>
            <p class="task-description">${task.description || ''}</p>
            <div class="task-meta">
                ${task.project ? `
                    <div class="task-meta-item">
                        <i class="fas fa-folder"></i>
                        <span>${task.project.name}</span>
                    </div>
                ` : ''}
                <div class="task-meta-item">
                    <i class="fas fa-calendar"></i>
                    <span>${formatDate(task.due_date)}</span>
                </div>
                ${task.estimated_hours ? `
                    <div class="task-meta-item">
                        <i class="fas fa-clock"></i>
                        <span>${task.estimated_hours}h estimated</span>
                    </div>
                ` : ''}
                ${task.time_spent ? `
                    <div class="task-meta-item">
                        <i class="fas fa-hourglass-half"></i>
                        <span>${task.time_spent}h spent</span>
                    </div>
                ` : ''}
            </div>
            ${task.progress !== undefined ? `
                <div class="task-progress">
                    <div class="progress-bar-container">
                        <span class="progress-label">Task Progress</span>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${task.progress}%"></div>
                        </div>
                    </div>
                    <span class="progress-percentage">${task.progress}%</span>
                </div>
            ` : ''}
        </div>
        <div class="task-actions">
            <button class="task-action-btn" onclick="editTask(${task.id})" title="Edit">
                <i class="fas fa-edit"></i>
            </button>
            <button class="task-action-btn" onclick="toggleTaskStatus(${task.id})" title="${task.status === 'COMPLETED' ? 'Mark as incomplete' : 'Mark as complete'}">
                <i class="fas fa-${task.status === 'COMPLETED' ? 'undo' : 'check'}"></i>
            </button>
            <button class="task-action-btn" onclick="deleteTask(${task.id})" title="Delete">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    return taskDiv;
}

// Modal Management
function openAddTaskModal() {
    console.log('Opening add task modal...');
    const modal = document.getElementById('taskModal');
    const modalTitle = document.getElementById('modalTitle');
    
    if (!modal || !modalTitle) {
        console.error('Modal elements not found:', { modal, modalTitle });
        return;
    }

    modalTitle.textContent = 'Add New Task';
    document.getElementById('taskForm').reset();
    if (document.getElementById('taskId')) {
        document.getElementById('taskId').value = '';
    }
    modal.style.display = 'block';
    console.log('Modal opened successfully');
}

function closeTaskModal() {
    console.log('Closing task modal...');
    const modal = document.getElementById('taskModal');
    if (!modal) {
        console.error('Modal element not found');
        return;
    }
    modal.style.display = 'none';
    document.getElementById('taskForm').reset();
    console.log('Modal closed successfully');
}

async function handleTaskSubmit(e) {
    e.preventDefault();
    console.log('Form submission started...');
    
    // Get form elements
    const taskId = document.getElementById('taskId')?.value;
    const title = document.getElementById('taskTitle')?.value;
    const description = document.getElementById('taskDescription')?.value;
    const projectId = document.getElementById('taskProject')?.value;
    const priority = document.getElementById('taskPriority')?.value;
    const dueDate = document.getElementById('taskDueDate')?.value;
    const estimatedHours = document.getElementById('taskEstimatedHours')?.value;
    const status = document.getElementById('taskStatus')?.value || 'TODO';

    console.log('Form values:', {
        taskId,
        title,
        description,
        projectId,
        priority,
        dueDate,
        estimatedHours,
        status
    });

    // Validate required fields
    if (!title?.trim()) {
        console.error('Validation failed: Title is required');
        showErrorMessage('Task title is required');
        return;
    }

    // Construct task data
    const taskData = {
        title: title.trim(),
        description: description ? description.trim() : '',
        status: status.toLowerCase(), // Matches TaskStatus enum values
        priority: priority ? priority.toLowerCase() : 'medium', // Matches Priority enum values
        project_id: projectId ? parseInt(projectId) : null,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
        progress: 0 // Initial progress for new tasks
    };

    // Add due date if provided, ensuring proper UTC handling
    if (dueDate) {
        try {
            // Create date in local timezone
            const date = new Date(dueDate);
            // Convert to UTC ISO string and remove the 'Z' suffix
            taskData.due_date = date.toISOString().replace('Z', '+00:00');
        } catch (error) {
            console.error('Error formatting due date:', error);
            showErrorMessage('Invalid due date format');
            return;
        }
    }

    console.log('Processed task data:', taskData);

    try {
        const url = taskId ? `/api/tasks/${taskId}` : '/api/tasks';
        const method = taskId ? 'PUT' : 'POST';
        
        console.log(`Sending ${method} request to ${url}`);
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(taskData)
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        if (!response.ok) {
            throw new Error(data.error || `Server returned ${response.status}`);
        }

        if (!data.success) {
            throw new Error(data.error || 'Failed to save task');
        }
        
        console.log('Task saved successfully');
        await loadTasks(); // Refresh task list
        closeTaskModal();
        showSuccessMessage(taskId ? 'Task updated successfully' : 'Task created successfully');
        
        // Clear form
        taskForm.reset();
    } catch (error) {
        console.error('Error saving task:', error);
        showErrorMessage(error.message || 'Failed to save task');
    }
}

async function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    modalTitle.textContent = 'Edit Task';
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDescription').value = task.description || '';
    document.getElementById('taskProject').value = task.project_id || '';
    document.getElementById('taskPriority').value = task.priority.toLowerCase();
    document.getElementById('taskDueDate').value = formatDateForInput(task.due_date);
    document.getElementById('taskEstimatedHours').value = task.estimated_hours || '';

    taskModal.style.display = 'block';
}

async function toggleTaskStatus(taskId) {
    try {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const newStatus = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
        await fetch(`/api/tasks/${taskId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus })
        });

        await loadTasks();
        showSuccessMessage(`Task marked as ${newStatus.toLowerCase()}`);
    } catch (error) {
        console.error('Error updating task status:', error);
        showErrorMessage('Failed to update task status');
    }
}

async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
        await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        await loadTasks();
        showSuccessMessage('Task deleted successfully');
    } catch (error) {
        console.error('Error deleting task:', error);
        showErrorMessage('Failed to delete task');
    }
}

// Filter and Search
function filterTasks() {
    const searchTerm = taskSearch.value.toLowerCase();
    const statusValue = statusFilter.value;
    const priorityValue = priorityFilter.value;

    const filteredTasks = tasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchTerm) || 
                            (task.description && task.description.toLowerCase().includes(searchTerm));
        const matchesStatus = statusValue === 'all' || task.status.toLowerCase() === statusValue;
        const matchesPriority = priorityValue === 'all' || task.priority.toLowerCase() === priorityValue;

        return matchesSearch && matchesStatus && matchesPriority;
    });

    renderFilteredTasks(filteredTasks);
}

function renderFilteredTasks(filteredTasks) {
    if (filteredTasks.length === 0) {
        tasksList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No matching tasks found</h3>
                <p>Try adjusting your filters or search term</p>
            </div>
        `;
        return;
    }

    tasksList.innerHTML = '';
    filteredTasks.forEach(task => {
        const taskElement = createTaskElement(task);
        tasksList.appendChild(taskElement);
    });
}

// Notification System
function createNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;

    // Add to container or create if it doesn't exist
    let container = document.querySelector('.notification-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
    }

    container.appendChild(notification);

    // Remove after animation
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Utility Functions
function formatDate(dateString) {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16);
}

function formatStatus(status) {
    return status.charAt(0) + status.slice(1).toLowerCase();
}

function showSuccessMessage(message) {
    createNotification(message, 'success');
}

function showErrorMessage(message) {
    createNotification(message, 'error');
}