const db = require('../db');

const { paiseToRupees } = require('../utils/money');

// Get People names
exports.getPeople = async (req, res) => {
  try {
    const result = await db.query('SELECT name FROM people ORDER BY name');
    const people = result.rows.map(row => row.name);
    res.json({ people });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// Get balance amounts of all people
exports.getBalances = async (req, res) => {
  try {
    // 1. Get total paid by each person
    const paidQuery = await db.query(`
      SELECT p.name, COALESCE(SUM(e.amount), 0) AS total_paid
      FROM people p
      LEFT JOIN expenses e ON CAST(p.id AS TEXT) = CAST(e.paid_by AS TEXT)
      GROUP BY p.name
    `);

    // 2. Get total share for each person
    const shareQuery = await db.query(`
      SELECT p.name, COALESCE(SUM(s.share), 0) AS total_share
      FROM people p
      LEFT JOIN expense_shares s ON p.id = s.person_id
      GROUP BY p.name
    `);

    const paidMap = Object.fromEntries(
      paidQuery.rows.map(r => [r.name, parseFloat(r.total_paid)])
    );

    const shareMap = Object.fromEntries(
      shareQuery.rows.map(r => [r.name, parseFloat(r.total_share)])
    );

    const allPeople = new Set([...Object.keys(paidMap), ...Object.keys(shareMap)]);
    const balances = [];

    for (const name of allPeople) {
      const paid = paidMap[name] || 0;
      const share = shareMap[name] || 0;
      const balance = paid - share;

      balances.push({
        name,
        paid: paiseToRupees(paid),
        owed: paiseToRupees(share),
        balance: paiseToRupees(balance)
      });
    }

    res.json({ balances });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Get Settlement data
exports.getSettlements = async (req, res) => {
  try {
    // Get net balances first
    const balancesRes = await db.query(`
      SELECT p.name,
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

    // Split into creditors and debtors
    let creditors = balances.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance);
    let debtors = balances.filter(b => b.balance < 0).sort((a, b) => a.balance - b.balance);

    const transactions = [];

    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      let debtor = debtors[i];
      let creditor = creditors[j];
      let amount = Math.min(-debtor.balance, creditor.balance);

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

