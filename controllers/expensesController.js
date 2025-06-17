const db = require('../db');
const { rupeesToPaise, paiseToRupees } = require('../utils/money');

async function getOrCreatePerson(name) {
  const existing = await db.query('SELECT id FROM people WHERE name = $1', [name]);
  if (existing.rows.length > 0) return existing.rows[0].id;

  const insert = await db.query('INSERT INTO people (name) VALUES ($1) RETURNING id', [name]);
  return insert.rows[0].id;
}


exports.addExpense = async (req, res) => {
  try {
    const { amount, description, paid_by, split_type, shares } = req.body;

    if (!amount || !description || !paid_by || !split_type || !shares) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const amountRupees = parseFloat(amount);
    const payerId = await getOrCreatePerson(paid_by);

    let totalShare = 0;
    const sharesRupees = {};
    for (const [name, value] of Object.entries(shares)) {
      const share = parseFloat(value); // ✅ Use rupees directly
      sharesRupees[name] = share;
      totalShare += share;
    }

    // ✅ Validate total shares in rupees
    if (Math.abs(totalShare - amountRupees) > 0.01) {
      return res.status(400).json({ message: "Shares do not match total amount" });
    }

    const result = await db.query(
      'INSERT INTO expenses (amount, description, paid_by, split_type) VALUES ($1, $2, $3, $4) RETURNING id',
      [amountRupees, description, String(payerId), split_type]
    );

    const expenseId = result.rows[0].id;

    for (const [name, share] of Object.entries(sharesRupees)) {
      const personId = await getOrCreatePerson(name);
    }

    res.json({ success: true, message: "Expense added", expense_id: expenseId });
  }  catch (err) {
    console.error(err); // ✅ Log error to console (shows in Render logs)
    res.status(500).json({ error: err.message || "Unknown server error" });
  }

};



exports.getExpenses = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.id, e.amount, e.description, p.name AS paid_by, e.split_type, e.created_at
      FROM expenses e
      JOIN people p ON e.paid_by::INTEGER = p.id
      ORDER BY e.created_at DESC
    `);

    const expenses = result.rows.map(row => ({
      ...row,
      amount: paiseToRupees(row.amount)
    }));

    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



exports.updateExpense = async (req, res) => {
  try {
    const id = req.params.id;
    const { amount, description, paid_by } = req.body;

    if (!amount || !description || !paid_by) {
      return res.status(400).json({ message: "All fields required" });
    }

    const payerId = await getOrCreatePerson(paid_by);
    await db.query(
  'INSERT INTO expenses (amount, description, paid_by, split_type) VALUES ($1, $2, $3, $4)',
  [amountPaise, description, payerId.toString(), split_type]
);

    const result = await db.query(
      'UPDATE expenses SET amount = $1, description = $2, paid_by = $3 WHERE id = $4 RETURNING *',
      [parseFloat(amount), description, String(payerId), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.json({ success: true, message: "Expense updated", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};




exports.deleteExpense = async (req, res) => {
  try {
    const id = req.params.id;

    // First delete from expense_shares manually (if ON DELETE CASCADE is not set)
    await db.query('DELETE FROM expense_shares WHERE expense_id = $1', [id]);

    // Then delete the expense itself
    const result = await db.query('DELETE FROM expenses WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.json({ success: true, message: "Expense deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
