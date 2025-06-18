const express = require('express');
const router = express.Router();
const controller = require('../controllers/recurringController'); // ✅ THIS was missing

// Existing routes
router.post('/', controller.addRecurringExpense);
router.get('/', controller.getRecurringExpenses);
router.post('/run', controller.runRecurringExpenses);

// ✅ Newly added PUT and DELETE
router.put('/:id', controller.updateRecurringExpense);
router.delete('/:id', controller.deleteRecurringExpense);

module.exports = router;
