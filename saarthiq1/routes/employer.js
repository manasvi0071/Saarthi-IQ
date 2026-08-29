import express from 'express';
import { connectDB } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
let schemaReady;

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = await connectDB();
      await db.execute(`CREATE TABLE IF NOT EXISTS employer_profiles (
        employer_id INT PRIMARY KEY, company_name VARCHAR(180) NOT NULL, industry VARCHAR(120),
        company_size VARCHAR(80), website VARCHAR(255), locations VARCHAR(255), about TEXT,
        logo_url TEXT, banner_url TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await db.execute(`CREATE TABLE IF NOT EXISTS employer_jobs (
        id INT AUTO_INCREMENT PRIMARY KEY, employer_id INT NOT NULL, title VARCHAR(180) NOT NULL,
        department VARCHAR(120), employment_type VARCHAR(40), experience_level VARCHAR(40),
        salary_min DECIMAL(12,2), salary_max DECIMAL(12,2), currency VARCHAR(5) DEFAULT 'INR',
        location VARCHAR(180), description TEXT, requirements TEXT, status ENUM('Draft','Published','Closed') DEFAULT 'Draft',
        applications INT DEFAULT 0, views INT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_employer_jobs_employer (employer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    })().catch(error => { schemaReady = null; throw error; });
  }
  return schemaReady;
}

router.use(requireAuth);

router.get('/profile', async (req, res) => {
  try { await ensureSchema(); const db = await connectDB(); const [rows] = await db.execute('SELECT * FROM employer_profiles WHERE employer_id = ?', [req.user.id]); res.json({ success: true, profile: rows[0] || null }); }
  catch (error) { res.status(500).json({ success: false, message: 'Unable to load company profile' }); }
});

router.put('/profile', async (req, res) => {
  try {
    await ensureSchema();
    const { company_name, industry, company_size, website, locations, about, logo_url, banner_url } = req.body;
    if (!company_name?.trim()) return res.status(400).json({ success: false, message: 'Company name is required' });
    const db = await connectDB();
    await db.execute(`INSERT INTO employer_profiles (employer_id, company_name, industry, company_size, website, locations, about, logo_url, banner_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE company_name=VALUES(company_name), industry=VALUES(industry), company_size=VALUES(company_size), website=VALUES(website), locations=VALUES(locations), about=VALUES(about), logo_url=VALUES(logo_url), banner_url=VALUES(banner_url)`,
      [req.user.id, company_name.trim(), industry || null, company_size || null, website || null, locations || null, about || null, logo_url || null, banner_url || null]);
    res.json({ success: true, message: 'Company profile saved' });
  } catch (error) { res.status(500).json({ success: false, message: 'Unable to save company profile' }); }
});

router.get('/jobs', async (req, res) => {
  try { await ensureSchema(); const db = await connectDB(); const [jobs] = await db.execute('SELECT * FROM employer_jobs WHERE employer_id = ? ORDER BY updated_at DESC', [req.user.id]); res.json({ success: true, jobs }); }
  catch (error) { res.status(500).json({ success: false, message: 'Unable to load jobs' }); }
});

router.post('/jobs', async (req, res) => {
  try {
    await ensureSchema();
    const { title, department, employment_type, experience_level, salary_min, salary_max, currency, location, description, requirements, status = 'Draft' } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Job title is required' });
    const db = await connectDB();
    const [result] = await db.execute(`INSERT INTO employer_jobs (employer_id, title, department, employment_type, experience_level, salary_min, salary_max, currency, location, description, requirements, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [req.user.id, title.trim(), department || null, employment_type || null, experience_level || null, salary_min || null, salary_max || null, currency || 'INR', location || null, description || null, requirements || null, ['Draft', 'Published', 'Closed'].includes(status) ? status : 'Draft']);
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) { res.status(500).json({ success: false, message: 'Unable to create job' }); }
});

router.patch('/jobs/:id/status', async (req, res) => {
  try { await ensureSchema(); const { status } = req.body; if (!['Draft', 'Published', 'Closed'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid job status' }); const db = await connectDB(); const [result] = await db.execute('UPDATE employer_jobs SET status = ? WHERE id = ? AND employer_id = ?', [status, req.params.id, req.user.id]); if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Job not found' }); res.json({ success: true }); }
  catch (error) { res.status(500).json({ success: false, message: 'Unable to update job status' }); }
});

router.delete('/jobs/:id', async (req, res) => {
  try { await ensureSchema(); const db = await connectDB(); const [result] = await db.execute('DELETE FROM employer_jobs WHERE id = ? AND employer_id = ?', [req.params.id, req.user.id]); if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Job not found' }); res.json({ success: true }); }
  catch (error) { res.status(500).json({ success: false, message: 'Unable to delete job' }); }
});

export default router;