const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect DB
const dbOrders = new sqlite3.Database('./orders.db', (err) => {
  if (err) console.error('❌ DB error:', err.message);
  else console.log('✅ Connected to orders.db');
});

// Create orders table
dbOrders.run(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    name TEXT,
    phone TEXT,
    location TEXT,
    items TEXT,
    total TEXT,
    status TEXT
  )
`);

// POST order
app.post('/order', (req, res) => {
  const { id, name, phone, location, items, total } = req.body;
  console.log('🔥 Received /order POST request');
  console.log('Body:', req.body);

  const itemsString = JSON.stringify(items);
  const status = 'Pending';

  const sql = `INSERT INTO orders (id, name, phone, location, items, total, status) VALUES (?, ?, ?, ?, ?, ?, ?)`;

  dbOrders.run(sql, [id, name, phone, location, itemsString, total, status], (err) => {
    if (err) {
      console.error('❌ DB insert error on /order:', err);
      res.status(500).send('Error saving order');
    } else {
      console.log('✅ Order saved');
      res.status(200).send('Order saved');
    }
  });
});

// GET all orders
app.get('/orders', (req, res) => {
  dbOrders.all(`SELECT * FROM orders`, (err, rows) => {
    if (err) {
      console.error('❌ DB read error on /orders:', err);
      res.status(500).send('Error fetching orders');
    } else {
      const orders = rows.map(order => ({
        ...order,
        items: order.items ? JSON.parse(order.items) : []
      }));
      res.json(orders);
    }
  });
});

// DELETE order
app.delete('/order/:id', (req, res) => {
  const id = req.params.id;
  dbOrders.run(`DELETE FROM orders WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error('❌ Delete error:', err);
      res.status(500).send('Error deleting order');
    } else {
      console.log(`🗑️ Deleted order with ID: ${id}`);
      res.sendStatus(200);
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
