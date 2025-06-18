const db = require('../db');
const { paiseToRupees, rupeesToPaise } = require('../utils/money');

// Get all people names
exports.getPeople = async (req, res) => {
  try {
    const result = await db.query('SELECT name FROM people ORDER BY name');
    const people = result.rows.map(row => row.name);
    res.json({ people });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Calculate net balances (paid - owed) in rupees
exports.getBalances = async (req, res) => {
  try {
    const paidQuery = await db.query(`
      SELECT p.id, p.name, COALESCE(SUM(e.amount), 0) AS total_paid
      FROM people p
      LEFT JOIN expenses e ON p.id = e.paid_by
      GROUP BY p.id
    `);

    const shareQuery = await db.query(`
      SELECT p.id, COALESCE(SUM(s.share), 0) AS total_share
      FROM people p
      LEFT JOIN expense_shares s ON p.id = s.person_id
      GROUP BY p.id
    `);

    const shareMap = Object.fromEntries(
      shareQuery.rows.map(r => [r.id, parseFloat(r.total_share)])
    );

    const balances = paidQuery.rows.map(row => {
      const paid = parseFloat(row.total_paid);
      const owed = shareMap[row.id] || 0;

      const paidR = paiseToRupees(paid);
      const owedR = paiseToRupees(owed);
      const balanceR = paiseToRupees(paid - owed);

      return {
        name: row.name,
        paid: paidR,
        owed: owedR,
        balance: balanceR
      };
    });

    res.json({ balances });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Who owes whom (auto settlement logic)
exports.getSettlements = async (req, res) => {
  try {
    const balancesRes = await db.query(`
      SELECT p.id, p.name,
        COALESCE(SUM(e.amount), 0) AS total_paid,
        (SELECT COALESCE(SUM(s.share), 0)
         FROM expense_shares s WHERE s.person_id = p.id) AS total_share
      FROM people p
      LEFT JOIN expenses e ON p.id = e.paid_by
      GROUP BY p.id
    `);

    let balances = balancesRes.rows.map(row => ({
      name: row.name,
      balance: parseInt(row.total_paid) - parseInt(row.total_share)
    }));

    let creditors = balances.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance);
    let debtors = balances.filter(b => b.balance < 0).sort((a, b) => a.balance - b.balance);

    const transactions = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amount = Math.min(-debtor.balance, creditor.balance);

      if (amount > 0) {
        transactions.push({
          from: debtor.name,
          to: creditor.name,
          amount: paiseToRupees(amount)
        });

        debtor.balance += amount;
        creditor.balance -= amount;
      }

      if (Math.abs(debtor.balance) < 1) i++;
      if (Math.abs(creditor.balance) < 1) j++;
    }

    res.json({ transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Manual settlement logging
exports.settleUp = async (req, res) => {
  try {
    const { from, to, amount } = req.body;

    if (!from || !to || !amount) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const payerRes = await db.query('SELECT id FROM people WHERE name = $1', [from]);
    const receiverRes = await db.query('SELECT id FROM people WHERE name = $1', [to]);

    if (payerRes.rows.length === 0 || receiverRes.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid person name(s)' });
    }

    const payerId = payerRes.rows[0].id;
    const receiverId = receiverRes.rows[0].id;
    const amountPaise = rupeesToPaise(parseFloat(amount));

    await db.query(`
      INSERT INTO settlements (payer_id, receiver_id, amount, settled_at)
      VALUES ($1, $2, $3, NOW())
    `, [payerId, receiverId, amountPaise]);

    res.json({ success: true, message: 'Settlement recorded' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Add new person
exports.addPerson = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: 'Name is required and must be a string' });
    }

    const existing = await db.query('SELECT id FROM people WHERE name = $1', [name]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Person already exists' });
    }

    const result = await db.query('INSERT INTO people (name) VALUES ($1) RETURNING id', [name]);
    res.status(201).json({ message: 'Person added', id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
