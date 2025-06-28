const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");

const app = express();
const DB_FILE = "orders.db";

// CORS config
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// Initialize database
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_FILE);

    db.serialize(() => {
      // Create orders table with 'status'
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
      `, (err) => {
        if (err) {
          console.error("❌ Orders table creation failed:", err);
          return reject(err);
        }
        console.log("✅ Orders table ready");
      });

      // Create country_requests table
      db.run(`
        CREATE TABLE IF NOT EXISTS country_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT,
          country TEXT,
          message TEXT,
          cart TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error("❌ Country requests table creation failed:", err);
          return reject(err);
        }
        console.log("✅ Country_requests table ready");
      });

      resolve(db);
    });
  });
}

// Start the server
initializeDatabase().then(db => {
  // Place Order
  app.post("/order", (req, res) => {
    const { name, phone, location, items, total } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Invalid items format" });
    }

    db.run(
      `INSERT INTO orders (name, phone, location, items, total) VALUES (?, ?, ?, ?, ?)`,
      [name, phone, location, JSON.stringify(items), total],
      function (err) {
        if (err) {
          console.error("❌ Error saving order:", err);
          return res.status(500).json({ error: "Failed to save order" });
        }
        res.json({ orderId: this.lastID });
      }
    );
  });

  // Get all orders
  app.get("/orders", (req, res) => {
    db.all("SELECT * FROM orders", [], (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error" });

      try {
        const orders = rows.map(row => ({
          ...row,
          items: JSON.parse(row.items),
          created_at: new Date(row.created_at).toLocaleString()
        }));
        res.json(orders);
      } catch (err) {
        res.status(500).json({ error: "Data processing error" });
      }
    });
  });

  // Get order history (completed only)
  app.get("/orders/history", (req, res) => {
    db.all("SELECT * FROM orders WHERE status = 'completed' ORDER BY created_at DESC", [], (err, rows) => {
      if (err) {
        console.error("❌ Error fetching history:", err);
        return res.status(500).json({ error: "Database error" });
      }

      try {
        const history = rows.map(row => ({
          ...row,
          items: JSON.parse(row.items),
          created_at: new Date(row.created_at).toLocaleString()
        }));
        res.json(history);
      } catch (err) {
        res.status(500).json({ error: "Data processing error" });
      }
    });
  });

  // Admin get all orders
  app.get("/admin/orders", (req, res) => {
    db.all("SELECT * FROM orders ORDER BY created_at DESC", [], (err, rows) => {
      if (err) {
        console.error("❌ Admin orders error:", err);
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

  // Mark order as completed
  app.post("/admin/orders/complete", (req, res) => {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: "Missing orderId" });

    db.run(`UPDATE orders SET status = 'completed' WHERE id = ?`, [orderId], function (err) {
      if (err) {
        console.error("❌ Error updating order:", err);
        return res.status(500).json({ error: "Failed to update order" });
      }
      res.json({ success: true });
    });
  });

  // Country Request Submit
  app.post("/country-requests", (req, res) => {
    const { email, country, message, cart } = req.body;
    const cartJSON = JSON.stringify(cart || []);

    db.run(`
      INSERT INTO country_requests (email, country, message, cart)
      VALUES (?, ?, ?, ?)
    `, [email, country, message, cartJSON], function (err) {
      if (err) {
        console.error("❌ Error saving country request:", err);
        return res.status(500).send("Error saving request");
      }
      res.status(200).send({ success: true, id: this.lastID });
    });
  });

  // Admin: Get all country requests
  app.get("/api/reviews", (req, res) => {
    db.all("SELECT * FROM country_requests ORDER BY created_at DESC", [], (err, rows) => {
      if (err) {
        console.error("❌ Error fetching reviews:", err);
        return res.status(500).json({ error: "Database error" });
      }

      const parsed = rows.map(row => ({
        ...row,
        cart: row.cart ? JSON.parse(row.cart) : [],
        created_at: new Date(row.created_at).toLocaleString()
      }));
      res.json(parsed);
    });
  });

  // Admin: Delete country request
  app.delete("/api/reviews/:id", (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM country_requests WHERE id = ?", [id], function (err) {
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
  console.error("❌ Fatal DB error:", err);
  process.exit(1);
});
