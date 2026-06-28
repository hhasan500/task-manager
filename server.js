require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(express.json());
app.use(express.static("public"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { users: [], tasks: [] };
  }

  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { users: [], tasks: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Please sign in first." });
  }
  next();
}

function cleanUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email
  };
}

async function sendReminderEmail(userEmail, task) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("Email not configured.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: `"Task Manager" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `Reminder: ${task.title}`,
    text: `
Task Reminder

Title: ${task.title}
Description: ${task.description || "No description"}
Due Date: ${task.dueDate || "No due date"}

This is your scheduled reminder.
`
  });
}

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const data = loadData();
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = data.users.find((u) => u.email === normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = {
      id: Date.now(),
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    data.users.push(user);
    saveData(data);

    req.session.user = cleanUser(user);

    res.json({ message: "Account created successfully.", user: req.session.user });
  } catch (err) {
    res.status(500).json({ error: "Server error during registration." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const data = loadData();

    const normalizedEmail = email.toLowerCase().trim();
    const user = data.users.find((u) => u.email === normalizedEmail);

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    req.session.user = cleanUser(user);

    res.json({ message: "Signed in successfully.", user: req.session.user });
  } catch {
    res.status(500).json({ error: "Server error during login." });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Signed out successfully." });
  });
});

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

app.get("/api/tasks", requireLogin, (req, res) => {
  const data = loadData();

  const tasks = data.tasks
    .filter((task) => task.userId === req.session.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(tasks);
});

app.post("/api/tasks", requireLogin, (req, res) => {
  const { title, description, dueDate, reminderAt, priority } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Task title is required." });
  }

  const data = loadData();

  const task = {
    id: Date.now(),
    userId: req.session.user.id,
    title: title.trim(),
    description: description || "",
    dueDate: dueDate || "",
    reminderAt: reminderAt || "",
    priority: priority || "Medium",
    status: "To Do",
    reminderSent: false,
    createdAt: new Date().toISOString()
  };

  data.tasks.push(task);
  saveData(data);

  res.json(task);
});

app.patch("/api/tasks/:id", requireLogin, (req, res) => {
  const data = loadData();
  const task = data.tasks.find(
    (t) => t.id === Number(req.params.id) && t.userId === req.session.user.id
  );

  if (!task) {
    return res.status(404).json({ error: "Task not found." });
  }

  task.status = req.body.status || task.status;
  saveData(data);

  res.json(task);
});

app.delete("/api/tasks/:id", requireLogin, (req, res) => {
  const data = loadData();

  data.tasks = data.tasks.filter(
    (task) => !(task.id === Number(req.params.id) && task.userId === req.session.user.id)
  );

  saveData(data);

  res.json({ message: "Task deleted." });
});

setInterval(async () => {
  const data = loadData();
  const now = new Date();
  let changed = false;

  for (const task of data.tasks) {
    if (!task.reminderAt || task.reminderSent) continue;

    const reminderTime = new Date(task.reminderAt);

    if (reminderTime <= now) {
      const user = data.users.find((u) => u.id === task.userId);

      if (user) {
        try {
          await sendReminderEmail(user.email, task);
          task.reminderSent = true;
          changed = true;
          console.log(`Reminder sent for task: ${task.title}`);
        } catch (err) {
          console.log("Reminder email failed:", err.message);
        }
      }
    }
  }

  if (changed) saveData(data);
}, 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});