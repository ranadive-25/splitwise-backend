const express = require('express');
const router = express.Router();
const { getPeople, getBalances, getSettlements } = require('../controllers/settlementsController');

router.get('/people', getPeople);
router.get('/balances', getBalances);
router.get('/settlements', getSettlements);

module.exports = router;
