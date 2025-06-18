const express = require('express');
const app = express();
const expensesRoutes = require('./routes/expenses');
const settlementsRoutes = require('./routes/settlements');
const recurringRoutes = require('./routes/recurring');
require('dotenv').config(); // Loads environment variables (optional for local dev)

app.use(express.json());

// Root test route
app.get('/', (req, res) => {
  res.send('💸 Split App Backend is Live!');
});

// API routes
app.use('/expenses', expensesRoutes);
app.use('/', settlementsRoutes); // Handles /people, /balances, /settlements, /settle
app.use('/recurring', recurringRoutes);


// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = 3000 || process.env.PORT ;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
