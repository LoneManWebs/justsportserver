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

// Products Table
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

// ✅ Orders Table (UPDATED to include items + total)
dbOrders.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    name TEXT,
    phone TEXT,
    location TEXT,
    items TEXT,
    total TEXT,
    status TEXT
)`);

// Requests Table
dbRequests.run(`CREATE TABLE IF NOT EXISTS country_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country TEXT,
    email TEXT,
    message TEXT,
    cart_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

// Reviews Table
dbReviews.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    country TEXT,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

// --- Product Routes ---
app.get('/products', (req, res) => {
    dbProducts.all('SELECT * FROM products', [], (err, rows) => {
        if (err) return res.status(500).send(err.message);
        res.json(rows);
    });
});

app.post('/products', (req, res) => {
    const { category, name, price, stock, image, description, specs } = req.body;
    dbProducts.run(`INSERT INTO products (category, name, price, stock, image, description, specs) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [category, name, price, stock, image, description, specs], 
        function(err) {
            if (err) return res.status(500).send(err.message);
            res.json({ id: this.lastID, ...req.body });
        }
    );
});

app.delete('/products/:id', (req, res) => {
    const productId = req.params.id;
    dbProducts.run(`DELETE FROM products WHERE id = ?`, productId, function(err) {
        if (err) return res.status(500).send(err.message);
        if (this.changes === 0) return res.status(404).send('Product not found');
        res.send('Product deleted successfully');
    });
});

// ✅ Route for placing an order (UPDATED)
app.post('/order', (req, res) => {
    const { orderId, name, phone, location, items, total } = req.body;

    dbOrders.run(
        `INSERT INTO orders (id, name, phone, location, items, total, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, name, phone, location, JSON.stringify(items), total, 'pending'],
        function(err) {
            if (err) return res.status(500).send('Failed to place order');
            res.send('Order placed successfully');
        }
    );
});

// --- Orders Management ---
app.get('/orders', (req, res) => {
    dbOrders.all('SELECT * FROM orders WHERE status = "pending"', (err, rows) => {
        if (err) return res.status(500).send('Database error');
        res.json(rows);
    });
});

app.post('/mark-completed', (req, res) => {
    const { orderId } = req.body;
    dbOrders.run('UPDATE orders SET status = "completed" WHERE id = ?', [orderId], (err) => {
        if (err) return res.status(500).send('Failed to update order');
        res.send('Order marked as completed');
    });
});

app.get('/orders/history', (req, res) => {
    dbOrders.all("SELECT * FROM orders WHERE status != 'pending'", (err, rows) => {
        if (err) return res.status(500).send('Could not load order history');
        res.json(rows);
    });
});

app.post('/orders/complete', (req, res) => {
    const { orderId } = req.body;
    dbOrders.run("UPDATE orders SET status = 'completed' WHERE id = ?", [orderId], function(err) {
        if (err) return res.status(500).send('Failed to mark order as completed');
        res.send('Order completed successfully');
    });
});

app.delete('/orders/:id', (req, res) => {
    const orderId = req.params.id;
    dbOrders.run('DELETE FROM orders WHERE id = ?', orderId, function(err) {
        if (err) return res.status(500).send(err.message);
        if (this.changes === 0) return res.status(404).send('Order not found');
        res.send('Order deleted successfully');
    });
});

// --- Country Requests ---
app.post('/country-requests', (req, res) => {
    const { country, email, message, cart } = req.body;
    dbRequests.run(
        `INSERT INTO country_requests (country, email, message, cart_data) VALUES (?, ?, ?, ?)`,
        [country, email, message, JSON.stringify(cart)],
        function(err) {
            if (err) return res.status(500).send(err.message);
            res.json({ success: true });
        }
    );
});

app.get('/admin/country-requests', (req, res) => {
    dbRequests.all(`SELECT * FROM country_requests ORDER BY created_at DESC`, (err, rows) => {
        if (err) return res.status(500).send(err.message);
        res.json(rows);
    });
});

// --- Reviews ---
app.get('/api/reviews', (req, res) => {
    dbReviews.all("SELECT * FROM reviews ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.post('/api/reviews', (req, res) => {
    const { name, email, country, message } = req.body;
    dbReviews.run(
        "INSERT INTO reviews (name, email, country, message) VALUES (?, ?, ?, ?)",
        [name, email, country, message],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to save review' });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// --- Start Server ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
