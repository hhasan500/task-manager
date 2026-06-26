const taskForm = document.getElementById("taskForm");
const taskList = document.getElementById("taskList");

async function loadTasks() {
  const res = await fetch("/api/tasks");
  const tasks = await res.json();

  taskList.innerHTML = "";

  tasks.forEach(task => {
    const div = document.createElement("div");
    div.className = "task";

    div.innerHTML = `
      <h3>${task.title}</h3>
      <p>${task.description || ""}</p>
      <p>Status: ${task.status}</p>

      <select onchange="updateStatus(${task.id}, this.value)">
        <option ${task.status === "To Do" ? "selected" : ""}>To Do</option>
        <option ${task.status === "In Progress" ? "selected" : ""}>In Progress</option>
        <option ${task.status === "Done" ? "selected" : ""}>Done</option>
      </select>

      <button onclick="deleteTask(${task.id})">Delete</button>
    `;

    taskList.appendChild(div);
  });
}

taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("title").value;
  const description = document.getElementById("description").value;

  await fetch("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ title, description })
  });

  taskForm.reset();
  loadTasks();
});

async function updateStatus(id, status) {
  await fetch(`/api/tasks/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status })
  });

  loadTasks();
}

async function deleteTask(id) {
  await fetch(`/api/tasks/${id}`, {
    method: "DELETE"
  });

  loadTasks();
}

loadTasks();