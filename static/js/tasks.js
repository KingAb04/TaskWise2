// Task management functionality
let tasks = [];
let projects = [];
let isSubmitting = false; // prevent duplicate form submissions

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
    
    // Close modal when clicking outside of modal-content
    taskModal.addEventListener('click', (e) => {
        if (e.target === taskModal) {
            closeTaskModal();
        }
    });
    
    // Subtasks helpers (delegated)
    document.addEventListener('click', (e) => {
        if (e.target && e.target.matches('.subtask-remove')) {
            const row = e.target.closest('.subtask-row');
            if (row) row.remove();
        }
    });
}

// Utility to darken/brighten hex colors by percent (-100..100)
function adjustHexBrightness(hex, percent) {
    if (!hex) return hex;
    hex = hex.replace('#','');
    if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
    const num = parseInt(hex,16);
    let r = (num >> 16) + Math.round(255 * (percent/100));
    let g = ((num >> 8) & 0x00FF) + Math.round(255 * (percent/100));
    let b = (num & 0x0000FF) + Math.round(255 * (percent/100));
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
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
                // re-enable submissions
                isSubmitting = false;
                try {
                    const submitBtn = document.querySelector('#taskForm button[type="submit"]');
                    if (submitBtn) submitBtn.disabled = false;
                } catch (e) {}
        
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
            ${task.subtasks && task.subtasks.length > 0 ? `
                <div class="subtasks-list">
                    <div class="subtasks-header">
                        <i class="fas fa-list-check"></i>
                        <span>Subtasks (${task.subtasks.filter(s => s.completed).length}/${task.subtasks.length})</span>
                    </div>
                    ${task.subtasks.map(subtask => `
                        <div class="subtask-item" data-subtask-id="${subtask.id}">
                            <label class="subtask-checkbox-label">
                                <input type="checkbox" 
                                       class="subtask-checkbox" 
                                       data-subtask-id="${subtask.id}"
                                       ${subtask.completed ? 'checked' : ''}
                                       onchange="toggleSubtask(${subtask.id})">
                                <span class="subtask-title ${subtask.completed ? 'completed' : ''}">${subtask.title}</span>
                            </label>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
        <div class="task-actions">
            <button class="task-action-btn edit-btn" data-id="${task.id}" title="Edit">
                <i class="fas fa-edit"></i>
            </button>
            <button class="task-action-btn toggle-status-btn" data-id="${task.id}" title="${task.status === 'COMPLETED' ? 'Mark as incomplete' : 'Mark as complete'}">
                <i class="fas fa-${task.status === 'COMPLETED' ? 'undo' : 'check'}"></i>
            </button>
            <button class="task-action-btn delete-btn" data-id="${task.id}" title="Delete">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    // Apply card color if provided (from color picker)
    const cardColor = task.card_color || task.cardColor || task.cardColorInput || null;
    if (cardColor) {
        try {
            taskDiv.style.backgroundColor = cardColor;
            // set a slightly darker left border so it matches dashboard style
            const borderColor = adjustHexBrightness(cardColor, -15);
            taskDiv.style.borderLeft = '6px solid ' + borderColor;
        } catch (e) {
            // ignore invalid color values
            console.warn('Invalid card color for task', task.id, cardColor);
        }
    }
    // Attach event listeners to action buttons (avoid inline onclick handlers)
    console.log('createTaskElement: creating buttons for task', task.id);
    const editBtn = taskDiv.querySelector('.edit-btn');
    if (editBtn) {
        // visual hint to ensure button is visible/clickable while debugging
        try { editBtn.style.cursor = 'pointer'; editBtn.style.outline = '0'; } catch(e){}
        editBtn.addEventListener('click', (e) => {
            console.log('edit button clicked for task', e.currentTarget.dataset.id);
            const id = parseInt(e.currentTarget.dataset.id, 10);
            editTask(id);
            e.stopPropagation();
        });
        console.log('attached edit listener to', task.id);
    } else {
        console.warn('edit button not found for task', task.id);
    }
    const toggleBtn = taskDiv.querySelector('.toggle-status-btn');
    if (toggleBtn) toggleBtn.addEventListener('click', (e) => {
        console.log('toggle status clicked for', e.currentTarget.dataset.id);
        const id = parseInt(e.currentTarget.dataset.id, 10);
        toggleTaskStatus(id);
        e.stopPropagation();
    });
    const delBtn = taskDiv.querySelector('.delete-btn');
    if (delBtn) delBtn.addEventListener('click', (e) => {
        console.log('delete clicked for', e.currentTarget.dataset.id);
        const id = parseInt(e.currentTarget.dataset.id, 10);
        deleteTask(id);
        e.stopPropagation();
    });
    // end debug helpers
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
    // wire up color preview for the static modal
    const colorInput = document.getElementById('taskCardColor');
    const colorPreview = document.getElementById('taskCardColorPreview');
    if (colorInput && colorPreview) {
        colorPreview.style.background = colorInput.value || '#fecaca';
        // Remove previous input listeners to avoid duplicates
        colorInput.replaceWith(colorInput.cloneNode(true));
        const newColorInput = document.getElementById('taskCardColor');
        newColorInput.addEventListener('input', () => {
            colorPreview.style.background = newColorInput.value;
        });
    }
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
    const cardColor = document.getElementById('taskCardColor')?.value || '#fecaca';
    const status = document.getElementById('taskStatus')?.value || 'TODO';

    console.log('Form values:', {
        taskId,
        title,
        description,
        projectId,
        priority,
        dueDate,
        estimatedHours,
        cardColor,
        status
    });

    // Validate required fields
    if (!title?.trim()) {
        console.error('Validation failed: Title is required');
        showErrorMessage('Task title is required');
        return;
    }
    if (!priority) {
        showErrorMessage('Priority is required');
        return;
    }
    if (!dueDate) {
        showErrorMessage('Due date and time are required');
        return;
    }
    if (!estimatedHours) {
        showErrorMessage('Estimated hours are required');
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

    // Include card color
    taskData.card_color = cardColor;

    // For new tasks, include a client-side idempotency token to avoid duplicate creates
    if (!taskId) {
        try {
            // Prefer crypto.randomUUID when available
            if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                taskData.client_token = window.crypto.randomUUID();
            } else if (window.crypto && window.crypto.getRandomValues) {
                const arr = new Uint32Array(4);
                window.crypto.getRandomValues(arr);
                taskData.client_token = Array.from(arr).map(n => n.toString(16)).join('-');
            } else {
                taskData.client_token = 'ct_' + Date.now() + '_' + Math.floor(Math.random()*1000000);
            }
        } catch (e) {
            taskData.client_token = 'ct_' + Date.now() + '_' + Math.floor(Math.random()*1000000);
        }
    }

    // Collect subtasks
    const subtasks = [];
    document.querySelectorAll('#subtasksContainer .subtask-input').forEach(input => {
        const v = (input.value || '').trim();
        if (v) subtasks.push(v);
    });

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
        // If created and there are subtasks, create them via API
        let createdTask = null;
        if (!taskId) {
            createdTask = data.task || data.task || null;
            // Support different response shapes
            const newTaskId = createdTask && (createdTask.id || createdTask.id === 0) ? createdTask.id : (data.task && data.task.id) ? data.task.id : null;
            if (newTaskId && subtasks.length > 0) {
                for (const st of subtasks) {
                    try {
                        await fetch(`/api/tasks/${newTaskId}/subtasks`, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ title: st })
                        });
                    } catch (err) {
                        console.warn('Failed to create subtask', err);
                    }
                }
            }
        } else {
            // If updating existing task and subtasks present, create any new subtasks
            if (taskId && subtasks.length > 0) {
                for (const st of subtasks) {
                    try {
                        await fetch(`/api/tasks/${taskId}/subtasks`, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ title: st })
                        });
                    } catch (err) {
                        console.warn('Failed to create subtask', err);
                    }
                }
            }
        }

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

// Subtask UI helpers
function addSubtaskRow() {
    const container = document.getElementById('subtasksContainer');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'subtask-row';
    row.innerHTML = `<input type="text" class="subtask-input" placeholder="Subtask title"> <button type="button" class="btn small subtask-remove">Remove</button>`;
    container.appendChild(row);
}

function removeSubtaskRow(btn) {
    const row = btn ? btn.closest('.subtask-row') : null;
    if (row) row.remove();
}

async function editTask(taskId) {
    console.log('editTask called with id:', taskId);
    try {
        const task = tasks.find(t => t.id === taskId);
        if (!task) {
            console.warn('editTask: task not found for id', taskId);
            return;
        }

        modalTitle.textContent = 'Edit Task';
        document.getElementById('taskId').value = task.id;
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description || '';
        // ensure project select can accept string value
        document.getElementById('taskProject').value = task.project_id ? String(task.project_id) : '';
        // select options in the modal use uppercase values (HIGH/MEDIUM/LOW)
        document.getElementById('taskPriority').value = (task.priority || 'medium').toUpperCase();
        // due date may be null or malformed; guard it
        try {
            document.getElementById('taskDueDate').value = formatDateForInput(task.due_date);
        } catch (err) {
            console.warn('editTask: failed to format due date', task.due_date, err);
            document.getElementById('taskDueDate').value = '';
        }
        document.getElementById('taskEstimatedHours').value = task.estimated_hours || '';
        console.log('editTask: populated basic fields for', taskId);

    // set card color if present and wire preview
    const cardColorInput = document.getElementById('taskCardColor');
    const cardColorPreview = document.getElementById('taskCardColorPreview');
    if (cardColorInput) {
        try {
            cardColorInput.value = task.card_color || task.cardColor || '#fecaca';
        } catch (e) {
            cardColorInput.value = '#fecaca';
        }
        if (cardColorPreview) cardColorPreview.style.background = cardColorInput.value;
        // Ensure preview updates when user picks a color
        // Remove any previous listener by cloning then re-wiring (safe) or simply add a fresh listener
        try {
            const fresh = cardColorInput.cloneNode(true);
            cardColorInput.parentNode.replaceChild(fresh, cardColorInput);
            fresh.addEventListener('input', (e) => {
                if (cardColorPreview) cardColorPreview.style.background = e.target.value;
            });
        } catch (err) {
            // fallback: try to attach directly
            cardColorInput.addEventListener('input', (e) => {
                if (cardColorPreview) cardColorPreview.style.background = e.target.value;
            });
        }
    }

    // set status if available
    const statusSelect = document.getElementById('taskStatus');
    if (statusSelect) {
        try {
            // modal options are uppercase (TODO/IN_PROGRESS/COMPLETED)
            statusSelect.value = (task.status || 'TODO').toUpperCase();
        } catch (e) {
            statusSelect.value = 'TODO';
        }
    }

    // populate subtasks into the modal (if any)
    const subtasksContainer = document.getElementById('subtasksContainer');
    if (subtasksContainer) {
        subtasksContainer.innerHTML = '';
        if (Array.isArray(task.subtasks) && task.subtasks.length > 0) {
            task.subtasks.forEach(st => {
                const row = document.createElement('div');
                row.className = 'subtask-row';
                // include subtask id as data attribute so future enhancements can use it
                row.dataset.subtaskId = st.id || '';
                row.innerHTML = `<input type="text" class="subtask-input" value="${(st.title||'').replace(/"/g,'&quot;')}" placeholder="Subtask title"> <button type="button" class="btn small subtask-remove">Remove</button>`;
                subtasksContainer.appendChild(row);
            });
        } else {
            // leave a single empty row for convenience
            const row = document.createElement('div');
            row.className = 'subtask-row';
            row.innerHTML = `<input type="text" class="subtask-input" placeholder="Subtask title"> <button type="button" class="btn small subtask-remove">Remove</button>`;
            subtasksContainer.appendChild(row);
        }
    }

        taskModal.style.display = 'block';
        console.log('editTask: modal displayed for', taskId);
    } catch (e) {
        console.error('editTask: unexpected error', e);
    }
}

// Ensure editTask is available globally for inline onclick handlers
try { window.editTask = editTask; } catch (e) { /* ignore in non-browser env */ }

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
        
        // Show completion notification
        if (newStatus === 'COMPLETED' && typeof showCompletionNotification === 'function') {
            showCompletionNotification(task.title);
        }
        
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

// Subtask toggle function
async function toggleSubtask(subtaskId) {
    try {
        const response = await fetch(`/api/subtasks/${subtaskId}/toggle`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to toggle subtask');
        }

        // Reload tasks to reflect the updated subtask status and progress
        await loadTasks();
        showSuccessMessage('Subtask updated successfully');
    } catch (error) {
        console.error('Error toggling subtask:', error);
        showErrorMessage('Failed to update subtask');
        // Reload tasks to revert checkbox state
        await loadTasks();
    }
}

// Make toggleSubtask available globally for inline handlers
window.toggleSubtask = toggleSubtask;