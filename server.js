const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const db = new sqlite3.Database("orders.db");

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// ✅ Create the orders table with correct structure (includes 'items' as TEXT)
db.run(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    location TEXT,
    items TEXT,
    total TEXT
  )
`);

// ✅ Receive new order
app.post("/order", (req, res) => {
  console.log("🔥 Received /order POST request");
  console.log("Body:", req.body);

  const { name, phone, location, items, total } = req.body;

  const itemsJSON = JSON.stringify(items); // Serialize items array

  const query = `INSERT INTO orders (name, phone, location, items, total) VALUES (?, ?, ?, ?, ?)`;
  const values = [name, phone, location, itemsJSON, total];

  db.run(query, values, function (err) {
    if (err) {
      console.error("❌ DB insert error on /order:", err);
      res.status(500).send("Error saving order");
    } else {
      console.log("✅ Order saved with ID:", this.lastID);
      res.status(200).send({ orderId: this.lastID });
    }
  });
});

// ✅ Retrieve all orders
app.get("/orders", (req, res) => {
  db.all("SELECT * FROM orders", (err, rows) => {
    if (err) {
      console.error("❌ DB fetch error:", err);
      res.status(500).send("Error fetching orders");
    } else {
      // Parse items JSON back to object
      const parsed = rows.map(row => ({
        ...row,
        items: JSON.parse(row.items || "[]")
      }));
      res.status(200).json(parsed);
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
