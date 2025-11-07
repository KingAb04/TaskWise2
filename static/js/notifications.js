// notifications.js - fetch and render notifications
let notificationLoader = null; // Global reference to loadNotifications function

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
      const unreadCount = notifs.filter(n => !n.read).length;
      badge.textContent = unreadCount;
      // Show/hide badge based on count
      badge.style.display = unreadCount > 0 ? 'block' : 'none';
      renderList(notifs);
    } catch (e) {
      console.error('Failed to load notifications', e);
    }
  }
  
  // Expose globally so other functions can call it
  notificationLoader = loadNotifications;

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
          <button class="btn small delete-notif" data-id="${n.id}">
            <i class="fas fa-trash"></i> Delete
          </button>
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
    
    list.querySelectorAll('.delete-notif').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt(btn.dataset.id, 10);
        await deleteNotification(id);
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

  async function deleteNotification(id) {
    try {
      await fetch('/api/notifications/delete', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({id})
      });
    } catch (e) {
      console.error('deleteNotification error', e);
    }
  }

  bell.addEventListener('click', async (e) => {
    e.stopPropagation(); // Prevent event bubbling
    open = !open;
    dropdown.style.display = open ? 'block' : 'none';
    dropdown.setAttribute('aria-hidden', !open);
    if (open) await loadNotifications();
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      // Delete all notifications
      const response = await fetch('/api/notifications');
      const data = await response.json();
      
      if (data.success && data.notifications && data.notifications.length > 0) {
        // Delete each notification
        for (const notif of data.notifications) {
          await deleteNotification(notif.id);
        }
        // Reload to update the UI
        await loadNotifications();
      }
    });
  }

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

  // Check for due date notifications every minute
  checkDueDateNotifications();
  setInterval(checkDueDateNotifications, 60000); // Check every minute
});

// Function to check for tasks that are due soon or overdue
async function checkDueDateNotifications() {
  try {
    const response = await fetch('/api/tasks');
    const data = await response.json();
    
    if (!data.success) return;
    
    const tasks = data.tasks || [];
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    tasks.forEach(task => {
      if (!task.due_date || task.status === 'completed') return;
      
      const dueDate = new Date(task.due_date);
      const notificationKey = `notif_${task.id}_${task.due_date}`;
      
      // Check if we already notified for this task
      if (localStorage.getItem(notificationKey)) return;
      
      // Task is overdue
      if (dueDate < now) {
        showDueDateNotification(
          'Task Overdue! ⚠️',
          `"${task.title}" is overdue! Please complete it as soon as possible.`,
          'error'
        );
        localStorage.setItem(notificationKey, 'overdue');
      }
      // Task due within 1 hour
      else if (dueDate <= oneHourFromNow) {
        showDueDateNotification(
          'Task Due Soon! ⏰',
          `"${task.title}" is due in less than 1 hour!`,
          'warning'
        );
        localStorage.setItem(notificationKey, '1hour');
      }
      // Task due within 24 hours
      else if (dueDate <= oneDayFromNow) {
        showDueDateNotification(
          'Task Due Tomorrow 📅',
          `"${task.title}" is due within 24 hours.`,
          'info'
        );
        localStorage.setItem(notificationKey, '24hours');
      }
    });
  } catch (error) {
    console.error('Error checking due date notifications:', error);
  }
}

// Function to show browser notification and in-app notification
async function showDueDateNotification(title, message, type = 'info') {
  // Show browser notification if permission granted
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: message,
      icon: '/static/assets/taskwise-logo-1.png',
      badge: '/static/assets/taskwise-logo-1.png',
      tag: 'taskwise-due-date',
      requireInteraction: false
    });
  }
  
  // Show in-app toast notification
  showToastNotification(title, message, type);
  
  // Add to notification center only once
  await addToNotificationCenter(title, message);
}

// Function to show toast notification
function showToastNotification(title, message, type = 'info') {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `notification-toast ${type}`;
  toast.innerHTML = `
    <div class="toast-header">
      <strong>${escapeHtml(title)}</strong>
      <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
    <div class="toast-body">${escapeHtml(message)}</div>
  `;
  
  // Add toast to page
  let container = document.querySelector('.notification-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'notification-toast-container';
    document.body.appendChild(container);
  }
  
  container.appendChild(toast);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// Function to add notification to notification center
async function addToNotificationCenter(title, message) {
  try {
    // First, check if this notification already exists
    const response = await fetch('/api/notifications');
    const data = await response.json();
    
    // Check if a notification with the same title and message already exists
    const exists = data.notifications?.some(n => 
      n.title === title && n.message === message
    );
    
    // Only add if it doesn't exist
    if (!exists) {
      await fetch('/api/notifications/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title,
          message: message,
          read: false,
          time: new Date().toISOString()
        })
      });
      
      // Reload notifications to update the badge and list
      if (typeof notificationLoader === 'function') {
        await notificationLoader();
      }
    }
  } catch (error) {
    console.error('Error adding notification:', error);
  }
}

// Request browser notification permission on page load
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Function to show completion notification
async function showCompletionNotification(taskTitle) {
  const title = 'Task Completed! 🎉';
  const message = `Congratulations! You completed "${taskTitle}"`;
  
  // Show browser notification if permission granted
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: message,
      icon: '/static/assets/taskwise-logo-1.png',
      badge: '/static/assets/taskwise-logo-1.png',
      tag: 'taskwise-completion'
    });
  }
  
  // Show in-app toast notification
  showToastNotification(title, message, 'success');
  
  // Add to notification center
  await addToNotificationCenter(title, message);
  
  // Optional: Play celebration sound
  playCompletionSound();
}

// Function to play completion sound (optional)
function playCompletionSound() {
  try {
    // Create a simple success sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    // Silently fail if audio not supported
    console.log('Audio notification not supported');
  }
}
