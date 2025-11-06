// notifications.js - fetch and render notifications
document.addEventListener('DOMContentLoaded', () => {
  const bell = document.getElementById('notificationBell');
  const dropdown = document.getElementById('notificationsDropdown');
  const badge = document.getElementById('notificationBadge');
  const list = document.getElementById('notificationsList');
  const clearBtn = document.getElementById('clearAllBtn');

  let open = false;

  async function loadNotifications() {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (!data.success) return;
      const notifs = data.notifications || [];
      badge.textContent = notifs.filter(n => !n.read).length;
      renderList(notifs);
    } catch (e) {
      console.error('Failed to load notifications', e);
    }
  }

  function renderList(notifs) {
    list.innerHTML = '';
    if (!notifs.length) {
      list.innerHTML = '<div class="notif-empty">No notifications</div>';
      return;
    }
    notifs.forEach(n => {
      const item = document.createElement('div');
      item.className = 'notif-item' + (n.read ? ' read' : ' unread');
      item.innerHTML = `
        <div class="notif-title">${escapeHtml(n.title)}</div>
        <div class="notif-message">${escapeHtml(n.message)}</div>
        <div class="notif-actions">
          <button class="btn small mark-read" data-id="${n.id}">${n.read ? 'Read' : 'Mark read'}</button>
        </div>
      `;
      list.appendChild(item);
    });
    // attach listeners
    list.querySelectorAll('.mark-read').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt(btn.dataset.id, 10);
        await markRead(id);
        await loadNotifications();
      });
    });
  }

  async function markRead(id) {
    try {
      await fetch('/api/notifications/mark_read', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({id})
      });
    } catch (e) {
      console.error('markRead error', e);
    }
  }

  bell.addEventListener('click', async (e) => {
    open = !open;
    dropdown.style.display = open ? 'block' : 'none';
    if (open) await loadNotifications();
  });

  clearBtn.addEventListener('click', async () => {
    // mark all visible notifications as read
    const items = list.querySelectorAll('.notif-item.unread .mark-read');
    for (const btn of items) {
      const id = parseInt(btn.dataset.id, 10);
      await markRead(id);
    }
    await loadNotifications();
  });

  // small helper to avoid HTML injection
  function escapeHtml(str){
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // close dropdown when clicking outside
  document.addEventListener('click', (e)=>{
    if (!bell.contains(e.target) && !dropdown.contains(e.target)){
      dropdown.style.display = 'none'; open = false;
    }
  });

  // initial load to set badge
  loadNotifications();
});
