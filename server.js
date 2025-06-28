const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");

const app = express();
const DB_FILE = "orders.db";

// Initialize database with auto-repair
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_FILE);

    // First try to verify the schema
    db.get("PRAGMA table_info(orders)", [], (err, result) => {
      if (err || !result) {
        console.log("ℹ️ No table found, creating fresh database");
        createFreshDatabase(db).then(resolve).catch(reject);
        return;
      }

      // Check for required columns
      const requiredColumns = ['name', 'phone', 'location', 'items', 'total'];
      const missingColumns = requiredColumns.filter(col => 
        !result.some(column => column.name === col)
      );

      if (missingColumns.length > 0) {
        console.log("⚠️ Missing columns detected, recreating table...");
        db.close(() => {
          fs.unlink(DB_FILE, () => {
            const newDb = new sqlite3.Database(DB_FILE);
            createFreshDatabase(newDb).then(resolve).catch(reject);
          });
        });
      } else {
        console.log("✅ Database schema is correct");
        resolve(db);
      }
    });
  });
}

function createFreshDatabase(db) {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        location TEXT NOT NULL,
        items TEXT NOT NULL,
        total TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error("❌ Failed to create table:", err);
        reject(err);
      } else {
        console.log("✅ Created new database with correct schema");
        resolve(db);
      }
    });
  });
}

// Initialize the server
initializeDatabase()
  .then(db => {
    app.use(cors());
    app.use(bodyParser.json({ limit: "10mb" }));

    // Order submission endpoint
    app.post("/order", (req, res) => {
      const { name, phone, location, items, total } = req.body;
      const itemsJSON = JSON.stringify(items);

      db.run(
        "INSERT INTO orders (name, phone, location, items, total) VALUES (?, ?, ?, ?, ?)",
        [name, phone, location, itemsJSON, total],
        function(err) {
          if (err) return res.status(500).send("Database error");
          res.json({ orderId: this.lastID });
        }
      );
    });

    // Get orders endpoint
    app.get("/orders", (req, res) => {
      db.all("SELECT * FROM orders", [], (err, rows) => {
        if (err) return res.status(500).send("Database error");
        res.json(rows.map(row => ({ ...row, items: JSON.parse(row.items) })));
      });
    });

    const PORT = process.env.PORT || 10000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error("❌ Fatal error during initialization:", err);
    process.exit(1);
  });
