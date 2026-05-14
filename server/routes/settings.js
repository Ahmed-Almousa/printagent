import { Router } from 'express';
import { masterDb, getCompanyDb } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/:companySlug/company', authenticate, (req, res) => {
  const company = masterDb.prepare('SELECT * FROM companies WHERE slug = ?').get(req.params.companySlug);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  res.json(company);
});

router.put('/:companySlug/company', authenticate, (req, res) => {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const { name, phone, address, owner_name, currency, currency_rate, country, tax_number } = req.body;
  masterDb.prepare(`UPDATE companies SET
    name=COALESCE(?,name), phone=COALESCE(?,phone), address=COALESCE(?,address),
    owner_name=COALESCE(?,owner_name), currency=COALESCE(?,currency),
    currency_rate=COALESCE(?,currency_rate), country=COALESCE(?,country),
    tax_number=COALESCE(?,tax_number) WHERE slug=?`)
    .run(name, phone, address, owner_name, currency, currency_rate, country, tax_number, req.params.companySlug);
  const company = masterDb.prepare('SELECT * FROM companies WHERE slug = ?').get(req.params.companySlug);
  res.json(company);
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

router.get('/:companySlug/currencies', authenticate, (req, res) => {
  res.json(CURRENCIES);
});

router.put('/:companySlug/currency-rate', authenticate, (req, res) => {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const { rate } = req.body;
  if (!rate || rate <= 0) return res.status(400).json({ error: 'Invalid rate' });
  masterDb.prepare('UPDATE companies SET currency_rate = ? WHERE slug = ?').run(rate, req.params.companySlug);
  res.json({ rate });
});

router.get('/:companySlug/request-types', authenticate, (req, res) => {
  const db = getCompanyDb(req.params.companySlug);
  const types = db.prepare('SELECT * FROM request_types ORDER BY name ASC').all();
  res.json(types);
});

router.post('/:companySlug/request-types', authenticate, (req, res) => {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const db = getCompanyDb(req.params.companySlug);
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const id = 'rt_' + Date.now();
  db.prepare('INSERT INTO request_types (id, name) VALUES (?,?)').run(id, name);
  const type = db.prepare('SELECT * FROM request_types WHERE id = ?').get(id);
  res.json(type);
});

router.put('/:companySlug/request-types/:id', authenticate, (req, res) => {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const db = getCompanyDb(req.params.companySlug);
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  db.prepare('UPDATE request_types SET name = ? WHERE id = ?').run(name, req.params.id);
  const type = db.prepare('SELECT * FROM request_types WHERE id = ?').get(req.params.id);
  res.json(type);
});

router.delete('/:companySlug/request-types/:id', authenticate, (req, res) => {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Not authorized' });
  const db = getCompanyDb(req.params.companySlug);
  db.prepare('DELETE FROM request_types WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
