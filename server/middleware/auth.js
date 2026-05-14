import jwt from 'jsonwebtoken';
import { getMasterDb } from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'erp-secret-key-2024';

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, company_id: user.company_id, token_version: user.token_version || 0 },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = verifyToken(header.split(' ')[1]);
    const masterDb = getMasterDb();
    const dbUser = await masterDb.prepare('SELECT token_version, is_active FROM users WHERE id = ?').get(decoded.id);
    if (!dbUser || !dbUser.is_active) {
      return res.status(401).json({ error: 'Account disabled or removed' });
    }
    if (dbUser.token_version !== decoded.token_version) {
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function requirePermission(...permKeys) {
  return async (req, res, next) => {
    if (req.user.role === 'super_admin') return next();
    const masterDb = getMasterDb();
    const user = await masterDb.prepare('SELECT permissions FROM users WHERE id = ?').get(req.user.id);
    if (!user || !user.permissions) {
      return res.status(403).json({ error: 'No permissions assigned' });
    }
    const perms = user.permissions.split(',');
    const hasAll = permKeys.every(k => perms.includes(k));
    if (!hasAll) {
      return res.status(403).json({ error: `Access denied. Requires: ${permKeys.join(', ')}` });
    }
    next();
  };
}

export function companyAccess(req, res, next) {
  if (req.user.role === 'super_admin') return next();
  (async () => {
    const { companySlug } = req.params;
    const masterDb = getMasterDb();
    const company = await masterDb.prepare('SELECT * FROM companies WHERE slug = ?').get(companySlug);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    if (req.user.company_id !== company.id) {
      return res.status(403).json({ error: 'No access to this company' });
    }
    req.company = company;
    next();
  })();
}
