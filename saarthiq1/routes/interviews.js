import express from 'express';
import { connectDB } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Schedule an interview
router.post('/schedule', requireAuth, async (req, res) => {
  try {
    const { applicationId, scheduledTime, mode, notes } = req.body;
    if (!applicationId || !scheduledTime) {
      return res.status(400).json({ success: false, message: 'applicationId and scheduledTime are required.' });
    }

    const db = await connectDB();

    await db.execute(
      'INSERT INTO interviews (application_id, scheduled_time, mode, notes) VALUES (?, ?, ?, ?)',
      [applicationId, scheduledTime, mode || 'online', notes || null]
    );

    await db.execute(
      'UPDATE applications SET status = ? WHERE id = ?',
      ['interview_scheduled', applicationId]
    );

    res.status(201).json({ success: true, message: 'Interview scheduled.' });
  } catch (error) {
    console.error('Schedule interview error:', error);
    res.status(500).json({ success: false, message: 'Server error scheduling interview.' });
  }
});

// Reschedule or cancel
router.patch('/:interviewId', requireAuth, async (req, res) => {
  try {
    const { scheduledTime, status, notes } = req.body;
    const db = await connectDB();

    const fields = [];
    const values = [];

    if (scheduledTime) { fields.push('scheduled_time = ?'); values.push(scheduledTime); }
    if (status) { fields.push('status = ?'); values.push(status); }
    if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    values.push(req.params.interviewId);

    const [result] = await db.execute(
      `UPDATE interviews SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Interview not found.' });
    }

    res.json({ success: true, message: 'Interview updated.' });
  } catch (error) {
    console.error('Update interview error:', error);
    res.status(500).json({ success: false, message: 'Server error updating interview.' });
  }
});

// Get interviews for an application
router.get('/application/:applicationId', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const [rows] = await db.execute(
      'SELECT * FROM interviews WHERE application_id = ? ORDER BY scheduled_time DESC',
      [req.params.applicationId]
    );
    res.json({ success: true, interviews: rows });
  } catch (error) {
    console.error('Fetch interviews error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching interviews.' });
  }
});

export default router;