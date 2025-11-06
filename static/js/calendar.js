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
    if (!task) return;

    const priorityClass = `priority-${task.priority}`;
    
    return {
        html: `
            <div class="fc-event-main-inner ${priorityClass}">
                <div class="fc-event-title">
                    ${eventInfo.event.title}
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
            .map(task => ({
                id: task.id.toString(),
                title: task.title,
                start: task.due_date,
                className: `priority-${task.priority}`,
                extendedProps: {
                    description: task.description,
                    priority: task.priority,
                    project: task.project,
                    progress: task.progress
                }
            }));

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
        // Format the date properly for the input
        const formattedDate = new Date(date);
        formattedDate.setMinutes(formattedDate.getMinutes() - formattedDate.getTimezoneOffset());
        dueDateInput.value = formattedDate.toISOString().slice(0, 16);
    } else {
        // Set default to current date/time
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        dueDateInput.value = now.toISOString().slice(0, 16);
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
    
    // Update modal content
    document.getElementById('detailsModalTitle').textContent = task.title;
    document.getElementById('detailsDueDate').textContent = formatDate(task.due_date);
    document.getElementById('detailsProject').textContent = task.project ? task.project.name : 'No Project';
    document.getElementById('detailsPriority').textContent = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
    document.getElementById('detailsEstimatedHours').textContent = task.estimated_hours ? `${task.estimated_hours}h estimated` : 'No estimate';
    document.getElementById('detailsDescription').textContent = task.description || 'No description';
    
    // Update progress bar
    const progressFill = document.getElementById('detailsProgress');
    const progressText = document.getElementById('detailsProgressText');
    progressFill.style.width = `${task.progress}%`;
    progressText.textContent = `${task.progress}% Complete`;
    
    modal.style.display = 'block';
}

function closeTaskDetailsModal() {
    const modal = document.getElementById('taskDetailsModal');
    modal.style.display = 'none';
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
        taskData.due_date = new Date(dueDate).toISOString();
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