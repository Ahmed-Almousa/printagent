import { Router } from 'express';
import { getCompanyDb } from '../config/database.js';
import { authenticate, companyAccess } from '../middleware/auth.js';

const router = Router();

// ── ITEMS (المواد/المنتجات) ──

router.get('/:companySlug/items', authenticate, companyAccess, async (req, res) => {
  try {
    const db = getCompanyDb(req.params.companySlug);
    const { search, category } = req.query;
    let sql = 'SELECT * FROM items WHERE company_slug = ? AND is_active = 1';
    const params = [req.params.companySlug];
    if (search) { sql += ' AND (name LIKE ? OR code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (category) { sql += ' AND category = ?'; params.push(category); }
    sql += ' ORDER BY name ASC';
    const items = await db.prepare(sql).all(...params);
    res.json(items);
  } catch (err) { console.error('items list error:', err); res.status(500).json({ error: err.message }); }
});

router.post('/:companySlug/items', authenticate, companyAccess, async (req, res) => {
  try {
    const db = getCompanyDb(req.params.companySlug);
    const { name, code, category, unit, default_price, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Item name is required' });
    const id = 'item_' + Date.now();
    await db.prepare(
      'INSERT INTO items (id, name, code, category, unit, default_price, description, company_slug) VALUES (?,?,?,?,?,?,?,?)'
    ).run(id, name, code || null, category || null, unit || null, default_price != null ? default_price : 0, description || null, req.params.companySlug);
    const item = await db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    res.json(item);
  } catch (err) { console.error('items create error:', err); res.status(500).json({ error: err.message }); }
});

router.put('/:companySlug/items/:id', authenticate, companyAccess, async (req, res) => {
  try {
    const db = getCompanyDb(req.params.companySlug);
    const { name, code, category, unit, default_price, description, is_active } = req.body;
    await db.prepare(
      `UPDATE items SET name=COALESCE(?,name), code=COALESCE(?,code), category=COALESCE(?,category),
       unit=COALESCE(?,unit), default_price=COALESCE(?,default_price), description=COALESCE(?,description),
       is_active=COALESCE(?,is_active) WHERE id=? AND company_slug=?`
    ).run(name || null, code || null, category || null, unit || null, default_price != null ? default_price : null, description || null, is_active != null ? is_active : null, req.params.id, req.params.companySlug);
    const item = await db.prepare('SELECT * FROM items WHERE id = ? AND company_slug = ?').get(req.params.id, req.params.companySlug);
    res.json(item);
  } catch (err) { console.error('items update error:', err); res.status(500).json({ error: err.message }); }
});

router.delete('/:companySlug/items/:id', authenticate, companyAccess, async (req, res) => {
  try {
    const db = getCompanyDb(req.params.companySlug);
    await db.prepare('UPDATE items SET is_active=0 WHERE id=? AND company_slug=?').run(req.params.id, req.params.companySlug);
    res.json({ success: true });
  } catch (err) { console.error('items delete error:', err); res.status(500).json({ error: err.message }); }
});

// ── INVOICES WITH LINE ITEMS ──

function generateInvoiceNumber(db, slug, type) {
  const year = new Date().getFullYear();
  const row = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE company_slug=? AND type=? AND strftime('%Y',created_at)=?").get(slug, type, String(year));
  const seq = (row ? row.c : 0) + 1;
  const prefix = type === 'sale' ? 'SALE' : 'PUR';
  return `${prefix}-${year}-${String(seq).padStart(4,'0')}`;
}

router.post('/:companySlug/invoices', authenticate, companyAccess, async (req, res) => {
  try {
    const db = getCompanyDb(req.params.companySlug);
    const slug = req.params.companySlug;
    const { type, customer_name, customer_phone, customer_address, invoice_date, notes, items, tax, discount } = req.body;
    if (!type || !['sale','purchase'].includes(type)) return res.status(400).json({ error: 'type must be sale or purchase' });
    if (!customer_name) return res.status(400).json({ error: 'customer_name is required' });
    const id = 'inv_' + Date.now();
    const invoiceNumber = generateInvoiceNumber(db, slug, type);
    const itemList = items || [];
    const subtotal = itemList.reduce((s, it) => s + (it.total || (it.quantity * it.unit_price)), 0);
    const taxVal = tax != null ? tax : 0;
    const discountVal = discount != null ? discount : 0;
    await db.prepare(
      `INSERT INTO invoices (id, type, invoice_number, vendor_client_name, amount, description, invoice_date, created_by, company_slug, customer_name, customer_phone, customer_address, notes, tax, discount, subtotal, total_items)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(id, type, invoiceNumber, customer_name, subtotal, notes || null, invoice_date || null, req.user.id, slug, customer_name, customer_phone || null, customer_address || null, notes || null, taxVal, discountVal, subtotal, itemList.length);

    for (const item of itemList) {
      const iiId = 'ii_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const qty = item.quantity || 1;
      const up = item.unit_price || 0;
      const tot = item.total != null ? item.total : (qty * up);
      await db.prepare(
        'INSERT INTO invoice_items (id, invoice_id, item_id, item_name, quantity, unit_price, total, company_slug) VALUES (?,?,?,?,?,?,?,?)'
      ).run(iiId, id, item.item_id || null, item.item_name || null, qty, up, tot, slug);

      if (type === 'purchase' && item.item_id) {
        const inv = await db.prepare('SELECT * FROM inventory WHERE item_id=? AND company_slug=?').get(item.item_id, slug);
        if (inv) {
          await db.prepare('UPDATE inventory SET quantity=quantity+? WHERE item_id=? AND company_slug=?').run(qty, item.item_id, slug);
        } else {
          const invId = 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
          await db.prepare('INSERT INTO inventory (id, item_id, quantity, company_slug) VALUES (?,?,?,?)').run(invId, item.item_id, qty, slug);
        }
        const imId = 'im_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        await db.prepare(
          'INSERT INTO inventory_movements (id, item_id, type, quantity, reference_type, reference_id, company_slug) VALUES (?,?,?,?,?,?,?)'
        ).run(imId, item.item_id, 'in', qty, 'purchase_invoice', id, slug);
      }
    }

    const invoice = await db.prepare('SELECT * FROM invoices WHERE id=?').get(id);
    const invoiceItems = await db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(id);
    res.json({ ...invoice, items: invoiceItems });
  } catch (err) { console.error('invoices create error:', err); res.status(500).json({ error: err.message }); }
});

router.get('/:companySlug/invoices', authenticate, companyAccess, async (req, res) => {
  try {
    const db = getCompanyDb(req.params.companySlug);
    const slug = req.params.companySlug;
    const { type, from, to } = req.query;
    let sql = 'SELECT i.*, COALESCE(SUM(ii.total),0) as items_total, COUNT(ii.id) as item_count FROM invoices i LEFT JOIN invoice_items ii ON i.id=ii.invoice_id WHERE i.company_slug=?';
    const params = [slug];
    if (type) { sql += ' AND i.type=?'; params.push(type); }
    if (from) { sql += ' AND i.invoice_date >= ?'; params.push(from); }
    if (to) { sql += ' AND i.invoice_date <= ?'; params.push(to); }
    sql += ' GROUP BY i.id ORDER BY i.created_at DESC';
    const invoices = await db.prepare(sql).all(...params);
    res.json(invoices);
  } catch (err) { console.error('invoices list error:', err); res.status(500).json({ error: err.message }); }
});

router.get('/:companySlug/invoices/:id', authenticate, companyAccess, async (req, res) => {
  try {
    const db = getCompanyDb(req.params.companySlug);
    const invoice = await db.prepare('SELECT * FROM invoices WHERE id=? AND company_slug=?').get(req.params.id, req.params.companySlug);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    const items = await db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(req.params.id);
    res.json({ ...invoice, items });
  } catch (err) { console.error('invoices get error:', err); res.status(500).json({ error: err.message }); }
});

router.put('/:companySlug/invoices/:id', authenticate, companyAccess, async (req, res) => {
  try {
    const db = getCompanyDb(req.params.companySlug);
    const slug = req.params.companySlug;
    const id = req.params.id;
    const existing = await db.prepare('SELECT * FROM invoices WHERE id=? AND company_slug=?').get(id, slug);
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });
    const { type, customer_name, customer_phone, customer_address, invoice_date, notes, items, tax, discount } = req.body;
    const resolvedType = type || existing.type;
    const itemList = items || [];
    const subtotal = itemList.reduce((s, it) => s + (it.total || (it.quantity * it.unit_price)), 0);
    const taxVal = tax != null ? tax : (existing.tax || 0);
    const discountVal = discount != null ? discount : (existing.discount || 0);

    // Reverse old inventory changes for purchase invoices
    if (existing.type === 'purchase') {
      const oldItems = await db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(id);
      for (const oi of oldItems) {
        if (!oi.item_id) continue;
        const inv = await db.prepare('SELECT * FROM inventory WHERE item_id=? AND company_slug=?').get(oi.item_id, slug);
        if (inv) {
          await db.prepare('UPDATE inventory SET quantity=quantity-? WHERE item_id=? AND company_slug=?').run(oi.quantity, oi.item_id, slug);
        }
        const imId = 'im_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        await db.prepare(
          'INSERT INTO inventory_movements (id, item_id, type, quantity, reference_type, reference_id, notes, company_slug) VALUES (?,?,?,?,?,?,?,?)'
        ).run(imId, oi.item_id, 'out', oi.quantity, 'purchase_invoice_reversal', id, 'Reversal on invoice update', slug);
      }
    }

    // Delete old invoice_items
    await db.prepare('DELETE FROM invoice_items WHERE invoice_id=?').run(id);

    // Update invoice
    await db.prepare(
      `UPDATE invoices SET
       type=COALESCE(?,type), vendor_client_name=COALESCE(?,vendor_client_name),
       amount=COALESCE(?,amount), description=COALESCE(?,description),
       invoice_date=COALESCE(?,invoice_date),
       customer_name=COALESCE(?,customer_name), customer_phone=COALESCE(?,customer_phone),
       customer_address=COALESCE(?,customer_address), notes=COALESCE(?,notes),
       tax=COALESCE(?,tax), discount=COALESCE(?,discount), subtotal=COALESCE(?,subtotal),
       total_items=COALESCE(?,total_items)
       WHERE id=? AND company_slug=?`
    ).run(
      type || null, customer_name || null, subtotal != null ? subtotal : null,
      notes || null, invoice_date || null,
      customer_name || null, customer_phone || null, customer_address || null,
      notes || null, taxVal != null ? taxVal : null, discountVal != null ? discountVal : null,
      subtotal != null ? subtotal : null, itemList.length != null ? itemList.length : null,
      id, slug
    );

    // Insert new invoice_items
    for (const item of itemList) {
      const iiId = 'ii_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const qty = item.quantity || 1;
      const up = item.unit_price || 0;
      const tot = item.total != null ? item.total : (qty * up);
      await db.prepare(
        'INSERT INTO invoice_items (id, invoice_id, item_id, item_name, quantity, unit_price, total, company_slug) VALUES (?,?,?,?,?,?,?,?)'
      ).run(iiId, id, item.item_id || null, item.item_name || null, qty, up, tot, slug);

      // Apply new inventory changes for purchase invoices
      if (resolvedType === 'purchase' && item.item_id) {
        const inv = await db.prepare('SELECT * FROM inventory WHERE item_id=? AND company_slug=?').get(item.item_id, slug);
        if (inv) {
          await db.prepare('UPDATE inventory SET quantity=quantity+? WHERE item_id=? AND company_slug=?').run(qty, item.item_id, slug);
        } else {
          const invId = 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
          await db.prepare('INSERT INTO inventory (id, item_id, quantity, company_slug) VALUES (?,?,?,?)').run(invId, item.item_id, qty, slug);
        }
        const imId = 'im_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        await db.prepare(
          'INSERT INTO inventory_movements (id, item_id, type, quantity, reference_type, reference_id, company_slug) VALUES (?,?,?,?,?,?,?)'
        ).run(imId, item.item_id, 'in', qty, 'purchase_invoice', id, slug);
      }
    }

    const invoice = await db.prepare('SELECT * FROM invoices WHERE id=?').get(id);
    const invoiceItems = await db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(id);
    res.json({ ...invoice, items: invoiceItems });
  } catch (err) { console.error('invoices update error:', err); res.status(500).json({ error: err.message }); }
});

router.delete('/:companySlug/invoices/:id', authenticate, companyAccess, async (req, res) => {
  try {
    const db = getCompanyDb(req.params.companySlug);
    const slug = req.params.companySlug;
    const id = req.params.id;
    const invoice = await db.prepare('SELECT * FROM invoices WHERE id=? AND company_slug=?').get(id, slug);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Reverse inventory for purchase invoices
    if (invoice.type === 'purchase') {
      const oldItems = await db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(id);
      for (const oi of oldItems) {
        if (!oi.item_id) continue;
        const inv = await db.prepare('SELECT * FROM inventory WHERE item_id=? AND company_slug=?').get(oi.item_id, slug);
        if (inv) {
          await db.prepare('UPDATE inventory SET quantity=quantity-? WHERE item_id=? AND company_slug=?').run(oi.quantity, oi.item_id, slug);
        }
        const imId = 'im_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        await db.prepare(
          'INSERT INTO inventory_movements (id, item_id, type, quantity, reference_type, reference_id, notes, company_slug) VALUES (?,?,?,?,?,?,?,?)'
        ).run(imId, oi.item_id, 'out', oi.quantity, 'purchase_invoice_deletion', id, 'Reversal on invoice deletion', slug);
      }
    }

    await db.prepare('DELETE FROM invoice_items WHERE invoice_id=?').run(id);
    await db.prepare('DELETE FROM invoices WHERE id=? AND company_slug=?').run(id, slug);
    res.json({ success: true });
  } catch (err) { console.error('invoices delete error:', err); res.status(500).json({ error: err.message }); }
});

// ── INVENTORY (المستودع) ──

router.get('/:companySlug/inventory/movements', authenticate, companyAccess, async (req, res) => {
  try {
    const db = getCompanyDb(req.params.companySlug);
    const slug = req.params.companySlug;
    const { item_id, from, to } = req.query;
    let sql = 'SELECT im.*, it.name as item_name FROM inventory_movements im JOIN items it ON im.item_id=it.id WHERE im.company_slug=?';
    const params = [slug];
    if (item_id) { sql += ' AND im.item_id=?'; params.push(item_id); }
    if (from) { sql += ' AND im.created_at >= ?'; params.push(from); }
    if (to) { sql += ' AND im.created_at <= ?'; params.push(to); }
    sql += ' ORDER BY im.created_at DESC';
    const movements = await db.prepare(sql).all(...params);
    res.json(movements);
  } catch (err) { console.error('inventory movements error:', err); res.status(500).json({ error: err.message }); }
});

router.get('/:companySlug/inventory/reports', authenticate, companyAccess, async (req, res) => {
  try {
    const db = getCompanyDb(req.params.companySlug);
    const slug = req.params.companySlug;
    const totalItems = await db.prepare('SELECT COUNT(*) as c FROM inventory WHERE company_slug=?').get(slug);
    const totalQty = await db.prepare("SELECT COALESCE(SUM(quantity),0) as total FROM inventory WHERE company_slug=?").get(slug);
    const lowStock = await db.prepare('SELECT COUNT(*) as c FROM inventory WHERE company_slug=? AND quantity <= min_stock').get(slug);
    const totalValue = await db.prepare(
      "SELECT COALESCE(SUM(it.default_price * inv.quantity),0) as total FROM inventory inv JOIN items it ON inv.item_id=it.id WHERE inv.company_slug=?"
    ).get(slug);
    const categoryBreakdown = await db.prepare(
      "SELECT it.category, COUNT(*) as count FROM inventory inv JOIN items it ON inv.item_id=it.id WHERE inv.company_slug=? AND it.category IS NOT NULL GROUP BY it.category"
    ).all(slug);
    res.json({
      total_items: totalItems ? totalItems.c : 0,
      total_quantity: totalQty ? totalQty.total : 0,
      low_stock_items: lowStock ? lowStock.c : 0,
      total_value: totalValue ? totalValue.total : 0,
      category_breakdown: categoryBreakdown || [],
    });
  } catch (err) { console.error('inventory reports error:', err); res.status(500).json({ error: err.message }); }
});

router.get('/:companySlug/inventory', authenticate, companyAccess, async (req, res) => {
  try {
    const db = getCompanyDb(req.params.companySlug);
    const slug = req.params.companySlug;
    const rows = await db.prepare(
      'SELECT inv.*, it.name as item_name, it.code as item_code, it.unit FROM inventory inv JOIN items it ON inv.item_id=it.id WHERE inv.company_slug=? ORDER BY it.name ASC'
    ).all(slug);
    const result = rows.map(r => ({ ...r, needs_reorder: r.quantity <= (r.min_stock || 0) }));
    res.json(result);
  } catch (err) { console.error('inventory list error:', err); res.status(500).json({ error: err.message }); }
});

router.put('/:companySlug/inventory/:itemId', authenticate, companyAccess, async (req, res) => {
  try {
    const db = getCompanyDb(req.params.companySlug);
    const slug = req.params.companySlug;
    const { quantity, min_stock, location } = req.body;
    const existing = await db.prepare('SELECT * FROM inventory WHERE item_id=? AND company_slug=?').get(req.params.itemId, slug);
    if (!existing) return res.status(404).json({ error: 'Inventory record not found' });
    await db.prepare(
      'UPDATE inventory SET quantity=COALESCE(?,quantity), min_stock=COALESCE(?,min_stock), location=COALESCE(?,location), updated_at=datetime(\'now\') WHERE item_id=? AND company_slug=?'
    ).run(quantity != null ? quantity : null, min_stock != null ? min_stock : null, location || null, req.params.itemId, slug);

    const imId = 'im_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const diff = quantity != null ? (quantity - existing.quantity) : 0;
    await db.prepare(
      'INSERT INTO inventory_movements (id, item_id, type, quantity, reference_type, notes, company_slug) VALUES (?,?,?,?,?,?,?)'
    ).run(imId, req.params.itemId, 'adjustment', diff, 'direct_adjustment', `Adjusted from ${existing.quantity} to ${quantity != null ? quantity : existing.quantity}`, slug);

    const updated = await db.prepare('SELECT * FROM inventory WHERE item_id=? AND company_slug=?').get(req.params.itemId, slug);
    res.json(updated);
  } catch (err) { console.error('inventory update error:', err); res.status(500).json({ error: err.message }); }
});

export default router;
