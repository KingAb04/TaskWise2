//// Select Elements
const pomodoroBtn = document.getElementById("pomodoroBtn");
const shortBtn = document.getElementById("shortBtn");
const longBtn = document.getElementById("longBtn");

const timeDisplay = document.getElementById("timeDisplay");
const statusText = document.getElementById("statusText");
const body = document.body;
const startBtn = document.querySelector(".start-btn");

const taskList = document.querySelector(".task-list");
const taskPlaceholder = document.querySelector(".task-placeholder");

const alarmSound = document.getElementById("alarmSound");

// Settings inputs (grab early so we can load saved settings)
const focusInput = document.getElementById("focusTimeInput");
const shortInput = document.getElementById("shortTimeInput");
const longInput = document.getElementById("longTimeInput");
const muteInput = document.getElementById("muteSounds");

const focusColorInput = document.getElementById("focusColor");
const shortColorInput = document.getElementById("shortColor");
const longColorInput = document.getElementById("longColor");

const saveBtn = document.getElementById("saveSettings");

// Mode data
const modes = {
  focusyrn: { time: 25 * 60, text: "#1 Time to Focus!", class: "pomodoro", color: null },
  short:    { time: 5 * 60,  text: "Time for a short break!",   class: "short",    color: null },
  long:     { time: 15 * 60, text: "Time for a long break!",    class: "long",     color: null }
};

let currentMode = "focusyrn";
let timeLeft = modes[currentMode].time;
let timerInterval = null;
let isRunning = false;
let muteSounds = false;
let deleteTargetTask = null;

// Format time
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;
}

// Load saved settings from localStorage (if any)
function loadSettingsFromStorage() {
  const storedFocusTime = localStorage.getItem('fy_focusTime');
  const storedShortTime = localStorage.getItem('fy_shortTime');
  const storedLongTime  = localStorage.getItem('fy_longTime');

  if (storedFocusTime) {
    modes.focusyrn.time = parseInt(storedFocusTime, 10) * 60;
    focusInput.value = parseInt(storedFocusTime, 10);
  }
  if (storedShortTime) {
    modes.short.time = parseInt(storedShortTime, 10) * 60;
    shortInput.value = parseInt(storedShortTime, 10);
  }
  if (storedLongTime) {
    modes.long.time = parseInt(storedLongTime, 10) * 60;
    longInput.value = parseInt(storedLongTime, 10);
  }

  const storedMute = localStorage.getItem('fy_muteSounds');
  if (storedMute !== null) {
    muteSounds = storedMute === 'true';
    muteInput.checked = muteSounds;
  }

  const storedFocusColor = localStorage.getItem('fy_focusColor');
  const storedShortColor = localStorage.getItem('fy_shortColor');
  const storedLongColor  = localStorage.getItem('fy_longColor');

  if (storedFocusColor) {
    modes.focusyrn.color = storedFocusColor;
    focusColorInput.value = storedFocusColor;
  }
  if (storedShortColor) {
    modes.short.color = storedShortColor;
    shortColorInput.value = storedShortColor;
  }
  if (storedLongColor) {
    modes.long.color = storedLongColor;
    longColorInput.value = storedLongColor;
  }
}

// Switch Mode
function switchMode(mode) {
  currentMode = mode;
  timeLeft = modes[mode].time;
  clearInterval(timerInterval);
  isRunning = false;
  startBtn.textContent = "START";

  // set class for fallback CSS
  body.className = modes[mode].class;

  // apply inline background color if user set one; otherwise let CSS class handle it
  if (modes[mode].color) {
    body.style.background = modes[mode].color;
  } else {
    body.style.background = ""; // remove inline style to fall back to CSS
  }

  timeDisplay.textContent = formatTime(timeLeft);
  statusText.textContent = modes[mode].text;

  document.querySelectorAll(".mode-switch button").forEach(btn => btn.classList.remove("active"));
  if (mode === "focusyrn") pomodoroBtn.classList.add("active");
  if (mode === "short") shortBtn.classList.add("active");
  if (mode === "long") longBtn.classList.add("active");
}

// Toggle Timer
function toggleTimer() {
  if (startBtn.textContent === "Restart") { restartTimer(); return; }

  if (!isRunning) {
    isRunning = true;
    startBtn.textContent = "PAUSE";
    timerInterval = setInterval(() => {
      timeLeft--;
      timeDisplay.textContent = formatTime(timeLeft);

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        statusText.textContent = "⏰ Time's up!";
        isRunning = false;
        startBtn.textContent = "Restart";
        if (!muteSounds) {
          // play may return a promise; ignore rejections for autoplay policy
          alarmSound.play().catch(()=>{});
        }
      }
    }, 1000);
  } else {
    isRunning = false;
    startBtn.textContent = "RESUME";
    clearInterval(timerInterval);
  }
}

// Restart Timer
function restartTimer() {
  if (!muteSounds) { alarmSound.pause(); alarmSound.currentTime = 0; }
  switchMode(currentMode);
}

// Add Task
function addTask() {
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Enter new task...";
  input.className = "task-input";

  taskList.appendChild(input);
  input.focus();

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && input.value.trim() !== "") {
      createTaskItem(input.value);
      taskList.removeChild(input);
    }
  });
}

// Create Task Item
function createTaskItem(taskText) {
  const task = document.createElement("div");
  task.className = "task-item";

  const text = document.createElement("span");
  text.textContent = taskText;

  const editBtn = document.createElement("button");
  editBtn.textContent = "✏️";
  editBtn.className = "edit-btn";
  editBtn.addEventListener("click", () => editTask(text));

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "❌";
  deleteBtn.className = "delete-btn";
  deleteBtn.addEventListener("click", () => {
    deleteTargetTask = task;
    document.getElementById("deleteModal").style.display = "block";
  });

  task.appendChild(text);
  task.appendChild(editBtn);
  task.appendChild(deleteBtn);
  taskList.appendChild(task);
}

// Edit Task
function editTask(textElement) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = textElement.textContent;
  input.className = "task-input";

  textElement.replaceWith(input);
  input.focus();

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && input.value.trim() !== "") {
      const newText = document.createElement("span");
      newText.textContent = input.value;
      input.replaceWith(newText);
    }
  });
}

// Button Events
pomodoroBtn.addEventListener("click", () => switchMode("focusyrn"));
shortBtn.addEventListener("click", () => switchMode("short"));
longBtn.addEventListener("click", () => switchMode("long"));
startBtn.addEventListener("click", toggleTimer);
taskPlaceholder.addEventListener("click", addTask);

// Settings Modal
const modal = document.getElementById("settingsModal");
const settingsBtn = document.getElementById("settingsBtn");
const closeBtn = document.querySelector("#settingsModal .close");
settingsBtn.onclick = () => modal.style.display = "block";
closeBtn.onclick = () => modal.style.display = "none";

// Save Settings (apply times, mute, colors and persist)
saveBtn.addEventListener("click", () => {
  const focusMins = parseInt(focusInput.value, 10) || 25;
  const shortMins = parseInt(shortInput.value, 10) || 5;
  const longMins  = parseInt(longInput.value, 10) || 15;

  modes.focusyrn.time = focusMins * 60;
  modes.short.time     = shortMins * 60;
  modes.long.time      = longMins * 60;

  localStorage.setItem('fy_focusTime', focusMins.toString());
  localStorage.setItem('fy_shortTime', shortMins.toString());
  localStorage.setItem('fy_longTime', longMins.toString());

  muteSounds = muteInput.checked;
  localStorage.setItem('fy_muteSounds', muteSounds.toString());

  // Colors
  const focusColor = focusColorInput.value;
  const shortColor = shortColorInput.value;
  const longColor  = longColorInput.value;

  modes.focusyrn.color = focusColor;
  modes.short.color    = shortColor;
  modes.long.color     = longColor;

  localStorage.setItem('fy_focusColor', focusColor);
  localStorage.setItem('fy_shortColor', shortColor);
  localStorage.setItem('fy_longColor', longColor);

  // Apply instantly to current mode
  switchMode(currentMode);

  modal.style.display = "none";
});

// Delete Modal
const deleteModal = document.getElementById("deleteModal");
const closeDelete = document.getElementById("closeDelete");
const confirmDelete = document.getElementById("confirmDelete");
const cancelDelete = document.getElementById("cancelDelete");

closeDelete.onclick = () => deleteModal.style.display = "none";
cancelDelete.onclick = () => deleteModal.style.display = "none";
confirmDelete.onclick = () => {
  if (deleteTargetTask) deleteTargetTask.remove();
  deleteModal.style.display = "none";
};

// Handle outside clicks for both modals (use addEventListener so we don't overwrite)
window.addEventListener('click', (e) => {
  if (e.target === modal) modal.style.display = "none";
  if (e.target === deleteModal) deleteModal.style.display = "none";
});

// Initialization
loadSettingsFromStorage();
switchMode("focusyrn");