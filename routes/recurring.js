const express = require('express');
const router = express.Router();
const recurringController = require('../controllers/recurringController');

router.post('/', recurringController.addRecurringExpense);
router.get('/', recurringController.getRecurringExpenses);
router.post('/run', recurringController.runRecurringExpenses);

router.put('/:id', controller.updateRecurringExpense);
router.delete('/:id', controller.deleteRecurringExpense);

module.exports = router;
