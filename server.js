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
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

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

app.post('/order', (req, res) => {
  console.log('🔥 Received /order POST request');
  console.log('Body:', req.body);

  const { orderId, id, name, phone, location, items, total } = req.body;
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

app.get('/orders', (req, res) => {
  dbOrders.all('SELECT * FROM orders ORDER BY id DESC', (err, rows) => {
    if (err) {
      console.error('❌ DB error fetching orders:', err);
      return res.status(500).send('Failed to fetch orders');
    }
    const orders = rows.map(order => ({
      ...order,
      items: JSON.parse(order.items)
    }));
    res.json(orders);
  });
});

app.get('/orders/history', (req, res) => {
  dbOrders.all("SELECT * FROM orders WHERE status = 'completed' ORDER BY id DESC", (err, rows) => {
    if (err) {
      console.error('❌ Failed to fetch completed orders:', err);
      return res.status(500).send('Error retrieving order history');
    }
    res.json(rows);
  });
});

app.post('/mark-completed', (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).send('Missing orderId');

  dbOrders.run(
    `UPDATE orders SET status = 'completed' WHERE id = ?`,
    [orderId],
    function (err) {
      if (err) {
        console.error('❌ Error updating order:', err);
        return res.status(500).send('Failed to mark as completed');
      }
      res.json({ success: true });
    }
  );
});

app.delete('/orders/:id', (req, res) => {
  const id = req.params.id;
  dbOrders.run(`DELETE FROM orders WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error('❌ Failed to delete order:', err);
      return res.status(500).send('Failed to delete order');
    }
    res.json({ success: true });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
