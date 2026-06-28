require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, "data.json");

app.use(express.json());
app.use(express.static("public"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-this",
    resave: false,
    saveUninitialized: false
  })
);

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { users: [], tasks: [] };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }
  next();
}

async function sendEmail(to, taskTitle) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "New Task Added",
    text: `Your new task was added: ${taskTitle}`
  });
}

async function sendSMS(phone, taskTitle) {
  if (
    !process.env.TWILIO_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_PHONE ||
    !phone
  ) {
    return;
  }

  const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

  await client.messages.create({
    body: `New task added: ${taskTitle}`,
    from: process.env.TWILIO_PHONE,
    to: phone
  });
}

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password required" });
    }

    const data = loadData();

    const existingUser = data.users.find((user) => user.email === email);
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: Date.now(),
      name,
      email,
      phone: phone || null,
      password: hashedPassword
    };

    data.users.push(newUser);
    saveData(data);

    req.session.user = {
      id: newUser.id,
      name,
      email,
      phone: phone || null
    };

    res.json({ message: "Registered successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const data = loadData();
  const user = data.users.find((user) => user.email === email);

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone
  };

  res.json({ message: "Logged in successfully" });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

app.get("/api/tasks", requireLogin, (req, res) => {
  const data = loadData();

  const tasks = data.tasks
    .filter((task) => task.user_id === req.session.user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json(tasks);
});

app.post("/api/tasks", requireLogin, async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Task title required" });
    }

    const data = loadData();

    const newTask = {
      id: Date.now(),
      user_id: req.session.user.id,
      title,
      description: description || "",
      status: "To Do",
      created_at: new Date().toISOString()
    };

    data.tasks.push(newTask);
    saveData(data);

    await sendEmail(req.session.user.email, title);
    await sendSMS(req.session.user.phone, title);

    res.json(newTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/tasks/:id", requireLogin, (req, res) => {
  const data = loadData();

  data.tasks = data.tasks.filter(
    (task) =>
      task.id !== Number(req.params.id) ||
      task.user_id !== req.session.user.id
  );

  saveData(data);

  res.json({ message: "Task deleted" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});