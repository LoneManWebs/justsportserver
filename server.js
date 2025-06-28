const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

const dbProducts = new sqlite3.Database('./products.db');
const dbOrders = new sqlite3.Database('./orders.db');
const dbRequests = new sqlite3.Database('./requests.db');
const dbReviews = new sqlite3.Database('./reviews.db');

app.use(cors());
app.use(bodyParser.json());
app.use(express.json()); // double parse, but whatever

// Log every request bro
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

// DB table stuff (same as urs)
dbProducts.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    name TEXT,
    price REAL,
    stock INTEGER,
    image TEXT,
    description TEXT,
    specs TEXT
)`);

dbOrders.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    name TEXT,
    phone TEXT,
    location TEXT,
    items TEXT,
    total TEXT,
    status TEXT
)`);

dbRequests.run(`CREATE TABLE IF NOT EXISTS country_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country TEXT,
    email TEXT,
    message TEXT,
    cart_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

dbReviews.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    country TEXT,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

// product routes same as urs (not repeating)

// Fix double POST /order & add detailed debug
app.post('/order', (req, res) => {
  console.log('🔥 Received /order POST request');
  console.log('Body:', req.body);

  const { orderId, id, name, phone, location, items, total } = req.body;

  // Use orderId or id whichever comes from frontend (fix ur frontend to be consistent plz)
  const finalId = orderId || id;

  if (!finalId || !name || !phone || !location || !items || !total) {
    console.error('❌ Missing order info:', { finalId, name, phone, location, items, total });
    return res.status(400).send('Missing order info');
  }

  let itemsString;
  try {
    itemsString = typeof items === 'string' ? items : JSON.stringify(items);
  } catch (e) {
    console.error('❌ Failed to stringify items:', e);
    return res.status(500).send('Invalid items format');
  }

  dbOrders.run(
    `INSERT INTO orders (id, name, phone, location, items, total, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [finalId, name, phone, location, itemsString, total, 'pending'],
    function (err) {
      if (err) {
        console.error('❌ DB insert error on /order:', err);
        return res.status(500).send('Failed to place order');
      }
      console.log(`✅ Order placed with id ${finalId}`);
      res.json({ success: true, orderId: finalId });
    }
  );
});

// rest of routes same as urs...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
