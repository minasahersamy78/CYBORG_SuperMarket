/**
 * Cyborg Supermarket - Cashier Shift & Cash Drawer Reconciliation Service
 */

const crypto = require('crypto');
const db = require('../../database/db');

const shiftsService = {
  startShift(dto, cashierUser) {
    // Check if terminal already has an active open shift
    const openShift = db.getOne(
      'SELECT id, cashier_name FROM shifts WHERE terminal_id = ? AND is_closed = 0 LIMIT 1;',
      [dto.terminal_id]
    );

    if (openShift) {
      return {
        success: false,
        statusCode: 400,
        error: `Terminal '${dto.terminal_id}' already has an active shift (${openShift.id}) open by ${openShift.cashier_name}. Please close it first.`
      };
    }

    const shiftId = 'shift-' + crypto.randomUUID().substring(0, 8);
    const openingBalance = parseFloat(dto.opening_balance || 0);

    db.run(`
      INSERT INTO shifts (
        id, cashier_id, cashier_name, terminal_id, store_id, opening_balance,
        total_transactions, total_cash_sales, total_card_sales, total_refunds,
        started_at, is_closed
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0.00, 0.00, 0.00, datetime('now'), 0);
    `, [
      shiftId,
      cashierUser ? cashierUser.sub : 'usr-csh-01',
      cashierUser ? cashierUser.name : 'Cashier Ahmed',
      dto.terminal_id || 'TERM-01',
      dto.store_id || 1,
      openingBalance
    ]);

    // Audit log
    db.run(
      'INSERT INTO audit_logs (action, actor_id, actor_role, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?);',
      ['SHIFT_OPENED', cashierUser ? cashierUser.sub : 'cashier', 'CASHIER', 'SHIFT', shiftId, `Shift opened on ${dto.terminal_id} with ${openingBalance} EGP float`]
    );

    return this.getShiftSummary(shiftId);
  },

  closeShift(shiftId, actualCountedBalance, notes = '') {
    const shift = db.getOne('SELECT * FROM shifts WHERE id = ? LIMIT 1;', [shiftId]);
    if (!shift) return { success: false, statusCode: 404, error: 'Shift not found' };
    if (shift.is_closed) return { success: false, statusCode: 400, error: 'Shift already closed' };

    // Calculate expected cash in drawer
    const opening = parseFloat(shift.opening_balance);
    const cashSales = parseFloat(shift.total_cash_sales);
    const refunds = parseFloat(shift.total_refunds);
    const expectedClosing = opening + cashSales - refunds;

    const counted = parseFloat(actualCountedBalance);
    const discrepancy = parseFloat((counted - expectedClosing).toFixed(2));

    db.run(`
      UPDATE shifts
      SET closing_balance = ?,
          actual_counted_balance = ?,
          discrepancy = ?,
          ended_at = datetime('now'),
          is_closed = 1
      WHERE id = ?;
    `, [expectedClosing, counted, discrepancy, shiftId]);

    // Audit log
    db.run(
      'INSERT INTO audit_logs (action, actor_id, actor_role, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?);',
      ['SHIFT_CLOSED', shift.cashier_id, 'CASHIER', 'SHIFT', shiftId, `Shift closed. Expected: ${expectedClosing} EGP, Counted: ${counted} EGP, Discrepancy: ${discrepancy} EGP. ${notes}`]
    );

    return this.getShiftSummary(shiftId);
  },

  getShiftSummary(shiftId) {
    const shift = db.getOne('SELECT * FROM shifts WHERE id = ? LIMIT 1;', [shiftId]);
    if (!shift) return { success: false, statusCode: 404, error: 'Shift not found' };

    const orders = db.query(
      'SELECT id, total_amount, payment_method, status, created_at FROM orders WHERE shift_id = ? ORDER BY created_at DESC;',
      [shiftId]
    );

    return {
      success: true,
      statusCode: 200,
      data: {
        ...shift,
        opening_balance: parseFloat(shift.opening_balance),
        closing_balance: shift.closing_balance ? parseFloat(shift.closing_balance) : null,
        actual_counted_balance: shift.actual_counted_balance ? parseFloat(shift.actual_counted_balance) : null,
        discrepancy: parseFloat(shift.discrepancy || 0),
        total_cash_sales: parseFloat(shift.total_cash_sales),
        total_card_sales: parseFloat(shift.total_card_sales),
        total_refunds: parseFloat(shift.total_refunds),
        orders
      }
    };
  },

  getActiveShift(terminalId = 'TERM-01') {
    const shift = db.getOne(
      'SELECT * FROM shifts WHERE terminal_id = ? AND is_closed = 0 ORDER BY started_at DESC LIMIT 1;',
      [terminalId]
    );
    if (!shift) return { success: false, statusCode: 404, error: `No active shift on terminal '${terminalId}'` };
    return this.getShiftSummary(shift.id);
  }
};

module.exports = shiftsService;
