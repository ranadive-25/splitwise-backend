const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const expenseRoutes = require('./routes/expenses');
const settlementRoutes = require('./routes/settlements');

app.use('/expenses', expenseRoutes);
app.use('/', settlementRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
