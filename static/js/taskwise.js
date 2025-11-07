// TaskWise Frontend JavaScript
class TaskWise {
    constructor() {
        this.apiBase = '/api';
        this.tasks = [];
        this.projects = [];
        this.currentFilter = 'all';
        this.currentProjectId = null;
        this.init();
    }

    async init() {
        await this.loadProjects();
        await this.loadTasks();
        await this.loadStats();
        this.setupEventListeners();
        // Only initialize calendar if element exists (on calendar page)
        if (document.getElementById('miniCalendar')) {
            this.initializeMiniCalendar();
        }
        
        // Render appropriate view based on page
        const isDashboard = document.getElementById('dashboardTasksList') !== null;
        const isTasksPage = document.getElementById('tasksList') !== null;
        
        if (isDashboard) {
            this.renderDashboard();
        } else if (isTasksPage) {
            this.renderTaskGrid();
        }
    }

    initializeMiniCalendar() {
        const calendarEl = document.getElementById('miniCalendar');
        if (!calendarEl) return;

        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next',
                center: 'title',
                right: 'today'
            },
            height: 'auto',
            events: this.getCalendarEvents.bind(this),
            eventClick: this.handleCalendarEventClick.bind(this),
            eventClassNames: this.getEventClassNames.bind(this),
            eventContent: this.renderEventContent.bind(this),
            eventDidMount: this.handleEventMount.bind(this)
        });

        calendar.render();
        this.miniCalendar = calendar;
    }

    getCalendarEvents() {
        return this.tasks
            .filter(task => task.due_date)
            .map(task => ({
                id: task.id.toString(),
                title: task.title,
                start: task.due_date,
                className: `priority-${task.priority}`,
                extendedProps: {
                    description: task.description,
                    priority: task.priority,
                    project: task.project,
                    progress: task.progress,
                    status: task.status
                }
            }));
    }

    handleCalendarEventClick(info) {
        const taskId = parseInt(info.event.id);
        this.showTaskDetails(taskId);
    }

    getEventClassNames(info) {
        const task = this.tasks.find(t => t.id === parseInt(info.event.id));
        if (!task) return [];

        const classes = [`priority-${task.priority}`];
        if (task.status === 'completed') classes.push('completed');
        if (task.status === 'overdue') classes.push('overdue');
        return classes;
    }

    renderEventContent(info) {
        const task = this.tasks.find(t => t.id === parseInt(info.event.id));
        if (!task) return;

        return {
            html: `
                <div class="fc-event-main-inner">
                    <div class="fc-event-title" title="${this.escapeHtml(task.title)}">
                        ${this.escapeHtml(task.title)}
                    </div>
                </div>
            `
        };
    }

    handleEventMount(info) {
        const task = this.tasks.find(t => t.id === parseInt(info.event.id));
        if (!task) return;

        // Add tooltip with more details
        const tooltip = `
            ${task.title}
            Status: ${task.status}
            Priority: ${task.priority}
            ${task.project ? `Project: ${task.project.name}` : ''}
            Progress: ${task.progress}%
        `;

        info.el.setAttribute('title', tooltip);
    }

    // API Methods
    async apiCall(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${this.apiBase}${endpoint}`, options);
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'API call failed');
            }
            
            return result;
        } catch (error) {
            console.error('API Error:', error);
            this.showNotification('error', error.message);
            throw error;
        }
    }

    async loadTasks(filter = null) {
        try {
            let endpoint = '/tasks';
            if (filter) {
                const params = new URLSearchParams(filter);
                endpoint += `?${params}`;
            }
            
            const result = await this.apiCall(endpoint);
            this.tasks = result.tasks;
            // Don't auto-render here - let the caller decide when to render
        } catch (error) {
            console.error('Failed to load tasks:', error);
        }
    }

    async loadProjects() {
        try {
            const result = await this.apiCall('/projects');
            this.projects = result.projects;
            this.renderProjectsList();
        } catch (error) {
            console.error('Failed to load projects:', error);
        }
    }

    async loadStats() {
        try {
            const result = await this.apiCall('/stats');
            this.renderStats(result.stats);
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    async createTask(taskData) {
        try {
            const result = await this.apiCall('/tasks', 'POST', taskData);
            
            // Reload tasks from server to get the updated list
            await this.loadTasks();
            
            // Check which page we're on and render appropriately
            const isDashboard = document.getElementById('dashboardTasksList') !== null;
            const isTasksPage = document.getElementById('tasksList') !== null;
            
            if (isDashboard) {
                // On dashboard, render the recent tasks
                this.renderDashboard();
            } else if (isTasksPage) {
                // On tasks page, render the full task grid  
                this.renderTaskGrid();
            }
            
            this.loadStats(); // Refresh stats
            this.showNotification('success', 'Task created successfully!');
            return result.task;
        } catch (error) {
            console.error('Failed to create task:', error);
        }
    }

    async updateTask(taskId, updates) {
        try {
            const result = await this.apiCall(`/tasks/${taskId}`, 'PUT', updates);
            
            // Reload tasks from server to get the updated list
            await this.loadTasks();
            
            // Check which page we're on and render appropriately
            const isDashboard = document.getElementById('dashboardTasksList') !== null;
            const isTasksPage = document.getElementById('tasksList') !== null;
            
            if (isDashboard) {
                // On dashboard, render the recent tasks
                this.renderDashboard();
            } else if (isTasksPage) {
                // On tasks page, render the full task grid
                this.renderTaskGrid();
            }
            
            this.loadStats(); // Refresh stats
            this.showNotification('success', 'Task updated successfully!');
            return result.task;
        } catch (error) {
            console.error('Failed to update task:', error);
        }
    }

    async deleteTask(taskId) {
        try {
            await this.apiCall(`/tasks/${taskId}`, 'DELETE');
            
            // Reload tasks from server to get the updated list
            await this.loadTasks();
            
            // Check which page we're on and render appropriately
            const isDashboard = document.getElementById('dashboardTasksList') !== null;
            const isTasksPage = document.getElementById('tasksList') !== null;
            
            if (isDashboard) {
                // On dashboard, render the recent tasks
                this.renderDashboard();
            } else if (isTasksPage) {
                // On tasks page, render the full task grid
                this.renderTaskGrid();
            }
            
            this.loadStats(); // Refresh stats
            this.showNotification('success', 'Task deleted successfully!');
        } catch (error) {
            console.error('Failed to delete task:', error);
        }
    }

    // Rendering Methods
    renderStats(stats) {
        const statCards = [
            { selector: '.stat-card:nth-child(1) .stat-info h3', value: stats.total_tasks },
            { selector: '.stat-card:nth-child(2) .stat-info h3', value: stats.completed_tasks },
            { selector: '.stat-card:nth-child(3) .stat-info h3', value: stats.in_progress_tasks },
            { selector: '.stat-card:nth-child(4) .stat-info h3', value: stats.overdue_tasks }
        ];
        
        statCards.forEach(({ selector, value }) => {
            const element = document.querySelector(selector);
            if (element) element.textContent = value;
        });
    }

    renderTaskGrid() {
        const taskGrid = document.querySelector('.task-grid');
        if (!taskGrid) return;

        // Filter tasks based on current filter
        let filteredTasks = this.tasks;
        if (this.currentFilter !== 'all') {
            filteredTasks = this.tasks.filter(task => {
                switch (this.currentFilter) {
                    case 'today':
                        const today = new Date().toDateString();
                        return task.due_date && new Date(task.due_date).toDateString() === today;
                    case 'week':
                        const weekFromNow = new Date();
                        weekFromNow.setDate(weekFromNow.getDate() + 7);
                        return task.due_date && new Date(task.due_date) <= weekFromNow;
                    case 'high':
                        return task.priority === 'high';
                    default:
                        return true;
                }
            });
        }

        // Clear existing tasks
        taskGrid.innerHTML = '';

        // Render filtered tasks
        filteredTasks.forEach(task => {
            taskGrid.appendChild(this.createTaskCard(task));
        });

        // Add the "Add New Task" card
        const addTaskCard = document.createElement('div');
        addTaskCard.className = 'task-card add-task';
        addTaskCard.innerHTML = `
            <div class="add-task-content">
                <div class="add-task-icon">
                    <i class="fas fa-plus"></i>
                </div>
                <h3>Add New Task</h3>
                <p>Click here to create a new task and boost your productivity</p>
            </div>
        `;
        addTaskCard.addEventListener('click', () => this.showTaskModal());
        taskGrid.appendChild(addTaskCard);
    }

    createTaskCard(task) {
        const card = document.createElement('div');
        card.className = `task-card priority-${task.priority}`;
        card.dataset.taskId = task.id;
        
        // Apply custom card color if available
        const cardColor = task.card_color || '#fecaca';
        card.style.backgroundColor = cardColor;
        card.style.borderLeft = `6px solid ${this.adjustColorBrightness(cardColor, -20)}`;

        const priorityIcons = {
            high: 'fas fa-exclamation',
            medium: 'fas fa-minus',
            low: 'fas fa-arrow-down'
        };

        const statusColors = {
            todo: '#64748b',
            in_progress: '#f59e0b',
            completed: '#22c55e',
            overdue: '#ef4444'
        };

        const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date';
        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

        card.innerHTML = `
            <div class="task-header">
                <div class="task-priority ${task.priority}">
                    <i class="${priorityIcons[task.priority]}"></i>
                </div>
                <div class="task-actions">
                    <i class="fas fa-star" onclick="taskWise.toggleFavorite(${task.id})"></i>
                    <i class="fas fa-ellipsis-h" onclick="taskWise.showTaskMenu(${task.id})"></i>
                </div>
            </div>
            <div class="task-content">
                <h3>${this.escapeHtml(task.title)}</h3>
                <p>${this.escapeHtml(task.description || 'No description')}</p>
                <div class="task-meta">
                    <div class="task-project">
                        <i class="fas fa-folder"></i>
                        <span>${task.project_name || 'No Project'}</span>
                    </div>
                    <div class="task-due ${isOverdue ? 'overdue' : ''}">
                        <i class="fas fa-calendar"></i>
                        <span>${dueDate}</span>
                    </div>
                </div>
                <div class="task-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${task.progress}%"></div>
                    </div>
                    <span>${task.progress}%</span>
                </div>
                ${task.subtask_count > 0 ? `
                <div class="task-subtasks" style="margin-top: 10px !important; padding: 8px 10px !important; background: rgba(255,255,255,0.6) !important; border-radius: 6px !important; display: flex !important; align-items: center !important; gap: 6px !important; font-size: 0.85rem !important; color: #374151 !important;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                    <span><strong>${task.subtask_completed}</strong> / ${task.subtask_count} subtasks completed</span>
                </div>
                ` : ''}
                <div class="task-status-actions">
                    <button class="btn-small ${task.status === 'in_progress' ? 'active' : ''}" 
                            onclick="taskWise.updateTaskStatus(${task.id}, 'in_progress')">
                        In Progress
                    </button>
                    <button class="btn-small ${task.status === 'completed' ? 'active' : ''}" 
                            onclick="taskWise.updateTaskStatus(${task.id}, 'completed')">
                        Complete
                    </button>
                </div>
            </div>
        `;

        // Add click event to open task details
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.task-actions') && !e.target.closest('.task-status-actions')) {
                this.showTaskDetails(task.id);
            }
        });

        return card;
    }

    renderProjectsList() {
        const projectsContainer = document.querySelector('#projects');
        if (!projectsContainer) return;

        // Start with the "Add New Project" button - with inline onclick handler
        projectsContainer.innerHTML = `
            <div class="nav-item sub-item" id="addProjectBtn" onclick="if(window.taskWise) window.taskWise.showProjectModal()">
                <i class="fas fa-plus nav-icon"></i>
                <span>Add New Project</span>
            </div>
        `;

        // Add projects with task counts
        this.projects.forEach(project => {
            const taskCount = this.tasks.filter(task => task.project_id === project.id).length;
            const projectItem = document.createElement('div');
            projectItem.className = `nav-item sub-item${this.currentProjectId === project.id ? ' active' : ''}`;
            projectItem.dataset.projectId = project.id;
            projectItem.innerHTML = `
                <i class="fas fa-circle nav-icon" style="color: ${project.color}"></i>
                <span class="project-name">${this.escapeHtml(project.name)}</span>
                <span class="project-task-count">${taskCount}</span>
                <div class="project-actions" style="margin-left:auto; display:flex; gap:8px; align-items:center;">
                    <button class="btn tiny project-edit" title="Edit project" style="background:none;border:none;cursor:pointer;color:#6b7280;"><i class="fas fa-edit"></i></button>
                    <button class="btn tiny project-delete" title="Delete project" style="background:none;border:none;cursor:pointer;color:#ef4444;"><i class="fas fa-trash"></i></button>
                </div>
            `;
            projectItem.addEventListener('click', (e) => {
                // If clicking action buttons, don't trigger navigation
                if (e.target.closest('.project-actions')) return;
                // Navigate to project detail page
                window.location.href = `/projects/${project.id}`;
            });
            // Edit handler
            projectItem.querySelector('.project-edit').addEventListener('click', (e) => {
                e.stopPropagation();
                this.showProjectModal(project);
            });
            // Delete handler
            projectItem.querySelector('.project-delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm(`Delete project "${project.name}" and remove it from tasks?`)) return;
                try {
                    await this.apiCall(`/projects/${project.id}`, 'DELETE');
                    // Remove project locally and re-render
                    this.projects = this.projects.filter(p => p.id !== project.id);
                    // unset currentProjectId if it was the deleted one
                    if (this.currentProjectId === project.id) this.currentProjectId = null;
                    this.renderProjectsList();
                    await this.loadTasks();
                    this.showNotification('success', 'Project deleted');
                } catch (err) {
                    console.error('Failed to delete project', err);
                }
            });
            projectsContainer.appendChild(projectItem);
        });
    }

    // Event Handlers
    setupEventListeners() {
        // Filter tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                
                const filter = e.target.textContent.toLowerCase();
                this.currentFilter = filter === 'all' ? 'all' : 
                                   filter === 'today' ? 'today' :
                                   filter === 'this week' ? 'week' :
                                   filter === 'high priority' ? 'high' : 'all';
                this.renderTaskGrid();
            });
        });

        // New Task button - use event delegation on parent
        const actionButtons = document.querySelector('.action-buttons');
        if (actionButtons) {
            actionButtons.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn.primary');
                if (btn && btn.querySelector('.fa-plus')) {
                    e.preventDefault();
                    this.showTaskModal();
                }
            });
        }

        // New Project button - use event delegation
        const actionSection = document.querySelector('.action-section');
        if (actionSection) {
            actionSection.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn.secondary');
                if (btn && btn.querySelector('.fa-folder-plus')) {
                    e.preventDefault();
                    this.showProjectModal();
                }
            });
        }
    }

    // Modal Methods
    showTaskModal(taskId = null) {
        try {
            console.log('=== showTaskModal START ===');
            console.log('taskId:', taskId);
            
            const isEdit = taskId !== null;
            const task = isEdit ? this.tasks.find(t => t.id === taskId) : null;
            
            console.log('isEdit:', isEdit);
            console.log('task:', task);
            console.log('projects:', this.projects);

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background: rgba(0,0,0,0.5) !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 10000 !important; backdrop-filter: blur(4px) !important; padding: 20px !important;';
            
            // Use defaultProjectId if set and this is a new task
            const defaultProjId = (!isEdit && this.defaultProjectId) ? this.defaultProjectId : task?.project_id;
            
            const projectOptions = this.projects.map(p => {
                const name = this.escapeHtml(p.name || 'Unnamed Project');
                const selected = defaultProjId === p.id ? 'selected' : '';
                return `<option value="${p.id}" ${selected}>${name}</option>`;
            }).join('');
            
            const taskTitle = this.escapeHtml(task?.title || '');
            const taskDescription = this.escapeHtml(task?.description || '');
            const taskDueDate = task?.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '';
            const taskProgress = task?.progress || 0;
            
            console.log('Creating modal HTML...');
            
            modal.innerHTML = `
                <div class="modal" style="background: white !important; border-radius: 16px !important; width: 90% !important; max-width: 500px !important; max-height: 90vh !important; overflow-y: auto !important; box-shadow: 0 20px 40px rgba(0,0,0,0.15) !important; position: relative !important; display: block !important;">
                    <div class="modal-header" style="padding: 24px !important; border-bottom: 1px solid #e5e7eb !important; display: flex !important; justify-content: space-between !important; align-items: center !important;">
                        <h3 style="margin: 0 !important; font-size: 1.5rem !important; font-weight: 600 !important;">${isEdit ? 'Edit Task' : 'New Task'}</h3>
                        <button class="modal-close" type="button" style="background: none !important; border: none !important; font-size: 2rem !important; cursor: pointer !important; color: #6b7280 !important; line-height: 1 !important; padding: 0 !important; width: 32px !important; height: 32px !important; display: flex !important; align-items: center !important; justify-content: center !important; border-radius: 8px !important; transition: background 0.2s !important;">&times;</button>
                    </div>
                    <form class="modal-body" id="dashboardTaskForm" style="padding: 24px !important;">
                        <div class="form-group" style="margin-bottom: 20px !important;">
                            <label style="display: flex !important; align-items: center !important; gap: 6px !important; margin-bottom: 8px !important; font-weight: 600 !important; color: #374151 !important;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M4 7h16M4 12h16M4 17h10"></path>
                                </svg>
                                <span>Title *</span>
                            </label>
                            <input type="text" name="title" required value="${taskTitle}" style="width: 100% !important; padding: 12px 14px !important; border: 1px solid #d1d5db !important; border-radius: 8px !important; font-size: 0.95rem !important; box-sizing: border-box !important; transition: all 0.3s ease !important;">
                        </div>
                        <div class="form-group" style="margin-bottom: 20px !important;">
                            <label style="display: flex !important; align-items: center !important; gap: 6px !important; margin-bottom: 8px !important; font-weight: 500 !important; color: #374151 !important;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="12" y1="18" x2="12" y2="12"></line>
                                    <line x1="9" y1="15" x2="15" y2="15"></line>
                                </svg>
                                <span>Description</span>
                            </label>
                            <textarea name="description" rows="3" style="width: 100% !important; padding: 12px 14px !important; border: 1px solid #d1d5db !important; border-radius: 8px !important; font-size: 0.95rem !important; resize: vertical !important; box-sizing: border-box !important; transition: all 0.3s ease !important;">${taskDescription}</textarea>
                        </div>
                        <div class="form-row" style="display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 16px !important; margin-bottom: 20px !important;">
                            <div class="form-group">
                                <label style="display: flex !important; align-items: center !important; gap: 6px !important; margin-bottom: 8px !important; font-weight: 500 !important; color: #374151 !important;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="8" x2="12" y2="12"></line>
                                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                    </svg>
                                    <span>Priority</span>
                                </label>
                                <select name="priority" required style="width: 100% !important; padding: 12px 14px !important; border: 1px solid #d1d5db !important; border-radius: 8px !important; font-size: 0.95rem !important; box-sizing: border-box !important; transition: all 0.3s ease !important; cursor: pointer !important;">
                                    <option value="low" ${task?.priority === 'low' ? 'selected' : ''}>Low</option>
                                    <option value="medium" ${task?.priority === 'medium' || !task ? 'selected' : ''}>Medium</option>
                                    <option value="high" ${task?.priority === 'high' ? 'selected' : ''}>High</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label style="display: flex !important; align-items: center !important; gap: 6px !important; margin-bottom: 8px !important; font-weight: 500 !important; color: #374151 !important;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                                    </svg>
                                    <span>Project</span>
                                </label>
                                <select name="project_id" style="width: 100% !important; padding: 12px 14px !important; border: 1px solid #d1d5db !important; border-radius: 8px !important; font-size: 0.95rem !important; box-sizing: border-box !important; transition: all 0.3s ease !important; cursor: pointer !important;">
                                    <option value="">No Project</option>
                                    ${projectOptions}
                                </select>
                            </div>
                        </div>
                        <div class="form-row" style="display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 16px !important; margin-bottom: 20px !important;">
                            <div class="form-group">
                                <label style="display: flex !important; align-items: center !important; gap: 6px !important; margin-bottom: 8px !important; font-weight: 600 !important; color: #667eea !important;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                    <span>Due Date</span>
                                </label>
                                <input type="date" name="due_date" id="dueDateInput" required value="${taskDueDate.split('T')[0] || ''}" style="width: 100% !important; padding: 12px 14px !important; border: 1.5px solid #d1d5db !important; border-radius: 8px !important; font-size: 0.95rem !important; box-sizing: border-box !important; background: linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%) !important; color: #374151 !important; font-weight: 500 !important; transition: all 0.3s ease !important; cursor: pointer !important;">
                            </div>
                            <div class="form-group">
                                <label style="display: flex !important; align-items: center !important; gap: 6px !important; margin-bottom: 8px !important; font-weight: 600 !important; color: #667eea !important;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <path d="M12 6v6l4 2"></path>
                                    </svg>
                                    <span>Due Time</span>
                                </label>
                                <div style="display: flex !important; gap: 8px !important; align-items: center !important;">
                                    <select name="due_hour" id="dueHourInput" required style="flex: 1 !important; padding: 12px 14px !important; border: 1.5px solid #d1d5db !important; border-radius: 8px !important; font-size: 0.95rem !important; box-sizing: border-box !important; background: linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%) !important; color: #374151 !important; font-weight: 500 !important; cursor: pointer !important;">
                                        ${this.generateHourOptions(taskDueDate)}
                                    </select>
                                    <span style="font-weight: 600 !important; color: #6b7280 !important;">:</span>
                                    <select name="due_minute" id="dueMinuteInput" required style="flex: 1 !important; padding: 12px 14px !important; border: 1.5px solid #d1d5db !important; border-radius: 8px !important; font-size: 0.95rem !important; box-sizing: border-box !important; background: linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%) !important; color: #374151 !important; font-weight: 500 !important; cursor: pointer !important;">
                                        ${this.generateMinuteOptions(taskDueDate)}
                                    </select>
                                    <select name="due_period" id="duePeriodInput" required style="flex: 0.8 !important; padding: 12px 10px !important; border: 1.5px solid #d1d5db !important; border-radius: 8px !important; font-size: 0.95rem !important; box-sizing: border-box !important; background: linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%) !important; color: #374151 !important; font-weight: 600 !important; cursor: pointer !important;">
                                        ${this.generatePeriodOptions(taskDueDate)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="form-group" style="margin-bottom: 20px !important;">
                            <label style="display: flex !important; align-items: center !important; gap: 6px !important; margin-bottom: 8px !important; font-weight: 500 !important; color: #374151 !important;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <circle cx="12" cy="12" r="4"></circle>
                                    <line x1="21.17" y1="8" x2="12" y2="8"></line>
                                    <line x1="3.95" y1="6.06" x2="8.54" y2="14"></line>
                                    <line x1="10.88" y1="21.94" x2="15.46" y2="14"></line>
                                </svg>
                                <span>Card Color</span>
                            </label>
                            <div style="display: flex !important; gap: 8px !important; align-items: center !important;">
                                <input type="color" name="card_color" id="cardColorInput" value="${task?.card_color || '#fecaca'}" style="width: 60px !important; height: 48px !important; padding: 4px !important; border: 1.5px solid #d1d5db !important; border-radius: 8px !important; cursor: pointer !important; background: white !important;">
                                <div id="colorPreview" style="flex: 1 !important; padding: 12px 14px !important; border: 1.5px solid #d1d5db !important; border-radius: 8px !important; background: ${task?.card_color || '#fecaca'} !important; color: #1f2937 !important; font-weight: 600 !important; text-align: center !important; font-size: 0.85rem !important;">Preview</div>
                            </div>
                        </div>
                        <div class="form-group" style="margin-bottom: 20px !important;">
                            <label style="display: flex !important; align-items: center !important; justify-content: space-between !important; margin-bottom: 12px !important; font-weight: 600 !important; color: #374151 !important;">
                                <div style="display: flex !important; align-items: center !important; gap: 6px !important;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="9 11 12 14 22 4"></polyline>
                                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                                    </svg>
                                    <span>Subtasks / Checklist</span>
                                </div>
                                <button type="button" id="addSubtaskBtn" style="padding: 6px 12px !important; border-radius: 6px !important; font-size: 0.85rem !important; font-weight: 500 !important; cursor: pointer !important; background: #667eea !important; border: none !important; color: white !important; display: flex !important; align-items: center !important; gap: 4px !important;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                    Add
                                </button>
                            </label>
                            <div id="subtasksList" style="display: flex !important; flex-direction: column !important; gap: 8px !important; max-height: 200px !important; overflow-y: auto !important;">
                                <!-- Subtasks will be loaded here and new inline subtasks can be added -->
                            </div>
                        </div>
                    </form>
                    <div class="modal-footer" style="padding: 20px 24px !important; border-top: 1px solid #e5e7eb !important; display: flex !important; justify-content: flex-end !important; gap: 12px !important; background: #f9fafb !important;">
                        <button type="button" class="btn secondary modal-cancel" style="padding: 10px 20px !important; border-radius: 8px !important; font-weight: 500 !important; cursor: pointer !important; background: white !important; border: 1px solid #d1d5db !important; color: #374151 !important;">Cancel</button>
                        <button type="submit" form="dashboardTaskForm" class="btn primary" style="padding: 10px 20px !important; border-radius: 8px !important; font-weight: 500 !important; cursor: pointer !important; background: #667eea !important; border: none !important; color: white !important;">${isEdit ? 'Update' : 'Create'} Task</button>
                    </div>
                </div>
            `;

            console.log('Appending modal to body...');
            document.body.appendChild(modal);
            console.log('Modal appended successfully');
            
            // Store defaultProjectId for form submission, but don't delete it yet
            const savedDefaultProjectId = this.defaultProjectId;
            
            console.log('=== showTaskModal END ===');

            // Event listeners
            modal.querySelector('.modal-close').addEventListener('click', () => this.closeModal(modal));
            modal.querySelector('.modal-cancel').addEventListener('click', () => this.closeModal(modal));
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal(modal);
            });

            // Color picker event listener
            const colorInput = modal.querySelector('#cardColorInput');
            const colorPreview = modal.querySelector('#colorPreview');
            if (colorInput && colorPreview) {
                colorInput.addEventListener('input', (e) => {
                    colorPreview.style.background = e.target.value;
                });
            }

            // Subtask add button (inline)
            const addSubtaskBtn = modal.querySelector('#addSubtaskBtn');
            const subtasksList = modal.querySelector('#subtasksList');
            function addInlineSubtask(title = '') {
                if (!subtasksList) return;
                const row = document.createElement('div');
                row.className = 'subtask-inline-row';
                row.style.cssText = 'display:flex;gap:8px;align-items:center;';
                row.innerHTML = `<input type="text" name="subtask_title" class="subtask-inline-input" placeholder="Subtask title" value="${title}"><button type="button" class="btn small subtask-inline-remove">Remove</button>`;
                subtasksList.appendChild(row);
                const removeBtn = row.querySelector('.subtask-inline-remove');
                removeBtn.addEventListener('click', () => row.remove());
            }

            if (addSubtaskBtn) {
                addSubtaskBtn.addEventListener('click', () => addInlineSubtask());
            }

            // If editing, clicking Add should still add an inline row (in addition to prompt)
            if (isEdit && addSubtaskBtn) {
                addSubtaskBtn.addEventListener('click', () => addInlineSubtask());
            }

            // Load existing subtasks into inline list if editing
            if (isEdit) {
                this.loadSubtasks(taskId, modal).then(() => {
                    // When loadSubtasks populates #subtasksList it replaces content; ensure existing items have remove handlers
                    modal.querySelectorAll('.delete-subtask').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const subtaskId = e.currentTarget.dataset.subtaskId;
                            this.deleteSubtask(taskId, subtaskId, modal);
                        });
                    });
                });
            }

            modal.querySelector('#dashboardTaskForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = modal.querySelector('button[type="submit"][form="dashboardTaskForm"]');
                if (submitBtn) submitBtn.disabled = true;
                const formData = new FormData(e.target);
                const taskData = Object.fromEntries(formData.entries());

                // Combine date and time inputs into a single datetime
                const combinedDateTime = this.combineDateTimeInputs(formData);
                if (combinedDateTime) {
                    taskData.due_date = combinedDateTime;
                }

                // Remove the individual time fields
                delete taskData.due_hour;
                delete taskData.due_minute;
                delete taskData.due_period;

                // Convert empty strings to null
                Object.keys(taskData).forEach(key => {
                    if (taskData[key] === '') taskData[key] = null;
                });
                
                // Ensure project_id is preserved if defaultProjectId was set
                if (!taskData.project_id && savedDefaultProjectId) {
                    taskData.project_id = savedDefaultProjectId;
                }
                
                console.log('Task data being submitted:', taskData);

                // Validate required fields (extra guard)
                if (!taskData.title) { alert('Title is required'); return; }
                if (!taskData.priority) { alert('Priority is required'); return; }
                if (!taskData.due_date) { alert('Due date and time are required'); return; }

                // Collect inline subtasks
                const inlineSubtasks = [];
                modal.querySelectorAll('input[name="subtask_title"]').forEach(inp => {
                    const v = (inp.value || '').trim();
                    if (v) inlineSubtasks.push(v);
                });

                try {
                    // For new tasks, attach a client-side idempotency token to help prevent duplicates
                    if (!isEdit) {
                        try {
                            if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                                taskData.client_token = window.crypto.randomUUID();
                            } else if (window.crypto && window.crypto.getRandomValues) {
                                const arr = new Uint32Array(4);
                                window.crypto.getRandomValues(arr);
                                taskData.client_token = Array.from(arr).map(n => n.toString(16)).join('-');
                            } else {
                                taskData.client_token = 'ct_' + Date.now() + '_' + Math.floor(Math.random()*1000000);
                            }
                        } catch (tokErr) {
                            taskData.client_token = 'ct_' + Date.now() + '_' + Math.floor(Math.random()*1000000);
                        }
                    }

                    let createdOrUpdatedTask = null;
                    if (isEdit) {
                        createdOrUpdatedTask = await this.updateTask(taskId, taskData);
                    } else {
                        createdOrUpdatedTask = await this.createTask(taskData);
                    }

                    // If there are inline subtasks and we have a task id, create them
                    const newTaskId = createdOrUpdatedTask && createdOrUpdatedTask.id ? createdOrUpdatedTask.id : (isEdit ? taskId : null);
                    if (newTaskId && inlineSubtasks.length > 0) {
                        for (const st of inlineSubtasks) {
                            try {
                                await fetch(`/api/tasks/${newTaskId}/subtasks`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ title: st })
                                });
                            } catch (err) {
                                console.warn('Failed to create subtask', err);
                            }
                        }
                    }

                    this.closeModal(modal);
                } catch (error) {
                    // Error handling is done in the API methods
                }
                finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });

            // Load subtasks if editing
            if (isEdit) {
                this.loadSubtasks(taskId, modal);
                
                // Add subtask button event listener
                const addSubtaskBtn = modal.querySelector('#addSubtaskBtn');
                if (addSubtaskBtn) {
                    addSubtaskBtn.addEventListener('click', () => this.promptAddSubtask(taskId, modal));
                }
            }
        } catch (error) {
            console.error('Error in showTaskModal:', error);
            alert('Failed to open task modal. Please check the console for details.');
        }
    }

    async loadSubtasks(taskId, modal) {
        try {
            const response = await fetch(`/api/tasks/${taskId}/subtasks`);
            if (!response.ok) throw new Error('Failed to load subtasks');
            
            const data = await response.json();
            const subtasks = data.subtasks || [];
            const subtasksList = modal.querySelector('#subtasksList');
            
            if (!subtasksList) return;
            
            if (subtasks.length === 0) {
                subtasksList.innerHTML = '<p style="color: #9ca3af !important; font-size: 0.9rem !important; text-align: center !important; padding: 20px 0 !important;">No subtasks yet. Click "Add" to create one.</p>';
            } else {
                subtasksList.innerHTML = subtasks.map(subtask => `
                    <div class="subtask-item" data-subtask-id="${subtask.id}" style="display: flex !important; align-items: center !important; gap: 10px !important; padding: 10px 12px !important; background: ${subtask.completed ? '#f0fdf4' : '#ffffff'} !important; border: 1px solid ${subtask.completed ? '#86efac' : '#e5e7eb'} !important; border-radius: 8px !important; transition: all 0.2s !important;">
                        <input 
                            type="checkbox" 
                            ${subtask.completed ? 'checked' : ''} 
                            data-subtask-id="${subtask.id}"
                            style="width: 18px !important; height: 18px !important; cursor: pointer !important; accent-color: #10b981 !important;"
                        />
                        <span style="flex: 1 !important; font-size: 0.95rem !important; color: ${subtask.completed ? '#059669' : '#374151'} !important; text-decoration: ${subtask.completed ? 'line-through' : 'none'} !important;">${subtask.title}</span>
                        <button 
                            type="button" 
                            class="delete-subtask" 
                            data-subtask-id="${subtask.id}"
                            style="padding: 4px 8px !important; background: #fee2e2 !important; border: 1px solid #fecaca !important; border-radius: 6px !important; cursor: pointer !important; color: #dc2626 !important; font-size: 0.85rem !important; transition: all 0.2s !important;"
                            onmouseover="this.style.background='#fecaca'"
                            onmouseout="this.style.background='#fee2e2'"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                `).join('');
                
                // Add event listeners for checkboxes
                subtasksList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                    checkbox.addEventListener('change', (e) => {
                        const subtaskId = e.target.dataset.subtaskId;
                        this.toggleSubtask(taskId, subtaskId, modal);
                    });
                });
                
                // Add event listeners for delete buttons
                subtasksList.querySelectorAll('.delete-subtask').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const subtaskId = e.currentTarget.dataset.subtaskId;
                        this.deleteSubtask(taskId, subtaskId, modal);
                    });
                });
            }
        } catch (error) {
            console.error('Error loading subtasks:', error);
        }
    }

    promptAddSubtask(taskId, modal) {
        const title = prompt('Enter subtask title:');
        if (title && title.trim()) {
            this.addSubtask(taskId, title.trim(), modal);
        }
    }

    async addSubtask(taskId, title, modal) {
        try {
            const response = await fetch(`/api/tasks/${taskId}/subtasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to add subtask');
            }
            
            // Reload subtasks and refresh task card
            await this.loadSubtasks(taskId, modal);
            await this.loadTasks();
        } catch (error) {
            console.error('Error adding subtask:', error);
            alert('Failed to add subtask: ' + error.message);
        }
    }

    async toggleSubtask(taskId, subtaskId, modal) {
        try {
            const response = await fetch(`/api/subtasks/${subtaskId}/toggle`, {
                method: 'PUT'
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to toggle subtask');
            }
            
            // Reload subtasks and refresh task card
            await this.loadSubtasks(taskId, modal);
            await this.loadTasks();
        } catch (error) {
            console.error('Error toggling subtask:', error);
            alert('Failed to toggle subtask: ' + error.message);
        }
    }

    async deleteSubtask(taskId, subtaskId, modal) {
        if (!confirm('Are you sure you want to delete this subtask?')) return;
        
        try {
            const response = await fetch(`/api/subtasks/${subtaskId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete subtask');
            }
            
            // Reload subtasks and refresh task card
            await this.loadSubtasks(taskId, modal);
            await this.loadTasks();
        } catch (error) {
            console.error('Error deleting subtask:', error);
            alert('Failed to delete subtask: ' + error.message);
        }
    }

    showProjectModal(project = null) {
        console.log('🚀 showProjectModal called with project:', project);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background: rgba(0,0,0,0.5) !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 10000 !important; backdrop-filter: blur(4px) !important; padding: 20px !important;';
        modal.innerHTML = `
            <div class="modal" style="background: white !important; border-radius: 16px !important; width: 90% !important; max-width: 500px !important; max-height: 90vh !important; overflow-y: auto !important; box-shadow: 0 20px 40px rgba(0,0,0,0.15) !important; position: relative !important; display: block !important;">
                <div class="modal-header" style="padding: 24px !important; border-bottom: 1px solid #e5e7eb !important; display: flex !important; justify-content: space-between !important; align-items: center !important;">
                    <h3 style="margin: 0 !important; font-size: 1.5rem !important; font-weight: 600 !important;">${project ? 'Edit Project' : 'New Project'}</h3>
                    <button class="modal-close" style="background: none !important; border: none !important; font-size: 2rem !important; cursor: pointer !important; color: #6b7280 !important; line-height: 1 !important; padding: 0 !important; width: 32px !important; height: 32px !important; display: flex !important; align-items: center !important; justify-content: center !important; border-radius: 8px !important; transition: background 0.2s !important;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='none'">&times;</button>
                </div>
                <form class="modal-body" id="projectForm" style="padding: 24px !important;">
                    <div class="form-group" style="margin-bottom: 20px !important;">
                        <label style="display: block !important; margin-bottom: 8px !important; font-weight: 500 !important; color: #374151 !important;">Project Name *</label>
                            <input type="text" name="name" required value="${project ? this.escapeHtml(project.name) : ''}" style="width: 100% !important; padding: 10px 12px !important; border: 1px solid #d1d5db !important; border-radius: 8px !important; font-size: 0.95rem !important; box-sizing: border-box !important;">
                    </div>
                    <div class="form-group" style="margin-bottom: 20px !important;">
                        <label style="display: block !important; margin-bottom: 8px !important; font-weight: 500 !important; color: #374151 !important;">Description</label>
                        <textarea name="description" rows="3" style="width: 100% !important; padding: 10px 12px !important; border: 1px solid #d1d5db !important; border-radius: 8px !important; font-size: 0.95rem !important; resize: vertical !important; box-sizing: border-box !important;">${project ? this.escapeHtml(project.description || '') : ''}</textarea>
                    </div>
                    <div class="form-group" style="margin-bottom: 20px !important;">
                        <label style="display: block !important; margin-bottom: 8px !important; font-weight: 500 !important; color: #374151 !important;">Color</label>
                        <input type="color" name="color" value="${project ? (project.color || '#667eea') : '#667eea'}" style="width: 100% !important; height: 48px !important; padding: 4px !important; border: 1px solid #d1d5db !important; border-radius: 8px !important; cursor: pointer !important;">
                    </div>
                </form>
                <div class="modal-footer" style="padding: 20px 24px !important; border-top: 1px solid #e5e7eb !important; display: flex !important; justify-content: flex-end !important; gap: 12px !important; background: #f9fafb !important;">
                    <button type="button" class="btn secondary modal-cancel" style="padding: 10px 20px !important; border-radius: 8px !important; font-weight: 500 !important; cursor: pointer !important; background: white !important; border: 1px solid #d1d5db !important; color: #374151 !important;">Cancel</button>
                    <button type="submit" form="projectForm" class="btn primary" style="padding: 10px 20px !important; border-radius: 8px !important; font-weight: 500 !important; cursor: pointer !important; background: #667eea !important; border: none !important; color: white !important;">Create Project</button>
                </div>
            </div>
        `;

        console.log('📝 Modal HTML created, appending to body...');
        document.body.appendChild(modal);
        console.log('✅ Modal appended! Total modals in DOM:', document.querySelectorAll('.modal-overlay').length);

        // Event listeners
        modal.querySelector('.modal-close').addEventListener('click', () => this.closeModal(modal));
        modal.querySelector('.modal-cancel').addEventListener('click', () => this.closeModal(modal));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal(modal);
        });

            modal.querySelector('#projectForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const projectData = Object.fromEntries(formData.entries());
            
            try {
                    let result = null;
                    if (project && project.id) {
                        // Update existing project
                        result = await this.apiCall(`/projects/${project.id}`, 'PUT', projectData);
                        // Replace in local list
                        this.projects = this.projects.map(p => p.id === project.id ? result.project : p);
                        this.showNotification('success', 'Project updated successfully!');
                    } else {
                        // Create new project
                        result = await this.apiCall('/projects', 'POST', projectData);
                        this.projects.push(result.project);
                        this.showNotification('success', 'Project created successfully!');
                    }
                    this.renderProjectsList();
                    this.closeModal(modal);
            } catch (error) {
                // Error handling is done in the API method
            }
        });
    }

    closeModal(modal) {
        modal.remove();
        // Clear defaultProjectId when modal closes
        if (this.defaultProjectId) {
            delete this.defaultProjectId;
        }
    }

    // Utility Methods
    async updateTaskStatus(taskId, status) {
        const task = this.tasks.find(t => t.id === taskId);
        await this.updateTask(taskId, { status });
        
        // Show completion notification
        if (status === 'completed' && task && typeof showCompletionNotification === 'function') {
            showCompletionNotification(task.title);
        }
    }

    showTaskDetails(taskId) {
        // Show task details modal (simplified for now)
        this.showTaskModal(taskId);
    }

    showTaskMenu(taskId) {
        // Show context menu for task actions (simplified)
        if (confirm('Delete this task?')) {
            this.deleteTask(taskId);
        }
    }

    toggleFavorite(taskId) {
        // Placeholder for favorite functionality
        console.log('Toggle favorite for task:', taskId);
    }

    filterByProject(projectId) {
        // Set the current project ID
        this.currentProjectId = projectId;

        // Update the UI to show which project is selected
        document.querySelectorAll('#projects .nav-item.sub-item').forEach(item => {
            if (parseInt(item.dataset.projectId) === projectId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Clear other filters
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelector('.tab:first-child').classList.add('active');
        this.currentFilter = 'all';

        // Load tasks for this project
        this.loadTasks({ project_id: projectId });

        // Update Projects button to show current project
        const projectName = this.projects.find(p => p.id === projectId)?.name || 'All Projects';
        document.querySelector('.nav-item[onclick="toggleProjects()"] span').textContent = projectName;
    }

    showNotification(type, message) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    generateHourOptions(dateTimeString) {
        const hours = dateTimeString ? new Date(dateTimeString).getHours() : 12;
        const hour12 = hours % 12 || 12;
        let options = '';
        for (let i = 1; i <= 12; i++) {
            options += `<option value="${i}" ${i === hour12 ? 'selected' : ''}>${i.toString().padStart(2, '0')}</option>`;
        }
        return options;
    }

    generateMinuteOptions(dateTimeString) {
        const minutes = dateTimeString ? new Date(dateTimeString).getMinutes() : 0;
        let options = '';
        for (let i = 0; i < 60; i += 5) {
            options += `<option value="${i}" ${i === Math.floor(minutes / 5) * 5 ? 'selected' : ''}>${i.toString().padStart(2, '0')}</option>`;
        }
        return options;
    }

    generatePeriodOptions(dateTimeString) {
        const hours = dateTimeString ? new Date(dateTimeString).getHours() : 12;
        const period = hours >= 12 ? 'PM' : 'AM';
        return `
            <option value="AM" ${period === 'AM' ? 'selected' : ''}>AM</option>
            <option value="PM" ${period === 'PM' ? 'selected' : ''}>PM</option>
        `;
    }

    combineDateTimeInputs(formData) {
        const date = formData.get('due_date');
        const hour = parseInt(formData.get('due_hour')) || 12;
        const minute = parseInt(formData.get('due_minute')) || 0;
        const period = formData.get('due_period') || 'AM';
        
        if (!date) return null;
        
        // Convert 12-hour to 24-hour format
        let hour24 = hour;
        if (period === 'PM' && hour !== 12) {
            hour24 = hour + 12;
        } else if (period === 'AM' && hour === 12) {
            hour24 = 0;
        }
        
        // Create datetime string
        const dateTime = new Date(date);
        dateTime.setHours(hour24, minute, 0, 0);
        return dateTime.toISOString();
    }

    adjustColorBrightness(hex, percent) {
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Convert to RGB
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);
        
        // Adjust brightness
        r = Math.max(0, Math.min(255, r + (r * percent / 100)));
        g = Math.max(0, Math.min(255, g + (g * percent / 100)));
        b = Math.max(0, Math.min(255, b + (b * percent / 100)));
        
        // Convert back to hex
        const rr = Math.round(r).toString(16).padStart(2, '0');
        const gg = Math.round(g).toString(16).padStart(2, '0');
        const bb = Math.round(b).toString(16).padStart(2, '0');
        
        return `#${rr}${gg}${bb}`;
    }

    renderDashboard() {
        // Load and render recent tasks into the dashboard
        (async () => {
            try {
                const container = document.getElementById('dashboardTasksList') || document.getElementById('dashboardRecentList');
                if (!container) return;
                // Clear existing
                container.innerHTML = '';

                // Fetch recent tasks (limit 6)
                const result = await this.apiCall('/tasks/recent?limit=6');
                const recent = result.tasks || [];

                if (recent.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-tasks"></i>
                            <h3>No recent tasks</h3>
                            <p>Create tasks and they'll appear here.</p>
                        </div>`;
                    return;
                }

                // Render each recent task using existing createTaskCard helper if available
                recent.forEach(task => {
                    // Normalize field names used by createTaskCard
                    const normalized = Object.assign({}, task, {
                        id: task.id,
                        priority: (task.priority || '').toLowerCase(),
                        project_name: task.project_name || (task.project && task.project.name) || 'No Project',
                        card_color: task.card_color || task.cardColor || '#fecaca',
                        subtask_count: task.subtask_count || (task.subtasks ? task.subtasks.length : 0),
                        subtask_completed: task.completed_subtasks || 0,
                        progress: task.progress || 0,
                        status: (task.status || '').toLowerCase()
                    });

                    try {
                        const card = this.createTaskCard(normalized);
                        container.appendChild(card);
                    } catch (e) {
                        // Fallback simple card
                        const el = document.createElement('div');
                        el.className = 'task-card';
                        el.innerHTML = `<div class="task-content"><h3>${this.escapeHtml(task.title || 'Untitled')}</h3><p>${this.escapeHtml(task.description || '')}</p></div>`;
                        container.appendChild(el);
                    }
                });
            } catch (error) {
                console.error('Failed to render dashboard recent tasks:', error);
            }
        })();
    }
}

// Initialize TaskWise when DOM is loaded - pero check muna if may existing instance na
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if not already initialized (prevent double initialization)
    if (!window.taskWise) {
        console.log('DOMContentLoaded - Initializing TaskWise...');
        try {
            window.taskWise = new TaskWise();
            console.log('TaskWise initialized successfully!', window.taskWise);
        } catch (error) {
            console.error('Failed to initialize TaskWise:', error);
        }
    } else {
        console.log('TaskWise already initialized, skipping...');
    }
});

// Additional utility functions
function toggleProjects() {
    const projects = document.getElementById('projects');
    const arrow = document.querySelector('.nav-arrow');
    const projectsButton = document.querySelector('.nav-item[onclick="toggleProjects()"]');
    
    projects.classList.toggle('show');
    arrow.style.transform = projects.classList.contains('show') ? 'rotate(180deg)' : 'rotate(0deg)';
    projectsButton.classList.toggle('active');
}