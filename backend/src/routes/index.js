const router = require('express').Router();
const pub = require('../controllers/publicController');
const adm = require('../controllers/adminController');
const { requireAuth, requireRole } = require('../middleware/auth');
const rl = require('../middleware/rateLimit');
const accounts = require('../controllers/accountController');
const customerAuth = require('../middleware/customerAuth');
const upload = require('../middleware/upload');

router.get('/health', (req, res) => res.json({ ok: true }));
router.post('/auth/register', rl.loginLimiter, accounts.register);
router.post('/auth/login', rl.loginLimiter, accounts.login);
router.get('/account/me', customerAuth.required, accounts.me);
router.get('/account/orders', customerAuth.required, accounts.orders);
router.post('/account/orders/link', rl.trackLimiter, customerAuth.required, accounts.linkOrder);

// ----- public -----
router.get('/public/settings', pub.settings);
router.get('/public/payment-methods', pub.paymentMethods);
router.get('/networks', pub.networks);
router.get('/packages', pub.packages);
router.get('/packages/:id', pub.packageById);
router.post('/bookings', rl.bookingLimiter, customerAuth.optional, upload.single('receipt'), pub.createBooking);
router.post('/orders/track', rl.trackLimiter, pub.track);
router.post('/orders/payment', rl.trackLimiter, upload.single('receipt'), pub.submitPayment);

// ----- admin -----
const a = require('express').Router();
a.post('/auth/login', rl.loginLimiter, adm.login);
a.use(requireAuth);
a.get('/auth/me', adm.me);
// staff + admin: bookings
a.get('/stats', adm.stats);
a.get('/bookings', adm.listBookings);
a.get('/bookings/:id', adm.getBooking);
a.put('/bookings/:id', adm.updateBooking);
a.get('/bookings/:id/receipt', adm.receipt);
a.post('/bookings/:id/review', adm.review);
a.post('/bookings/:id/approve', adm.approve);
a.post('/bookings/:id/confirm-payment', adm.confirmPayment);
a.post('/bookings/:id/processing', adm.process);
a.post('/bookings/:id/activate', adm.activate);
a.post('/bookings/:id/reject', adm.reject);
a.post('/bookings/:id/cancel', adm.cancel);
a.post('/bookings/:id/notes', adm.addNote);
a.post('/bookings/:id/whatsapp', adm.prepareWhatsAppMessage);
a.get('/customers', adm.listCustomers);
a.get('/customers/:id', adm.getCustomer);
a.get('/whatsapp/messages', adm.waMessages);
a.post('/whatsapp/messages/:id/opened', adm.markWhatsAppOpened);
a.post('/whatsapp/messages/:id/confirm', adm.confirmWhatsAppSent);
a.get('/transfers', adm.listTransfers);
a.get('/transfers/methods', adm.transferMethods);
a.post('/transfers', upload.single('receipt'), adm.createTransfer);
a.get('/transfers/:id/receipt', adm.transferReceipt);
a.post('/transfers/:id/review', adm.reviewTransfer);
// admin only
const only = requireRole('admin');
a.get('/packages', adm.listPackages);
a.post('/packages', only, adm.createPackage);
a.post('/packages/bulk-price', only, adm.bulkPrice);
a.put('/packages/:id', only, adm.updatePackage);
a.delete('/packages/:id', only, adm.deletePackage);
a.get('/networks', adm.listNetworks);
a.post('/networks', only, adm.createNetwork);
a.put('/networks/:id', only, adm.updateNetwork);
a.delete('/networks/:id', only, adm.deleteNetwork);
a.post('/upload/image', only, upload.single('image'), adm.uploadImage);
a.get('/settings', only, adm.getSettings);
a.put('/settings', only, adm.updateSettings);
router.use('/admin', a);

module.exports = router;
