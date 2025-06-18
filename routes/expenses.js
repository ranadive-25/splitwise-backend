const express = require('express');
const router = express.Router();
const expensesController = require('../controllers/expensesController');

// Create a new expense
router.post('/', expensesController.addExpense);

// Get all expenses
router.get('/', expensesController.getExpenses);

// Update an expense
router.put('/:id', expensesController.updateExpense);

// Delete an expense
router.delete('/:id', expensesController.deleteExpense);

module.exports = router;
