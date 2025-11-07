// analytics.js - fetches stats and tasks and renders charts + activity log
// analytics.js - fetches stats and tasks and renders charts + activity log
// Also: notify user of new activity (in-app toast + optional desktop notifications)
(async function(){
    const statsUrl = '/api/stats';
    const tasksUrl = '/api/tasks';

    function el(id){ return document.getElementById(id); }

    // Fetch stats and render KPIs
    async function loadStats(){
        try{
            const res = await fetch(statsUrl);
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to load stats');
            const s = data.stats || {};
            el('kpiTotal').textContent = s.total_tasks || 0;
            el('kpiCompleted').textContent = s.completed_tasks || 0;
            el('kpiCompletionRate').textContent = (s.completion_rate != null) ? (s.completion_rate + '%') : '0%';
        }catch(err){
            console.error('loadStats error', err);
        }
    }

    // No notifications: activity log should persist server-side and be displayed here

    // Fetch tasks and render charts + activity
    async function loadTasksAndRender(){
        try{
            const res = await fetch(tasksUrl);
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to load tasks');
            const tasks = data.tasks || [];

            // Status distribution
            const statusCounts = tasks.reduce((acc,t)=>{ const st=(t.status||'todo'); acc[st]=(acc[st]||0)+1; return acc; },{});
            const statuses = ['todo','in_progress','completed','overdue'];
            const statusValues = statuses.map(s=>statusCounts[s]||0);

            renderStatusPie(statussToLabels(statuses), statusValues);

            // Tasks by project
            const projMap = {};
            tasks.forEach(t=>{
                const name = (t.project && t.project.name) || t.project_name || 'No Project';
                projMap[name] = (projMap[name]||0)+1;
            });
            const projNames = Object.keys(projMap).slice(0,10);
            const projCounts = projNames.map(n=>projMap[n]);
            renderProjectBar(projNames, projCounts);

            // Activity log: use updated_at desc
            const sorted = tasks.slice().sort((a,b)=>{ const A=a.updated_at||a.created_at||''; const B=b.updated_at||b.created_at||''; return (B>A)?1:(B<A?-1:0); });

            // Instead of deriving activity from tasks, fetch the persisted activity log
            try {
                const actRes = await fetch('/api/activity?limit=50');
                const actData = await actRes.json();
                if (actData.success) {
                    renderActivityLog(actData.activities);
                } else {
                    // fallback: render from tasks as before
                    renderActivityLog(sorted.slice(0,50));
                }
            } catch (e) {
                console.warn('Failed to load activity log, falling back to task-derived log', e);
                renderActivityLog(sorted.slice(0,50));
            }

        }catch(err){
            console.error('loadTasksAndRender error', err);
        }
    }

    function statussToLabels(arr){
        return arr.map(s=> s === 'todo' ? 'To Do' : s === 'in_progress' ? 'In Progress' : s === 'completed' ? 'Completed' : 'Overdue');
    }

    let statusChart = null;
    function renderStatusPie(labels, values){
        const ctx = document.getElementById('statusPie').getContext('2d');
        if (statusChart) statusChart.destroy();
        statusChart = new Chart(ctx, {
            type: 'pie',
            data: { labels, datasets: [{ data: values, backgroundColor: ['#93c5fd','#fbbf24','#34d399','#f87171'] }] },
            options: { responsive:true, plugins:{legend:{position:'bottom'}} }
        });
    }

    let projectChart = null;
    function renderProjectBar(labels, values){
        const ctx = document.getElementById('projectBar').getContext('2d');
        if (projectChart) projectChart.destroy();
        projectChart = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Tasks', data: values, backgroundColor: '#7c3aed' }] },
            options: { responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
        });
    }

    function renderActivityLog(items){
        const container = document.getElementById('activityLog');
        container.innerHTML = '';
        items.forEach(it=>{
            const row = document.createElement('div');
            row.className = 'activity-row';
            const time = it.created_at || it.updated_at || '';
            const date = time ? new Date(time).toLocaleString() : '';
            let title = '';
            let subtitle = '';
            if (it.message) {
                title = it.event_type ? `${it.event_type.replace('_',' ')}:` : '';
                title = `${title} ${it.message}`.trim();
            } else {
                // fallback to task-derived shape
                const ttitle = it.title || 'Untitled';
                const status = it.status ? (it.status.charAt(0).toUpperCase()+it.status.slice(1)) : '';
                title = ttitle;
                subtitle = `${status}`;
            }
            row.innerHTML = `<div style="font-weight:600">${escapeHtml(title)}</div><div style="font-size:0.85rem;color:#6b7280">${escapeHtml(subtitle)} ${date ? ' • ' + escapeHtml(date) : ''}</div>`;
            container.appendChild(row);
        });
    }

    function escapeHtml(str){
        if (!str) return '';
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // initial load
    await loadStats();
    await loadTasksAndRender();

    // refresh periodically
    setInterval(async ()=>{ await loadStats(); await loadTasksAndRender(); }, 60_000);
})();
