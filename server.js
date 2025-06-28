const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");

const app = express();
const DB_FILE = "orders.db";
const PRODUCTS_FILE = "products.db";

// Middleware
app.use(cors());
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
      `, (err) => {
        if (err) return reject(err);
        resolve(db);
      });
    });
  });
}

// Products DB
const productsDB = new sqlite3.Database(PRODUCTS_FILE);
productsDB.run(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    name TEXT,
    price REAL,
    stock INTEGER,
    image TEXT,
    description TEXT,
    specs TEXT
  )
`);

// Initialize & start server
initializeDatabase().then(db => {
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

  // Order routes
  app.post("/order", (req, res) => {
    const { name, phone, location, items, total } = req.body;
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: "Invalid items format" });

    db.run(
      `INSERT INTO orders (name, phone, location, items, total) VALUES (?, ?, ?, ?, ?)`,
      [name, phone, location, JSON.stringify(items), total],
      function (err) {
        if (err) return res.status(500).json({ error: "Failed to save order" });
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
          items: JSON.parse(row.items),
        }));
        res.json(orders);
      } catch (e) {
        res.status(500).json({ error: "Data processing error" });
      }
    });
  });

  app.get("/orders/history", (req, res) => {
    db.all(`SELECT * FROM orders WHERE status = 'completed' ORDER BY created_at DESC`, [], (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error" });

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
    db.all("SELECT * FROM orders ORDER BY created_at DESC", [], (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error" });

      const formatted = rows.map(row => ({
        ...row,
        items: JSON.parse(row.items || "[]"),
        created_at: new Date(row.created_at).toLocaleString()
      }));
      res.json(formatted);
    });
  });

  app.post("/admin/orders/complete", (req, res) => {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: "Missing orderId" });

    db.run("UPDATE orders SET status = 'completed' WHERE id = ?", [orderId], function (err) {
      if (err) return res.status(500).json({ error: "Failed to update status" });
      res.json({ success: true });
    });
  });

  // Country requests
  app.post("/country-requests", (req, res) => {
    const { email, country, message, cart } = req.body;
    const cartJSON = JSON.stringify(cart || []);
    db.run(
      `INSERT INTO country_requests (email, country, message, cart) VALUES (?, ?, ?, ?)`,
      [email, country, message, cartJSON],
      function (err) {
        if (err) return res.status(500).send("Error saving request");
        res.status(200).send({ success: true, id: this.lastID });
      }
    );
  });

  app.get("/api/reviews", (req, res) => {
    db.all("SELECT * FROM country_requests ORDER BY created_at DESC", [], (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error" });

      const parsed = rows.map(row => ({
        ...row,
        cart: row.cart ? JSON.parse(row.cart) : [],
      }));
      res.json(parsed);
    });
  });

  app.delete("/api/reviews/:id", (req, res) => {
    const reviewId = req.params.id;
    db.run("DELETE FROM country_requests WHERE id = ?", [reviewId], function (err) {
      if (err) return res.status(500).json({ success: false });
      res.json({ success: true });
    });
  });

  // Product routes
  app.get('/products', (req, res) => {
    productsDB.all('SELECT * FROM products', [], (err, rows) => {
      if (err) return res.status(500).send(err.message);
      res.json(rows);
    });
  });

  app.post('/products', (req, res) => {
    const { category, name, price, stock, image, description, specs } = req.body;
    productsDB.run(`
      INSERT INTO products (category, name, price, stock, image, description, specs)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [category, name, price, stock, image, description, specs],
      function (err) {
        if (err) return res.status(500).send(err.message);
        res.json({ id: this.lastID, ...req.body });
      }
    );
  });

  app.delete('/products/:id', (req, res) => {
    const productId = req.params.id;
    productsDB.run("DELETE FROM products WHERE id = ?", [productId], function (err) {
      if (err) return res.status(500).send(err.message);
      if (this.changes === 0) return res.status(404).send("Product not found");
      res.status(200).send("Product deleted successfully");
    });
  });

  // DELETE an order by ID (for both pending & history)
app.delete('/orders/:id', (req, res) => {
  const orderId = req.params.id;

  db.run(`DELETE FROM orders WHERE id = ?`, [orderId], function(err) {
    if (err) {
      console.error("❌ Failed to delete order:", err);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    res.json({ success: true, message: "Order deleted successfully" });
  });
});

  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

}).catch(err => {
  console.error("Fatal initialization error:", err);
  process.exit(1);
});
