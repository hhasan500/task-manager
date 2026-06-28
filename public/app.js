let currentUser = null;
let tasks = [];

function toast(message) {
  const box = document.getElementById("toast");
  box.textContent = message;
  box.classList.add("show");

  setTimeout(() => {
    box.classList.remove("show");
  }, 3000);
}

function showLogin() {
  document.getElementById("loginForm").classList.remove("hidden");
  document.getElementById("registerForm").classList.add("hidden");
  document.getElementById("loginTab").classList.add("active");
  document.getElementById("registerTab").classList.remove("active");
}

function showRegister() {
  document.getElementById("registerForm").classList.remove("hidden");
  document.getElementById("loginForm").classList.add("hidden");
  document.getElementById("registerTab").classList.add("active");
  document.getElementById("loginTab").classList.remove("active");
}

async function checkUser() {
  const res = await fetch("/api/me");
  const data = await res.json();

  if (data.user) {
    currentUser = data.user;
    document.getElementById("authPage").classList.add("hidden");
    document.getElementById("dashboardPage").classList.remove("hidden");
    document.getElementById("welcomeName").textContent = `Hi, ${currentUser.name}`;
    await loadTasks();
  } else {
    currentUser = null;
    document.getElementById("authPage").classList.remove("hidden");
    document.getElementById("dashboardPage").classList.add("hidden");
  }
}

async function register(event) {
  event.preventDefault();

  const name = document.getElementById("registerName").value;
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;

  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });

  const data = await res.json();

  if (!res.ok) {
    toast(data.error);
    return;
  }

  toast("Account created successfully.");
  await checkUser();
}

async function login(event) {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!res.ok) {
    toast(data.error);
    return;
  }

  toast("Signed in successfully.");
  await checkUser();
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  toast("Signed out.");
  await checkUser();
}

async function loadTasks() {
  const res = await fetch("/api/tasks");
  tasks = await res.json();
  renderTasks();
}

function renderStats(filteredTasks) {
  const now = new Date();

  document.getElementById("totalTasks").textContent = tasks.length;
  document.getElementById("todoTasks").textContent =
    tasks.filter((t) => t.status === "To Do").length;
  document.getElementById("completedTasks").textContent =
    tasks.filter((t) => t.status === "Completed").length;
  document.getElementById("overdueTasks").textContent =
    tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "Completed").length;
}

function renderTasks() {
  const taskList = document.getElementById("taskList");
  const search = document.getElementById("searchInput").value.toLowerCase();
  const status = document.getElementById("statusFilter").value;

  let visibleTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(search) ||
      (task.description || "").toLowerCase().includes(search);

    const matchesStatus = status === "All" || task.status === status;

    return matchesSearch && matchesStatus;
  });

  renderStats(visibleTasks);

  if (visibleTasks.length === 0) {
    taskList.innerHTML = `
      <div class="empty-state">
        <h3>No tasks found</h3>
        <p>Create your first task and set an email reminder.</p>
      </div>
    `;
    return;
  }

  taskList.innerHTML = "";

  visibleTasks.forEach((task) => {
    const div = document.createElement("div");
    div.className = "task-card";

    const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleString() : "No due date";
    const reminder = task.reminderAt ? new Date(task.reminderAt).toLocaleString() : "No reminder";

    div.innerHTML = `
      <div class="task-top">
        <span class="priority ${task.priority.toLowerCase()}">${task.priority}</span>
        <select onchange="updateStatus(${task.id}, this.value)">
          <option ${task.status === "To Do" ? "selected" : ""}>To Do</option>
          <option ${task.status === "In Progress" ? "selected" : ""}>In Progress</option>
          <option ${task.status === "Completed" ? "selected" : ""}>Completed</option>
        </select>
      </div>

      <h3>${task.title}</h3>
      <p>${task.description || "No description"}</p>

      <div class="task-meta">
        <span>📅 ${dueDate}</span>
        <span>📧 ${reminder}</span>
      </div>

      <button class="danger-btn" onclick="deleteTask(${task.id})">Delete</button>
    `;

    taskList.appendChild(div);
  });
}

function openTaskModal() {
  document.getElementById("taskModal").classList.remove("hidden");
}

function closeTaskModal() {
  document.getElementById("taskModal").classList.add("hidden");
}

async function addTask(event) {
  event.preventDefault();

  const title = document.getElementById("taskTitle").value;
  const description = document.getElementById("taskDescription").value;
  const dueDate = document.getElementById("taskDueDate").value;
  const reminderAt = document.getElementById("taskReminderAt").value;
  const priority = document.getElementById("taskPriority").value;

  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, dueDate, reminderAt, priority })
  });

  const data = await res.json();

  if (!res.ok) {
    toast(data.error);
    return;
  }

  document.getElementById("taskTitle").value = "";
  document.getElementById("taskDescription").value = "";
  document.getElementById("taskDueDate").value = "";
  document.getElementById("taskReminderAt").value = "";
  document.getElementById("taskPriority").value = "Medium";

  closeTaskModal();
  toast("Task created.");
  await loadTasks();
}

async function updateStatus(id, status) {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });

  if (res.ok) {
    toast("Task updated.");
    await loadTasks();
  }
}

async function deleteTask(id) {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "DELETE"
  });

  if (res.ok) {
    toast("Task deleted.");
    await loadTasks();
  }
}

checkUser();