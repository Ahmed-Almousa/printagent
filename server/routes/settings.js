import { Router } from 'express';
import { getMasterDb, getCompanyDb } from '../config/database.js';
import { authenticate, companyAccess } from '../middleware/auth.js';

const router = Router();

router.get('/:companySlug/company', authenticate, companyAccess, async (req, res) => {
  try {
  const masterDb = getMasterDb();
  const company = await masterDb.prepare('SELECT * FROM companies WHERE slug = ?').get(req.params.companySlug);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  res.json(company);
  } catch (err) { console.error('settings error:', err); res.status(500).json({ error: err.message }); }
});

router.put('/:companySlug/company', authenticate, companyAccess, async (req, res) => {
  try {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const masterDb = getMasterDb();
  const { name, phone, address, owner_name, currency, currency_rate, country, tax_number } = req.body;
  await masterDb.prepare(`UPDATE companies SET
    name=COALESCE(?,name), phone=COALESCE(?,phone), address=COALESCE(?,address),
    owner_name=COALESCE(?,owner_name), currency=COALESCE(?,currency),
    currency_rate=COALESCE(?,currency_rate), country=COALESCE(?,country),
    tax_number=COALESCE(?,tax_number) WHERE slug=?`)
    .run(name, phone, address, owner_name, currency, currency_rate, country, tax_number, req.params.companySlug);
  const company = await masterDb.prepare('SELECT * FROM companies WHERE slug = ?').get(req.params.companySlug);
  res.json(company);
  } catch (err) { console.error('settings error:', err); res.status(500).json({ error: err.message }); }
});

const CURRENCIES = [
  { code: 'SAR', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', symbol: '﷼' },
  { code: 'AED', nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'EGP', nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound', symbol: 'ج.م' },
  { code: 'USD', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', symbol: '$' },
  { code: 'EUR', nameAr: 'يورو', nameEn: 'Euro', symbol: '€' },
  { code: 'GBP', nameAr: 'جنيه إسترليني', nameEn: 'British Pound', symbol: '£' },
  { code: 'QAR', nameAr: 'ريال قطري', nameEn: 'Qatari Riyal', symbol: 'ر.ق' },
  { code: 'KWD', nameAr: 'دينار كويتي', nameEn: 'Kuwaiti Dinar', symbol: 'د.ك' },
  { code: 'BHD', nameAr: 'دينار بحريني', nameEn: 'Bahraini Dinar', symbol: 'د.ب' },
  { code: 'OMR', nameAr: 'ريال عماني', nameEn: 'Omani Rial', symbol: 'ر.ع' },
];

router.get('/:companySlug/currencies', authenticate, companyAccess, (req, res) => {
  res.json(CURRENCIES);
});

router.put('/:companySlug/currency-rate', authenticate, companyAccess, async (req, res) => {
  try {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const masterDb = getMasterDb();
  const { rate } = req.body;
  if (!rate || rate <= 0) return res.status(400).json({ error: 'Invalid rate' });
  await masterDb.prepare('UPDATE companies SET currency_rate = ? WHERE slug = ?').run(rate, req.params.companySlug);
  res.json({ rate });
  } catch (err) { console.error('settings error:', err); res.status(500).json({ error: err.message }); }
});

router.get('/:companySlug/request-types', authenticate, companyAccess, async (req, res) => {
  try {
  const db = getCompanyDb(req.params.companySlug);
  const types = await db.prepare('SELECT * FROM request_types WHERE company_slug = ? ORDER BY name ASC').all(req.params.companySlug);
  res.json(types);
  } catch (err) { console.error('settings error:', err); res.status(500).json({ error: err.message }); }
});

router.post('/:companySlug/request-types', authenticate, companyAccess, async (req, res) => {
  try {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const db = getCompanyDb(req.params.companySlug);
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const id = 'rt_' + Date.now();
  await db.prepare('INSERT INTO request_types (id, name, company_slug) VALUES (?,?,?)').run(id, name, req.params.companySlug);
  const type = await db.prepare('SELECT * FROM request_types WHERE id = ? AND company_slug = ?').get(id, req.params.companySlug);
  res.json(type);
  } catch (err) { console.error('settings error:', err); res.status(500).json({ error: err.message }); }
});

router.put('/:companySlug/request-types/:id', authenticate, companyAccess, async (req, res) => {
  try {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const db = getCompanyDb(req.params.companySlug);
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  await db.prepare('UPDATE request_types SET name = ? WHERE id = ? AND company_slug = ?').run(name, req.params.id, req.params.companySlug);
  const type = await db.prepare('SELECT * FROM request_types WHERE id = ? AND company_slug = ?').get(req.params.id, req.params.companySlug);
  res.json(type);
  } catch (err) { console.error('settings error:', err); res.status(500).json({ error: err.message }); }
});

router.delete('/:companySlug/request-types/:id', authenticate, companyAccess, async (req, res) => {
  try {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const db = getCompanyDb(req.params.companySlug);
  await db.prepare('DELETE FROM request_types WHERE id = ? AND company_slug = ?').run(req.params.id, req.params.companySlug);
  res.json({ success: true });
  } catch (err) { console.error('settings error:', err); res.status(500).json({ error: err.message }); }
});

export default router;
