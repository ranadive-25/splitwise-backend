const express = require('express');
const router = express.Router();
const recurringController = require('../controllers/recurringController');

router.post('/', recurringController.addRecurringExpense);
router.get('/', recurringController.getRecurringExpenses);
router.post('/run', recurringController.runRecurringExpenses);

module.exports = router;
