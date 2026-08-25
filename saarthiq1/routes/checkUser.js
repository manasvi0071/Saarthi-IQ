import express from 'express';
import { connectDB } from '../db.js';

const router = express.Router();

router.get('/check-user', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const expectedHeader = `Bearer ${process.env.CROSS_APP_SECRET}`;

  if (authHeader !== expectedHeader) {
    return res.status(401).json({ exists: false, error: 'Unauthorized' });
  }

  const { email } = req.query;
  if (!email) return res.json({ exists: false });

  try {
    const db = await connectDB();
    const [rows] = await db.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    res.json({ exists: rows.length > 0 });
  } catch (err) {
    console.error('check-user error:', err.message);
    res.json({ exists: false });
  }
});

export default router;