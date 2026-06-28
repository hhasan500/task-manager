async function checkUser() {
  const res = await fetch("/api/me");
  const data = await res.json();

  if (data.user) {
    document.getElementById("authSection").classList.add("hidden");
    document.getElementById("taskSection").classList.remove("hidden");
    document.getElementById("welcome").textContent = `Welcome, ${data.user.name}`;
    loadTasks();
  } else {
    document.getElementById("authSection").classList.remove("hidden");
    document.getElementById("taskSection").classList.add("hidden");
  }
}

async function register() {
  const name = document.getElementById("registerName").value;
  const email = document.getElementById("registerEmail").value;
  const phone = document.getElementById("registerPhone").value;
  const password = document.getElementById("registerPassword").value;

  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, phone, password })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error);
    return;
  }

  checkUser();
}

async function login() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error);
    return;
  }

  checkUser();
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  checkUser();
}

async function loadTasks() {
  const res = await fetch("/api/tasks");
  const tasks = await res.json();

  const taskList = document.getElementById("taskList");
  taskList.innerHTML = "";

  tasks.forEach(task => {
    const div = document.createElement("div");
    div.className = "task";

    div.innerHTML = `
      <h3>${task.title}</h3>
      <p>${task.description || ""}</p>
      <small>Status: ${task.status}</small>
      <br>
      <button onclick="deleteTask(${task.id})">Delete</button>
    `;

    taskList.appendChild(div);
  });
}

async function addTask() {
  const title = document.getElementById("taskTitle").value;
  const description = document.getElementById("taskDescription").value;

  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error);
    return;
  }

  document.getElementById("taskTitle").value = "";
  document.getElementById("taskDescription").value = "";

  loadTasks();
}

async function deleteTask(id) {
  await fetch(`/api/tasks/${id}`, {
    method: "DELETE"
  });

  loadTasks();
}

checkUser();