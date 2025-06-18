const db = require('../db');

// Helper to get person ID from name
async function getPersonId(name) {
  const res = await db.query('SELECT id FROM people WHERE name = $1', [name]);
  if (res.rows.length === 0) throw new Error(`Person not found: ${name}`);
  return res.rows[0].id;
}

// Add a new recurring expense
exports.addRecurringExpense = async (req, res) => {
  try {
    const { amount, description, paid_by, split_type, shares, frequency } = req.body;

    if (!amount || !description || !paid_by || !split_type || !shares || !frequency) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const paidById = await getPersonId(paid_by);
    const amountRupees = parseFloat(amount);

    const result = await db.query(
      `INSERT INTO recurring_expenses (amount, description, paid_by, split_type, shares, frequency)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [amountRupees, description, paidById, split_type, JSON.stringify(shares), frequency]
    );

    res.json({
      success: true,
      recurring: {
        ...result.rows[0],
        amount: amountRupees,
        shares: shares
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to add recurring expense' });
  }
};

// List all recurring expenses
exports.getRecurringExpenses = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.*, p.name AS paid_by_name
      FROM recurring_expenses r
      JOIN people p ON r.paid_by = p.id
      ORDER BY r.id DESC
    `);

    const recurring = result.rows.map(row => ({
      id: row.id,
      amount: parseFloat(row.amount),
      description: row.description,
      paid_by: row.paid_by_name,
      split_type: row.split_type,
      shares: JSON.parse(row.shares),
      frequency: row.frequency,
      created_at: row.created_at
    }));

    res.json({ recurring });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Manually run recurring (simulate cron)
exports.runRecurringExpenses = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM recurring_expenses');
    const recurring = result.rows;

    for (const r of recurring) {
      const insertExpense = await db.query(
        `INSERT INTO expenses (amount, description, paid_by, split_type)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [r.amount, r.description, r.paid_by, r.split_type]
      );

      const expenseId = insertExpense.rows[0].id;
      const shares = JSON.parse(r.shares);

      for (const [name, value] of Object.entries(shares)) {
        const personId = await getPersonId(name);
        const shareAmount = parseFloat(value); // already in rupees

        await db.query(
          'INSERT INTO expense_shares (expense_id, person_id, share) VALUES ($1, $2, $3)',
          [expenseId, personId, shareAmount]
        );
      }
    }

    res.json({ success: true, message: 'Recurring expenses executed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateRecurringExpense = async (req, res) => {
  try {
    const id = req.params.id;
    const { amount, description, paid_by, split_type, shares, frequency } = req.body;

    if (!amount || !description || !paid_by || !split_type || !shares || !frequency) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const paidBy = await db.query('SELECT id FROM people WHERE name = $1', [paid_by]);
    if (paidBy.rows.length === 0) return res.status(400).json({ message: 'Payer not found' });

    const updated = await db.query(
      `UPDATE recurring_expenses
       SET amount = $1, description = $2, paid_by = $3, split_type = $4, shares = $5, frequency = $6
       WHERE id = $7 RETURNING *`,
      [
        parseFloat(amount), // ✅ Direct rupee value
        description,
        paidBy.rows[0].id,
        split_type,
        JSON.stringify(shares),
        frequency,
        id
      ]
    );

    if (updated.rows.length === 0)
      return res.status(404).json({ message: 'Recurring expense not found' });

    res.json({ message: 'Recurring expense updated', updated: updated.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteRecurringExpense = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await db.query('DELETE FROM recurring_expenses WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Recurring expense not found' });
    }

    res.json({ message: 'Recurring expense deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};


