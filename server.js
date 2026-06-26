const express = require("express");
const cors = require("cors");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Get all tasks
app.get("/api/tasks", (req, res) => {
  db.all("SELECT * FROM tasks ORDER BY created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Create task
app.post("/api/tasks", (req, res) => {
  const { title, description } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  db.run(
    "INSERT INTO tasks (title, description) VALUES (?, ?)",
    [title, description],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        id: this.lastID,
        title,
        description,
        status: "To Do"
      });
    }
  );
});

// Update task status
app.put("/api/tasks/:id", (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  db.run(
    "UPDATE tasks SET status = ? WHERE id = ?",
    [status, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Task updated" });
    }
  );
});

// Delete task
app.delete("/api/tasks/:id", (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM tasks WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Task deleted" });
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});