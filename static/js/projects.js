// Projects page functionality
document.addEventListener('DOMContentLoaded', function() {
    const addProjectBtn = document.getElementById('addProjectBtn');
    const addProjectModal = document.getElementById('addProjectModal');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const addProjectForm = document.getElementById('addProjectForm');
    const projectsGrid = document.getElementById('projectsGrid');

    let editingProjectId = null;
    let currentFilter = 'all';

    // Get projects from API
    async function getProjects() {
        try {
            const response = await fetch('/api/projects');
            const data = await response.json();
            if (data.success) {
                return data.projects || [];
            }
            return [];
        } catch (error) {
            console.error('Error fetching projects:', error);
            return [];
        }
    }

    // Open modal for new project
    addProjectBtn.addEventListener('click', function() {
        editingProjectId = null;
        addProjectForm.reset();
        document.getElementById('modalTitle').textContent = 'Add New Project';
        document.getElementById('submitBtn').textContent = 'Add Project';
        addProjectModal.classList.add('active');
    });

    // Close modal
    function closeModalFunc() {
        addProjectModal.classList.remove('active');
        addProjectForm.reset();
        editingProjectId = null;
    }

    closeModal.addEventListener('click', closeModalFunc);
    cancelBtn.addEventListener('click', closeModalFunc);

    // Close modal when clicking outside
    addProjectModal.addEventListener('click', function(e) {
        if (e.target === addProjectModal) {
            closeModalFunc();
        }
    });

    // Handle form submission
    addProjectForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const projectName = document.getElementById('projectName').value;
        const projectDescription = document.getElementById('projectDescription').value;
        const projectColor = document.querySelector('input[name="projectColor"]:checked').value;

        const projectData = {
            name: projectName,
            description: projectDescription,
            color: projectColor
        };

        try {
            let response;
            if (editingProjectId) {
                // Update existing project
                response = await fetch(`/api/projects/${editingProjectId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(projectData)
                });
            } else {
                // Create new project
                response = await fetch('/api/projects', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(projectData)
                });
            }

            const data = await response.json();
            if (data.success) {
                closeModalFunc();
                loadProjects(currentFilter);
            } else {
                alert(data.error || 'Failed to save project');
            }
        } catch (error) {
            console.error('Error saving project:', error);
            alert('Failed to save project');
        }
    });

    // Open edit modal
    function openEditProject(projectId) {
        fetch(`/api/projects/${projectId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const project = data.project;
                    editingProjectId = projectId;
                    document.getElementById('projectName').value = project.name;
                    document.getElementById('projectDescription').value = project.description || '';
                    
                    // Select the correct color
                    const colorRadio = document.querySelector(`input[name="projectColor"][value="${project.color}"]`);
                    if (colorRadio) {
                        colorRadio.checked = true;
                    }
                    
                    document.getElementById('modalTitle').textContent = 'Edit Project';
                    document.getElementById('submitBtn').textContent = 'Update Project';
                    addProjectModal.classList.add('active');
                }
            })
            .catch(error => {
                console.error('Error fetching project:', error);
            });
    }

    // Delete project
    async function deleteProject(projectId) {
        if (confirm('Are you sure you want to delete this project? Tasks in this project will not be deleted.')) {
            try {
                const response = await fetch(`/api/projects/${projectId}`, {
                    method: 'DELETE'
                });
                const data = await response.json();
                if (data.success) {
                    loadProjects(currentFilter);
                } else {
                    alert(data.error || 'Failed to delete project');
                }
            } catch (error) {
                console.error('Error deleting project:', error);
                alert('Failed to delete project');
            }
        }
    }

    // Function to create project card HTML
    function addProjectCard(project) {
        const projectCard = document.createElement('div');
        projectCard.className = 'project-card';
        projectCard.dataset.projectId = project.id;

        const progress = project.total_tasks > 0 
            ? Math.round((project.completed_tasks / project.total_tasks) * 100) 
            : 0;

        projectCard.innerHTML = `
            <div class="project-header">
                <div class="project-color" style="background: ${project.color || '#3b82f6'};"></div>
                <button class="card-menu" data-project-id="${project.id}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="1" fill="currentColor"/>
                        <circle cx="19" cy="12" r="1" fill="currentColor"/>
                        <circle cx="5" cy="12" r="1" fill="currentColor"/>
                    </svg>
                    <div class="card-menu-dropdown">
                        <button class="menu-item" data-action="edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke-width="2"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-width="2"/>
                            </svg>
                            Edit
                        </button>
                        <button class="menu-item danger" data-action="delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polyline points="3 6 5 6 21 6" stroke-width="2"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke-width="2"/>
                            </svg>
                            Delete
                        </button>
                    </div>
                </button>
            </div>
            <h3 class="project-title">${escapeHtml(project.name)}</h3>
            <p class="project-description">${escapeHtml(project.description || 'No description')}</p>
            <div class="project-stats">
                <div class="stat-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M9 11L12 14L22 4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="12" cy="12" r="10" stroke-width="2"/>
                    </svg>
                    <span>${project.completed_tasks || 0}/${project.total_tasks || 0} tasks</span>
                </div>
                <div class="stat-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke-width="2"/>
                    </svg>
                    <span>${progress}% complete</span>
                </div>
            </div>
            <div class="project-footer">
                <div class="project-team">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(project.name)}&background=0b63d6&color=fff" alt="Project" class="team-avatar">
                </div>
                <span class="project-date">Created: ${formatDate(project.created_at)}</span>
            </div>
        `;

        // Add click handler to view project tasks
        projectCard.addEventListener('click', function(e) {
            if (!e.target.closest('.card-menu')) {
                // Navigate to project detail page
                window.location.href = `/projects/${project.id}`;
            }
        });

        // Card menu handler
        const menuBtn = projectCard.querySelector('.card-menu');
        const menuDropdown = projectCard.querySelector('.card-menu-dropdown');

        menuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            
            // Close all other dropdowns
            document.querySelectorAll('.card-menu-dropdown').forEach(dropdown => {
                if (dropdown !== menuDropdown) {
                    dropdown.classList.remove('active');
                }
            });
            
            menuDropdown.classList.toggle('active');
        });

        // Menu item handlers
        menuDropdown.addEventListener('click', function(e) {
            e.stopPropagation();
            const menuItem = e.target.closest('.menu-item');
            if (menuItem) {
                const action = menuItem.dataset.action;
                if (action === 'edit') {
                    openEditProject(project.id);
                } else if (action === 'delete') {
                    deleteProject(project.id);
                }
                menuDropdown.classList.remove('active');
            }
        });

        projectsGrid.appendChild(projectCard);
    }

    // Close all dropdowns when clicking outside
    document.addEventListener('click', function() {
        document.querySelectorAll('.card-menu-dropdown').forEach(dropdown => {
            dropdown.classList.remove('active');
        });
    });

    // Tab switching functionality
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const filterType = this.dataset.tab;
            currentFilter = filterType;
            loadProjects(filterType);
        });
    });

    // Load projects with filter
    async function loadProjects(filterType = 'all') {
        let projects = await getProjects();
        
        // Filter projects based on tab
        if (filterType === 'active') {
            projects = projects.filter(p => p.total_tasks === 0 || p.completed_tasks < p.total_tasks);
        } else if (filterType === 'completed') {
            projects = projects.filter(p => p.total_tasks > 0 && p.completed_tasks === p.total_tasks);
        }
        
        // Clear grid
        projectsGrid.innerHTML = '';
        
        // Add projects
        if (projects.length === 0) {
            projectsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-secondary);">No projects found. Create one to get started!</div>';
        } else {
            projects.forEach(project => {
                addProjectCard(project);
            });
        }
    }

    // Helper function to escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Helper function to format date
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }

    // Initial load
    loadProjects('all');
});
