import express from 'express';
import { connectDB } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Candidate applies for a job
router.post('/apply', requireAuth, async (req, res) => {
  try {
    const { jobId } = req.body;
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'jobId is required' });
    }

    const db = await connectDB();

    const [existing] = await db.execute(
      'SELECT id FROM applications WHERE job_id = ? AND candidate_id = ?',
      [jobId, req.user.id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'You have already applied for this job.' });
    }

    await db.execute(
      'INSERT INTO applications (job_id, candidate_id) VALUES (?, ?)',
      [jobId, req.user.id]
    );

    res.status(201).json({ success: true, message: 'Application submitted successfully.' });
  } catch (error) {
    console.error('Apply error:', error);
    res.status(500).json({ success: false, message: 'Server error while applying.' });
  }
});

// Employer views applications for a job
router.get('/job/:jobId', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const [rows] = await db.execute(
      `SELECT a.id, a.status, a.applied_at, u.id AS candidate_id, u.name, u.email, u.phone
       FROM applications a
       JOIN users u ON a.candidate_id = u.id
       WHERE a.job_id = ?
       ORDER BY a.applied_at DESC`,
      [req.params.jobId]
    );

    res.json({ success: true, applications: rows });
  } catch (error) {
    console.error('Fetch applications error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching applications.' });
  }
});

// Employer shortlists or rejects a candidate
router.patch('/:applicationId/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['shortlisted', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const db = await connectDB();

    const [result] = await db.execute(
      'UPDATE applications SET status = ? WHERE id = ?',
      [status, req.params.applicationId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const [[app]] = await db.execute(
      'SELECT candidate_id FROM applications WHERE id = ?',
      [req.params.applicationId]
    );

    await db.execute(
      `INSERT INTO notifications (type, title, user_id, data, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      ['application_status', `Application ${status}`, app.candidate_id, JSON.stringify({ applicationId: req.params.applicationId, status })]
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('applicationStatusUpdate', { applicationId: req.params.applicationId, status, candidateId: app.candidate_id });
    }

    res.json({ success: true, message: `Application ${status}.` });
  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({ success: false, message: 'Server error updating status.' });
  }
});

export default router;