const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");

const app = express();
const DB_FILE = "orders.db";

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: "10mb" }));

// Initialize database
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_FILE);

    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          location TEXT NOT NULL,
          items TEXT NOT NULL,
          total TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS country_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT,
          country TEXT,
          message TEXT,
          cart TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Make sure 'status' column exists
      db.get(`SELECT COUNT(*) as count FROM pragma_table_info('orders') WHERE name = 'status'`, (err, row) => {
        if (err) return reject(err);
        if (!row || row.count === 0) {
          db.run(`ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending'`, (alterErr) => {
            if (alterErr) return reject(alterErr);
            console.log("✅ Added missing 'status' column");
            resolve(db);
          });
        } else {
          console.log("✅ Database schema ready");
          resolve(db);
        }
      });
    });
  });
}

initializeDatabase().then(db => {

  app.post("/order", (req, res) => {
    const { name, phone, location, items, total } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Invalid items format" });
    }

    db.run(
      "INSERT INTO orders (name, phone, location, items, total) VALUES (?, ?, ?, ?, ?)",
      [name, phone, location, JSON.stringify(items), total],
      function (err) {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ error: "Failed to save order" });
        }
        res.json({ orderId: this.lastID });
      }
    );
  });

  app.get("/orders", (req, res) => {
    db.all("SELECT * FROM orders", [], (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error" });

      try {
        const orders = rows.map(row => ({
          ...row,
          items: JSON.parse(row.items)
        }));
        res.json(orders);
      } catch (parseErr) {
        res.status(500).json({ error: "Data processing error" });
      }
    });
  });

  app.get("/orders/history", (req, res) => {
    db.all("SELECT * FROM orders WHERE status = 'completed' ORDER BY created_at DESC", [], (err, rows) => {
      if (err) {
        console.error("❌ Error fetching order history:", err);
        return res.status(500).json({ error: "Database error" });
      }

      try {
        const history = rows.map(row => ({
          ...row,
          items: JSON.parse(row.items || "[]"),
        }));
        res.json(history);
      } catch (parseErr) {
        res.status(500).json({ error: "Data processing error" });
      }
    });
  });

  app.get("/admin/orders", (req, res) => {
    db.all(`
      SELECT 
        id, name, phone, location, items, total, status, created_at
      FROM orders
      ORDER BY created_at DESC
    `, [], (err, rows) => {
      if (err) {
        console.error("Admin orders error:", err);
        return res.status(500).json({ error: "Database error" });
      }

      try {
        const orders = rows.map(row => ({
          ...row,
          items: JSON.parse(row.items),
          created_at: new Date(row.created_at).toLocaleString()
        }));
        res.json(orders);
      } catch (e) {
        res.status(500).json({ error: "Data processing error" });
      }
    });
  });

  app.post("/admin/orders/complete", (req, res) => {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: "Missing orderId" });

    db.run(`UPDATE orders SET status = 'completed' WHERE id = ?`, [orderId], function(err) {
      if (err) {
        console.error("❌ Error marking order completed:", err);
        return res.status(500).json({ error: "Failed to update status" });
      }
      res.json({ success: true });
    });
  });

  app.post("/country-requests", (req, res) => {
    const { email, country, message, cart } = req.body;

    const cartJSON = JSON.stringify(cart || []);
    db.run(
      `INSERT INTO country_requests (email, country, message, cart) VALUES (?, ?, ?, ?)`,
      [email, country, message, cartJSON],
      function(err) {
        if (err) {
          console.error("❌ Error saving country request:", err);
          return res.status(500).send("Error saving request");
        }
        res.status(200).send({ success: true, id: this.lastID });
      }
    );
  });

  app.get("/api/reviews", (req, res) => {
    db.all(`SELECT * FROM country_requests ORDER BY created_at DESC`, [], (err, rows) => {
      if (err) {
        console.error("❌ Error fetching reviews:", err);
        return res.status(500).json({ error: "Database error" });
      }

      const parsed = rows.map(row => ({
        ...row,
        cart: row.cart ? JSON.parse(row.cart) : [],
      }));
      res.json(parsed);
    });
  });

  app.delete("/api/reviews/:id", (req, res) => {
    const reviewId = req.params.id;
    db.run(`DELETE FROM country_requests WHERE id = ?`, [reviewId], function(err) {
      if (err) {
        console.error("❌ Error deleting review:", err);
        return res.status(500).json({ success: false });
      }
      res.json({ success: true });
    });
  });

  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

}).catch(err => {
  console.error("Fatal initialization error:", err);
  process.exit(1);
});
