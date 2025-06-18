const express = require('express');
const router = express.Router();
const settlementsController = require('../controllers/settlementsController');

// List all people
router.get('/people', settlementsController.getPeople);
router.post('/people', settlementsController.addPerson);

// Get net balances (how much each person owes or is owed)
router.get('/balances', settlementsController.getBalances);

// Get settlement plan (who should pay whom)
router.get('/settlements', settlementsController.getSettlements);

// Record a manual settlement
router.post('/settle', settlementsController.settleUp);

module.exports = router;
