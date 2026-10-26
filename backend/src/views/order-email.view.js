/**
 * Cyborg Supermarket - Order Email HTML View
 */

function renderOrderEmail(order, targetEmail = 'cyborgcoding1@gmail.com') {
  const orderId = order.id || order.order_id || 'UNKNOWN';
  const total = parseFloat(order.total_amount || order.total || 0).toFixed(2);
  const customer = order.customer_name || 'Valued Shopper';
  const items = order.items || [];
  const source = order.source || 'ONLINE';

  const itemRows = items.map(it => {
    const nameEn = it.product_name_en || it.name_en || it.name || 'Product';
    const nameAr = it.product_name_ar || it.name_ar || '';
    const qty = it.quantity || 1;
    const price = parseFloat(it.unit_price || it.price || 0).toFixed(2);
    const subtotal = parseFloat(it.subtotal || (qty * price)).toFixed(2);
    return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 14px; font-weight: 600; color: #0f172a;">
          ${nameEn}<br><span style="font-size: 11px; color: #64748b;">${nameAr}</span>
        </td>
        <td style="padding: 10px 14px; text-align: center; color: #334155;">${qty}</td>
        <td style="padding: 10px 14px; text-align: right; color: #334155;">${price} EGP</td>
        <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: #10B981;">${subtotal} EGP</td>
      </tr>
    `;
  }).join('');

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #0b1120; padding: 24px; color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background: #151d30; border-radius: 12px; border: 1px solid #22304a; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #10B981, #06B6D4); padding: 20px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 22px;">CYBORG SUPERMARKET — ORDER CONFIRMATION</h1>
          <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Order #${orderId} • Source: ${source}</p>
        </div>
        <div style="padding: 20px;">
          <p style="font-size: 14px; color: #94a3b8; margin-top: 0;">Customer: <strong style="color: #f8fafc;">${customer}</strong></p>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0; background: #0f172a; border-radius: 8px;">
            <thead>
              <tr style="border-bottom: 2px solid #22304a; color: #94a3b8; text-transform: uppercase; font-size: 11px;">
                <th style="padding: 8px 14px; text-align: left;">Item</th>
                <th style="padding: 8px 14px; text-align: center;">Qty</th>
                <th style="padding: 8px 14px; text-align: right;">Unit Price</th>
                <th style="padding: 8px 14px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>
          <div style="text-align: right; margin-top: 16px; border-top: 1px solid #22304a; padding-top: 12px;">
            <span style="font-size: 14px; color: #94a3b8;">Total Paid:</span>
            <span style="font-size: 22px; font-weight: 800; color: #10B981; margin-left: 8px;">${total} EGP</span>
          </div>
        </div>
        <div style="background: #0b1120; padding: 12px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #22304a;">
          Dispatched automatically to <strong>${targetEmail}</strong> by Cyborg Supermarket Omnichannel System.
        </div>
      </div>
    </div>
  `;
}

module.exports = { renderOrderEmail };
