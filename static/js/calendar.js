// Calendar initialization
let calendar;
let tasks = [];
let projects = [];

document.addEventListener('DOMContentLoaded', function() {
    initializeCalendar();
    loadTasks();
    loadProjects();
    setupEventListeners();
});

function initializeCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        height: '100%',
        navLinks: true,
        editable: true,
        selectable: true,
        selectMirror: true,
        dayMaxEvents: true,
        eventClick: handleEventClick,
        eventDrop: handleEventDrop,
        select: handleDateSelect,
        events: fetchEvents,
        eventContent: renderEventContent,
        slotMinTime: '06:00:00',
        slotMaxTime: '22:00:00',
        businessHours: {
            daysOfWeek: [ 1, 2, 3, 4, 5 ],
            startTime: '09:00',
            endTime: '17:00',
        },
        handleWindowResize: true,
        contentHeight: '100%'
    });
    
    // render calendar after initialization
    calendar.render();
}

// Event Handlers
function handleEventClick(info) {
    const taskId = parseInt(info.event.id);
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        showTaskDetails(task);
    }
}

function handleEventDrop(info) {
    const taskId = parseInt(info.event.id);
    const newDate = info.event.start;
    
    updateTaskDueDate(taskId, newDate)
        .then(() => {
            showNotification('Task date updated successfully', 'success');
        })
        .catch(error => {
            info.revert();
            showNotification('Failed to update task date', 'error');
        });
}

function handleDateSelect(info) {
    openAddTaskModal(info.start);
}

// Event Rendering
function renderEventContent(eventInfo) {
    const task = tasks.find(t => t.id === parseInt(eventInfo.event.id));
    if (!task) {
        console.log('Task not found for event:', eventInfo.event.id);
        return;
    }

    const priorityClass = `priority-${task.priority}`;
    const completedClass = task.status === 'completed' ? 'completed' : '';
    
    // Check if task is overdue OR was submitted late
    const now = new Date();
    const dueDate = new Date(task.due_date);
    
    let isLate = false;
    if (task.status === 'completed') {
        // Task is completed - check ONLY if it was submitted late
        if (task.completed_at) {
            const completedDate = new Date(task.completed_at);
            isLate = completedDate > dueDate; // Late ONLY if completed AFTER due date
        }
        // If completed but no completed_at, assume on time (don't show late)
    } else {
        // Task NOT completed - check if it's currently overdue
        isLate = dueDate < now;
    }
    
    const lateClass = isLate ? 'overdue' : '';
    
    console.log('Rendering event:', task.title, 'Late:', isLate, 'Status:', task.status, 'Due:', dueDate, 'Completed:', task.completed_at);
    
    return {
        html: `
            <div class="fc-event-main-inner ${priorityClass} ${completedClass} ${lateClass}">
                <div class="fc-event-title">
                    ${isLate ? '<span class="late-badge">LATE</span> ' : ''}${task.title}
                </div>
            </div>
        `
    };
}

// Data Fetching
async function fetchEvents(info, successCallback, failureCallback) {
    try {
        const response = await fetch('/api/tasks');
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to load tasks');
        }

        tasks = data.tasks;
        // Attach project objects when available so event rendering can show project name
        if (projects && projects.length > 0) {
            const byId = {};
            projects.forEach(p => byId[p.id] = p);
            tasks.forEach(t => {
                if (!t.project && t.project_id && byId[t.project_id]) {
                    t.project = byId[t.project_id];
                }
            });
        }
        const events = tasks
            .filter(task => task.due_date) // Only include tasks with due dates
            .map(task => {
                const now = new Date();
                const dueDate = new Date(task.due_date);
                
                let isLate = false;
                if (task.status === 'completed') {
                    // Task is completed - check ONLY if it was submitted late
                    if (task.completed_at) {
                        const completedDate = new Date(task.completed_at);
                        isLate = completedDate > dueDate; // Late ONLY if completed AFTER due date
                    }
                    // If completed but no completed_at, assume on time
                } else {
                    // Task NOT completed - check if it's currently overdue
                    isLate = dueDate < now;
                }
                
                console.log('Task:', task.title, 'Due:', dueDate, 'Completed:', task.completed_at, 'Late:', isLate);
                
                return {
                    id: task.id.toString(),
                    title: task.title,
                    start: task.due_date,
                    className: `priority-${task.priority} ${task.status === 'completed' ? 'completed' : ''} ${isLate ? 'overdue' : ''}`,
                    extendedProps: {
                        description: task.description,
                        priority: task.priority,
                        project: task.project,
                        progress: task.progress,
                        status: task.status,
                        isLate: isLate,
                        dueDate: task.due_date,
                        completed_at: task.completed_at
                    }
                };
            });

        successCallback(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        failureCallback(error);
    }
}

async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        const data = await response.json();
        
        if (data.success) {
            tasks = data.tasks;
            calendar.refetchEvents();
        } else {
            throw new Error(data.error || 'Failed to load tasks');
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        showNotification('Failed to load tasks', 'error');
    }
}

async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        const data = await response.json();
        
        if (data.success) {
            projects = data.projects;
                updateProjectDropdown();
                updateProjectFilter();
        } else {
            throw new Error(data.error || 'Failed to load projects');
        }
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

// UI Updates
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
function updateProjectFilter() {
    const projectFilter = document.getElementById('projectFilter');
    if (!projectFilter) return;
    projectFilter.innerHTML = '<option value="">All Projects</option>';
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        projectFilter.appendChild(option);
    });
}

// Modal Management

function openAddTaskModal(date = null) {
    const modal = document.getElementById('taskModal');
    const modalTitle = document.getElementById('modalTitle');
    const taskForm = document.getElementById('taskForm');
    const dueDateInput = document.getElementById('taskDueDate');
    
    if (!modal || !modalTitle || !taskForm || !dueDateInput) {
        console.error('Required modal elements not found');
        return;
    }

    modalTitle.textContent = 'Add New Task';
    taskForm.reset();
    
    if (date) {
        // Format the date properly for the input - keep it in local time
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        dueDateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    } else {
        // Set default to current date/time
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        dueDateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    document.getElementById('taskId').value = '';
    modal.style.display = 'block';
}

function closeTaskModal() {
    const modal = document.getElementById('taskModal');
    modal.style.display = 'none';
    document.getElementById('taskForm').reset();
}

function showTaskDetails(task) {
    const modal = document.getElementById('taskDetailsModal');
    const content = modal.querySelector('.task-details-content');
    
    // Add completed class if task is done
    if (task.status === 'completed') {
        content.classList.add('completed');
    } else {
        content.classList.remove('completed');
    }
    
    // Check if task is late (overdue or submitted late)
    const now = new Date();
    const dueDate = new Date(task.due_date);
    
    let isLate = false;
    if (task.status === 'completed') {
        // Task is completed - check ONLY if it was submitted late
        if (task.completed_at) {
            const completedDate = new Date(task.completed_at);
            isLate = completedDate > dueDate; // Late ONLY if completed AFTER due date
        }
        // If completed but no completed_at, assume on time
    } else {
        // Task NOT completed - check if it's currently overdue
        isLate = dueDate < now;
    }
    
    // Update modal content
    let titleText = task.title;
    if (isLate && task.status === 'completed') {
        titleText = `⚠️ ${task.title} (SUBMITTED LATE)`;
    } else if (isLate) {
        titleText = `⚠️ ${task.title} (OVERDUE)`;
    }
    document.getElementById('detailsModalTitle').textContent = titleText;
    
    let dueDateText = formatDate(task.due_date);
    if (isLate) {
        dueDateText += ' - Late!';
    }
    document.getElementById('detailsDueDate').textContent = dueDateText;
    document.getElementById('detailsProject').textContent = task.project ? task.project.name : 'No Project';
    document.getElementById('detailsPriority').textContent = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
    document.getElementById('detailsEstimatedHours').textContent = task.estimated_hours ? `${task.estimated_hours}h estimated` : 'No estimate';
    document.getElementById('detailsDescription').textContent = task.description || 'No description';
    
    // Update progress bar
    const progressFill = document.getElementById('detailsProgress');
    const progressText = document.getElementById('detailsProgressText');
    progressFill.style.width = `${task.progress}%`;
    progressText.textContent = `${task.progress}% Complete`;
    
    // Update status checkbox
    const statusCheckbox = document.getElementById('detailsStatusCheckbox');
    const checkboxLabel = document.querySelector('.checkbox-label');
    if (statusCheckbox) {
        statusCheckbox.checked = task.status === 'completed';
        statusCheckbox.disabled = false;
        
        // Update label based on late status
        if (checkboxLabel) {
            if (isLate && task.status !== 'completed') {
                checkboxLabel.textContent = 'Mark as completed (Late submission)';
                checkboxLabel.style.color = '#f59e0b'; // orange/amber color
            } else {
                checkboxLabel.textContent = 'Mark as completed';
                checkboxLabel.style.color = '';
            }
        }
    }
    
    // Store task ID for editing
    modal.dataset.taskId = task.id;
    
    modal.style.display = 'block';
}

function closeTaskDetailsModal() {
    const modal = document.getElementById('taskDetailsModal');
    modal.style.display = 'none';
}

// Toggle task status between done and todo
async function toggleTaskStatus() {
    const detailsModal = document.getElementById('taskDetailsModal');
    const taskId = detailsModal.dataset.taskId;
    const checkbox = document.getElementById('detailsStatusCheckbox');
    
    if (!taskId) {
        console.error('No task ID found');
        return;
    }
    
    const task = tasks.find(t => t.id === parseInt(taskId));
    if (!task) {
        console.error('Task not found');
        return;
    }
    
    const newStatus = checkbox.checked ? 'completed' : 'todo';
    const newProgress = checkbox.checked ? 100 : (task.progress >= 100 ? 0 : task.progress);
    
    console.log('Updating task status:', { taskId, newStatus, newProgress });
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                status: newStatus,
                progress: newProgress
            })
        });

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to update task status');
        }
        
        console.log('Task updated successfully:', data);
        
        // Update local task data
        task.status = newStatus;
        task.progress = newProgress;
        
        // Update the modal display
        const content = detailsModal.querySelector('.task-details-content');
        if (newStatus === 'completed') {
            content.classList.add('completed');
        } else {
            content.classList.remove('completed');
        }
        
        // Update progress bar
        const progressFill = document.getElementById('detailsProgress');
        const progressText = document.getElementById('detailsProgressText');
        progressFill.style.width = `${newProgress}%`;
        progressText.textContent = `${newProgress}% Complete`;
        
        // Reload calendar to show strikethrough
        await loadTasks();
        calendar.refetchEvents();
        
        // Show completion notification
        if (newStatus === 'completed') {
            showCompletionNotification(task.title);
        }
        
        showNotification(
            checkbox.checked ? 'Task marked as completed! ✓' : 'Task marked as incomplete',
            'success'
        );
    } catch (error) {
        console.error('Error updating task status:', error);
        checkbox.checked = !checkbox.checked; // Revert checkbox
        showNotification('Failed to update task status: ' + error.message, 'error');
    }
}

// Edit task from details modal
function editTaskFromDetails() {
    const detailsModal = document.getElementById('taskDetailsModal');
    const taskId = detailsModal.dataset.taskId;
    
    if (!taskId) return;
    
    const task = tasks.find(t => t.id === parseInt(taskId));
    if (!task) return;
    
    // Close details modal
    closeTaskDetailsModal();
    
    // Open edit modal with task data
    openEditTaskModal(task);
}

// Open modal for editing existing task
function openEditTaskModal(task) {
    const modal = document.getElementById('taskModal');
    const modalTitle = document.getElementById('modalTitle');
    const taskForm = document.getElementById('taskForm');
    
    if (!modal || !modalTitle || !taskForm) {
        console.error('Required modal elements not found');
        return;
    }

    modalTitle.textContent = 'Edit Task';
    
    // Populate form with task data
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDescription').value = task.description || '';
    document.getElementById('taskProject').value = task.project_id || '';
    document.getElementById('taskPriority').value = task.priority;
    document.getElementById('taskEstimatedHours').value = task.estimated_hours || '';
    
    // Format due date for datetime-local input - keep in local time
    if (task.due_date) {
        // Parse the ISO date string and format for datetime-local input
        const dueDate = new Date(task.due_date);
        // Get components in local time
        const year = dueDate.getFullYear();
        const month = String(dueDate.getMonth() + 1).padStart(2, '0');
        const day = String(dueDate.getDate()).padStart(2, '0');
        const hours = String(dueDate.getHours()).padStart(2, '0');
        const minutes = String(dueDate.getMinutes()).padStart(2, '0');
        document.getElementById('taskDueDate').value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    modal.style.display = 'block';
}

// Event Listeners
function setupEventListeners() {
    // Close modals when clicking outside
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };

    // Close buttons
    document.querySelectorAll('.close').forEach(button => {
        button.onclick = function() {
            this.closest('.modal').style.display = 'none';
        };
    });

    // Form submission
    document.getElementById('taskForm').addEventListener('submit', handleTaskSubmit);

    // Filters
    document.getElementById('projectFilter').addEventListener('change', handleFilters);
    document.getElementById('priorityFilter').addEventListener('change', handleFilters);
}

// Form Handling
async function handleTaskSubmit(e) {
    e.preventDefault();
    
    const taskId = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value;
    const description = document.getElementById('taskDescription').value;
    const projectId = document.getElementById('taskProject').value;
    const priority = document.getElementById('taskPriority').value;
    const dueDate = document.getElementById('taskDueDate').value;
    const estimatedHours = document.getElementById('taskEstimatedHours').value;

    if (!title.trim()) {
        showNotification('Task title is required', 'error');
        return;
    }

    // Check if due date is in the past (only for new tasks or if changing due date)
    if (dueDate) {
        const selectedDate = new Date(dueDate);
        const now = new Date();
        
        // If this is a new task (no taskId) or editing an existing task
        if (!taskId) {
            // For new tasks, don't allow past due dates
            if (selectedDate < now) {
                showNotification('Cannot create task with past due date. Please select a future date.', 'error');
                return;
            }
        }
        // For editing existing tasks, allow past dates (user might be updating other fields)
    }

    const taskData = {
        title: title.trim(),
        description: description.trim(),
        status: 'todo',
        priority: priority.toLowerCase(),
        project_id: projectId ? parseInt(projectId) : null,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
        progress: 0
    };

    if (dueDate) {
        // Simply append seconds and send as ISO string
        // The datetime-local input gives us YYYY-MM-DDTHH:MM format
        // We just add :00.000Z to make it a proper ISO string
        taskData.due_date = dueDate + ':00.000Z';
    }

    try {
        const url = taskId ? `/api/tasks/${taskId}` : '/api/tasks';
                // Ensure project objects are attached to tasks when available
                if (projects && projects.length > 0) {
                    const byId = {};
                    projects.forEach(p => byId[p.id] = p);
                    tasks.forEach(t => {
                        if (!t.project && t.project_id && byId[t.project_id]) {
                            t.project = byId[t.project_id];
                        }
                    });
                }
        const method = taskId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(taskData)
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to save task');
        }
        
        await loadTasks();
        closeTaskModal();
        showNotification(taskId ? 'Task updated successfully' : 'Task created successfully', 'success');
    } catch (error) {
        console.error('Error saving task:', error);
        showNotification(error.message || 'Failed to save task', 'error');
    }
}

// Task Updates
async function updateTaskDueDate(taskId, newDate) {
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                due_date: newDate.toISOString()
            })
        });

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to update task');
        }
        
        await loadTasks();
    } catch (error) {
        throw error;
    }
}

// Filter Handling
function handleFilters() {
    const projectId = document.getElementById('projectFilter').value;
    const priority = document.getElementById('priorityFilter').value;

    calendar.getEvents().forEach(event => {
        const task = tasks.find(t => t.id === parseInt(event.id));
        if (!task) return;

        const matchesProject = !projectId || task.project_id === parseInt(projectId);
        const matchesPriority = !priority || task.priority === priority;

        event.setProp('display', matchesProject && matchesPriority ? 'auto' : 'none');
    });
}

// Utility Functions
function formatDate(dateString) {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Notification System
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;

    let container = document.querySelector('.notification-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
    }

    container.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}