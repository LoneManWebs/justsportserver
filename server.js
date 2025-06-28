const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");

const app = express();
const DB_FILE = "orders.db";

// Initialize database with proper error handling
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_FILE);

    // First try to create table (will fail if exists)
    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        location TEXT NOT NULL,
        items TEXT NOT NULL,
        total TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (createErr) => {
      if (createErr) {
        console.error("❌ Table creation failed:", createErr);
        return reject(createErr);
      }
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

      // Verify schema by checking for items column
      db.get(`
        SELECT COUNT(*) AS exists 
        FROM pragma_table_info('orders') 
        WHERE name = 'items'
      `, [], (err, row) => {
        if (err || !row || row.exists === 0) {
          console.log("⚠️ Schema mismatch detected, recreating table...");
          db.close(() => {
            fs.unlink(DB_FILE, () => {
              const newDb = new sqlite3.Database(DB_FILE);
              newDb.run(`
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
                if (err) return reject(err);
                console.log("✅ Created fresh database with correct schema");
                resolve(newDb);
              });
            });
          });
        } else {
          console.log("✅ Database schema verified");
          resolve(db);
        }
      });
    });
  });
}

// Start the server
initializeDatabase()
  .then(db => {
    app.use(cors());
    app.use(bodyParser.json({ limit: "10mb" }));

    // Order submission endpoint
    app.post("/order", (req, res) => {
      const { name, phone, location, items, total } = req.body;
      
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: "Invalid items format" });
      }

      db.run(
        "INSERT INTO orders (name, phone, location, items, total) VALUES (?, ?, ?, ?, ?)",
        [name, phone, location, JSON.stringify(items), total],
        function(err) {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: "Failed to save order" });
          }
          res.json({ orderId: this.lastID });
        }
      );
    });

    // Get orders endpoint
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
// Add these endpoints right before the app.listen() line:

// Admin - Get all orders
app.get("/admin/orders", (req, res) => {
  db.all(`
    SELECT 
      id,
      name,
      phone,
      location,
      items,
      total,
      created_at,
      'pending' as status
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

// Admin - Mark order as completed
app.post("/admin/orders/complete", (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: "Missing orderId" });
  
  // In a real app you'd update a status column here
  res.json({ success: true, message: "Order marked as completed" });
});
    app.post("/country-requests", (req, res) => {
  const { email, country, message, cart } = req.body;

  const cartJSON = JSON.stringify(cart || []);
  const query = `
    INSERT INTO country_requests (email, country, message, cart)
    VALUES (?, ?, ?, ?)
  `;
  db.run(query, [email, country, message, cartJSON], function (err) {
    if (err) {
      console.error("❌ Error saving country request:", err);
      return res.status(500).send("Error saving request");
    }
    res.status(200).send({ success: true, id: this.lastID });
  });
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
  db.run(`DELETE FROM country_requests WHERE id = ?`, [reviewId], function (err) {
    if (err) {
      console.error("❌ Error deleting review:", err);
      return res.status(500).json({ success: false });
    }
    res.json({ success: true });
  });
});
    const PORT = process.env.PORT || 10000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error("Fatal initialization error:", err);
    process.exit(1);
  });
