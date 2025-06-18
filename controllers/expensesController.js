const db = require('../db');
const { rupeesToPaise, paiseToRupees } = require('../utils/money');

async function getOrCreatePerson(name) {
  const existing = await db.query('SELECT id FROM people WHERE name = $1', [name]);
  if (existing.rows.length > 0) return existing.rows[0].id;

  const insert = await db.query('INSERT INTO people (name) VALUES ($1) RETURNING id', [name]);
  return insert.rows[0].id;
}

// Add Expense
exports.addExpense = async (req, res) => {
  try {
    const { amount, description, paid_by, split_type, shares } = req.body;

    if (!amount || !description || !paid_by || !split_type) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const amountRupees = parseFloat(amount);
    const payerId = await getOrCreatePerson(paid_by);

    let shareData = [];
    if (split_type === 'equal') {
      const people = Object.keys(shares);
      const shareAmount = parseFloat((amountRupees / people.length).toFixed(2));

      shareData = people.map(name => ({
        name,
        share: shareAmount
      }));
    } else if (split_type === 'exact' || split_type === 'percentage') {
      let total = 0;
      for (const [name, value] of Object.entries(shares)) {
        const share = parseFloat(value);
        shareData.push({ name, share });
        total += share;
      }

      const expectedTotal = split_type === 'percentage'
        ? 100
        : parseFloat(amountRupees.toFixed(2));

      if (Math.abs(total - expectedTotal) > 0.01) {
        return res.status(400).json({ message: 'Shares do not match total amount' });
      }

      if (split_type === 'percentage') {
        // convert percentage shares to rupee values
        shareData = shareData.map(s => ({
          name: s.name,
          share: parseFloat(((s.share / 100) * amountRupees).toFixed(2))
        }));
      }
    } else {
      return res.status(400).json({ message: 'Invalid split_type' });
    }

    const result = await db.query(
      'INSERT INTO expenses (amount, description, paid_by, split_type) VALUES ($1, $2, $3, $4) RETURNING id',
      [rupeesToPaise(amountRupees), description, payerId, split_type]
    );

    const expenseId = result.rows[0].id;

    for (const { name, share } of shareData) {
      const personId = await getOrCreatePerson(name);
      await db.query(
        'INSERT INTO expense_shares (expense_id, person_id, share) VALUES ($1, $2, $3)',
        [expenseId, personId, rupeesToPaise(share)]
      );
    }

    res.json({ success: true, message: 'Expense added', expense_id: expenseId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Unknown server error' });
  }
};

// Get Expenses
exports.getExpenses = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.id, e.amount, e.description, p.name AS paid_by, e.split_type, e.created_at
      FROM expenses e
      JOIN people p ON e.paid_by = p.id
      ORDER BY e.created_at DESC
    `);

    const expenses = result.rows.map(row => ({
      ...row,
      amount: paiseToRupees(row.amount)
    }));

    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Update Expense
exports.updateExpense = async (req, res) => {
  try {
    const id = req.params.id;
    const { amount, description, paid_by } = req.body;

    if (!amount || !description || !paid_by) {
      return res.status(400).json({ message: "All fields required" });
    }

    const payerRes = await db.query('SELECT id FROM people WHERE name = $1', [paid_by]);
    if (payerRes.rows.length === 0) {
      return res.status(400).json({ message: 'Payer not found' });
    }
    const payerId = payerRes.rows[0].id;

    const amountPaise = Math.round(parseFloat(amount) * 100);

    const result = await db.query(
      'UPDATE expenses SET amount = $1, description = $2, paid_by = $3 WHERE id = $4 RETURNING *',
      [amountPaise, description, payerId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Expense not found" });
    }

    const updated = result.rows[0];
    updated.amount = paiseToRupees(updated.amount); // ✅ Convert back to rupees

    res.json({ success: true, message: "Expense updated", data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
// Delete Expense
exports.deleteExpense = async (req, res) => {
  try {
    const id = req.params.id;

    await db.query('DELETE FROM expense_shares WHERE expense_id = $1', [id]);
    const result = await db.query('DELETE FROM expenses WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json({ success: true, message: 'Expense deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
