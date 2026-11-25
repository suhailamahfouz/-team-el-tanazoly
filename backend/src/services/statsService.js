const Booking = require('../models/Booking');
exports.overview = async () => {
  const [byStatus, revenue, byNetwork, daily, recent] = await Promise.all([
    Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Booking.aggregate([{ $group: { _id: '$status', total: { $sum: '$price' } } }]),
    Booking.aggregate([{ $match: { status: 'activated' } }, { $group: { _id: '$networkName', count: { $sum: 1 }, revenue: { $sum: '$price' } } }]),
    Booking.aggregate([
      { $match: { status: 'activated', activatedAt: { $gte: new Date(Date.now() - 30 * 864e5) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$activatedAt' } }, revenue: { $sum: '$price' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Booking.find().sort({ createdAt: -1 }).limit(8).select('bookingId customerName networkName packageSnapshot.name price status createdAt'),
  ]);
  const c = Object.fromEntries(byStatus.map(s => [s._id, s.count]));
  const r = Object.fromEntries(revenue.map(s => [s._id, s.total]));
  return {
    totals: { all: byStatus.reduce((a, s) => a + s.count, 0), ...Object.fromEntries(['pending', 'awaiting_payment', 'payment_review', 'payment_confirmed', 'processing', 'activated', 'rejected', 'cancelled'].map(k => [k, c[k] || 0])) },
    revenue: { activated: r.activated || 0, inProgress: (r.payment_confirmed || 0) + (r.processing || 0), awaitingPayment: (r.awaiting_payment || 0) + (r.payment_review || 0) },
    byNetwork: byNetwork.map(n => ({ network: n._id, count: n.count, revenue: n.revenue })), daily: daily.map(d => ({ date: d._id, revenue: d.revenue, count: d.count })), recent,
  };
};
