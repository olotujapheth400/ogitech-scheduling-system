const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session'); 
const axios = require('axios'); 
const nodemailer = require('nodemailer'); 
const app = express();

const server = require('http').createServer(app);
const io = require('socket.io')(server);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'ogitech_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 }
}));

app.use((req, res, next) => {
    res.locals.formatTime = (dateTimeStr) => {
        if (!dateTimeStr) return "N/A";
        const dt = new Date(dateTimeStr);
        return dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };
    next();
});

const PAYSTACK_SECRET_KEY = "sk_test_1ca6b8f88bca8aeea9fa4b2dc9d00972a4ee7bd0";

const mailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'olotujapheth400gmail@gmail.com',
        pass: 'Ivpdzphdhefmdpvi' 
    }
});

const MONGO_URI = "mongodb+srv://Japheth:Password1320@cluster0.4yf5meu.mongodb.net/ogitech_restaurant?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("CONNECTED: Secured Cloud Pipeline to MongoDB Atlas."))
    .catch(err => console.error("CRITICAL ERROR: Failed to connect to Cloud Database:", err));

const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true }, 
    foodName: { type: String, required: true },
    processingTime: { type: Number, default: 10 },
    price: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    totalPrice: { type: Number, required: true },
    priority: { type: Number, default: 0 }, 
    status: { type: String, default: 'Pending Payment', enum: ['Pending Payment', 'Preparing', 'Ready for Pickup', 'Collected'] }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

const ADMIN_CREDENTIALS = { username: "admin", password: "pass1120" };
const STAFF_CREDENTIALS = { username: "staff1", password: "flyboy1320" };
let currentAlgorithm = 'sjf'; 

const MENU_ITEMS = [
    { id: "combo1", name: "Jollof Rice & Fried Rice with Chicken & Plantain", price: 3000, time: 10 },
    { id: "combo2", name: "White Rice & Beans with Fish & Assorted Meat", price: 2800, time: 10 },
    { id: "combo3", name: "Pounded Yam / Amala with Egusi / Ewedu & Beef", price: 3000, time: 10 },
    { id: "combo4", name: "Spaghetti Deluxe with Turkey & Coleslaw", price: 2900, time: 10 },
    { id: "combo5", name: "Ofada Rice with Ayamase Sauce, Egg & Ponmo", price: 3000, time: 10 },
    { id: "combo6", name: "Eba (Garri) with Native Okro Soup & Fresh Fish", price: 2500, time: 10 },
    { id: "combo7", name: "Coconut Rice with Peppered Gizzard & Plantain Fries", price: 2800, time: 10 },
    { id: "combo8", name: "Yam Porridge (Asaro) with Peppered Fish & Shaki", price: 2700, time: 10 },
    { id: "combo9", name: "Semovita / Wheat with Efo Riro & Assorted Meat", price: 3000, time: 10 },
    { id: "combo10", name: "Gizdodo Special (Gizzard & Plantain Mix) with White Rice", price: 2600, time: 10 },
    { id: "combo11", name: "Beans Porridge (Ewa Agoyin) with Fried Fish & Agege Bread", price: 2200, time: 10 },
    { id: "combo12", name: "Fried Yam, Potato & Akara Combo with Pepper Sauce", price: 2000, time: 10 },
    { id: "combo13", name: "Village Rice (Locust Beans Blend) with Smoked Fish & Egg", price: 2500, time: 10 },
    { id: "combo14", name: "Abula Special (Amala, Gbegiri, Ewedu) with Ogunfe", price: 3000, time: 10 },
    { id: "snack1", name: "Crispy Chicken and Chips Platter", price: 2500, time: 10 },
    { id: "snack2", name: "Golden Baked Egg Roll", price: 400, time: 10 },
    { id: "snack3", name: "Gourmet Sliced Cake Slice", price: 600, time: 10 },
    { id: "snack4", name: "Sausage Roll & Meat Pie Pastry Mix", price: 800, time: 10 }
];

function generateUniqueId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
    let token = '';
    for (let i = 0; i < 4; i++) { token += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return `OGI-${token}`;
}

const scheduler = {
    fifo: (jobs) => {
        return jobs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    },
    sjf: (jobs) => {
        const vips = jobs.filter(j => j.priority === 1).sort((a, b) => (a.processingTime * a.quantity) - (b.processingTime * b.quantity));
        const standards = jobs.filter(j => j.priority !== 1).sort((a, b) => (a.processingTime * a.quantity) - (b.processingTime * b.quantity));
        return [...vips, ...standards];
    }
};

function decorateWithQueueMetrics(targetTicket, orderedQueue) {
    if (!targetTicket) return null;
    
    let rankPosition = -1;
    for (let i = 0; i < orderedQueue.length; i++) {
        if (orderedQueue[i].orderId === targetTicket.orderId) {
            rankPosition = i + 1;
            break;
        }
    }
    if (rankPosition === -1) rankPosition = orderedQueue.length + 1;

    const readyAtTime = new Date();
    readyAtTime.setMinutes(readyAtTime.getMinutes() + 10); 
    
    const formattedClockTime = readyAtTime.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true
    });

    const cleanTicket = targetTicket.toObject ? targetTicket.toObject() : targetTicket;
    
    return {
        ...cleanTicket,
        queuePosition: rankPosition,
        totalWaitTime: 10, 
        estimatedTime: formattedClockTime,
        engineMode: currentAlgorithm.toUpperCase()
    };
}

function isAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    res.status(404).send("Cannot GET /admin");
}

function isStaff(req, res, next) {
    if (req.session && req.session.isStaff) return next();
    res.status(404).send("Cannot GET /staff");
}

app.get('/', (req, res) => { res.render('index'); });

app.get('/order', async (req, res) => {
    try {
        const activeJobs = await Order.find({ status: 'Preparing' });
        let orderedQueue = currentAlgorithm === 'sjf' ? scheduler.sjf(activeJobs) : scheduler.fifo(activeJobs);
        
        let searchResult = null;
        let searchError = false;
        if (req.query.searchId) {
            const rawSearch = await Order.findOne({ orderId: req.query.searchId.toUpperCase().trim() });
            if (!rawSearch) { searchError = true; } 
            else { searchResult = decorateWithQueueMetrics(rawSearch, orderedQueue); }
        }

        let finalTicket = null;
        if (req.query.ticket) {
            const rawTicket = JSON.parse(decodeURIComponent(req.query.ticket));
            finalTicket = decorateWithQueueMetrics(rawTicket, orderedQueue);
        }

        res.render('customer', {
            menu: MENU_ITEMS,
            jobs: orderedQueue,
            searchQuery: req.query.searchId || '',
            searchResult,
            searchError,
            successMsg: req.query.successMsg || null,
            ticket: finalTicket,
            algo: currentAlgorithm
        });
    } catch (err) { res.status(500).send("Customer Interface Render Error"); }
});

app.post('/place-order', async (req, res) => {
    const { customerName, customerEmail, foodId, priority, quantity } = req.body;
    const selectedMeal = MENU_ITEMS.find(dish => dish.id === foodId);
    const qty = parseInt(quantity) || 1;
    const orderPriority = parseInt(priority) || 0;

    if (!customerName || !customerEmail || !selectedMeal) return res.redirect('/order');

    const orderId = generateUniqueId();
    let calculatedPrice = selectedMeal.price * qty;
    if (orderPriority === 1) calculatedPrice += 500; 

    try {
        const pendingOrder = new Order({
            orderId: orderId,
            customerName: customerName,
            customerEmail: customerEmail,
            foodName: selectedMeal.name,
            processingTime: 10, 
            price: selectedMeal.price,
            quantity: qty,
            totalPrice: calculatedPrice, 
            priority: orderPriority, 
            status: 'Pending Payment'
        });
        await pendingOrder.save();

        const paystackPayload = {
            email: customerEmail,
            amount: calculatedPrice * 100, 
            reference: orderId,
            callback_url: `${req.protocol}://${req.get('host')}/payment/callback`
        };

        const response = await axios.post('https://api.paystack.co/transaction/initialize', paystackPayload, {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' }
        });
        res.redirect(response.data.data.authorization_url);
    } catch (err) { res.redirect('/order?error=payment_failed'); }
});

function sendReceiptEmail(orderInstance) {
    const emailLayout = {
        from: '"OGITECH Restaurant" <olotujapheth400gmail@gmail.com>',
        to: orderInstance.customerEmail,
        subject: `Your Smart Food Order Receipt - Token: ${orderInstance.orderId}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; max-width: 600px;">
                <h2 style="color: #E63946;">OGITECH Restaurant Payment Confirmed!</h2>
                <p>Hello <strong>${orderInstance.customerName}</strong>, your order has been verified successfully.</p>
                <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #E63946; margin: 20px 0;">
                    <h3>YOUR PICKUP TOKEN: ${orderInstance.orderId}</h3>
                    <p>Meal preparation max limit: 10 minutes window.</p>
                </div>
                <p><strong>Order Summary:</strong> ${orderInstance.foodName} (x${orderInstance.quantity})</p>
                <p><strong>Total Paid:</strong> ₦${orderInstance.totalPrice.toLocaleString()}</p>
            </div>`
    };
    mailTransport.sendMail(emailLayout).catch(err => console.error(err));
}

app.get('/payment/callback', async (req, res) => {
    const referenceId = req.query.reference;
    try {
        const response = await axios.get(`https://api.paystack.co/transaction/verify/${referenceId}`, {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
        });
        if (response.data.data.status === 'success') {
            const confirmedOrder = await Order.findOneAndUpdate({ orderId: referenceId }, { status: 'Preparing' }, { new: true });
            io.emit('queueUpdate', { message: "Queue dynamic refresh." });
            if (confirmedOrder) sendReceiptEmail(confirmedOrder);
            res.redirect(`/order?successMsg=true&ticket=${encodeURIComponent(JSON.stringify(confirmedOrder))}`);
        } else { res.redirect('/order?error=transaction_declined'); }
    } catch (err) { res.redirect('/order?error=verification_error'); }
});

app.get('/ogitech-kitchen-gate-2026', (req, res) => { res.render('login', { error: req.query.error || null }); });
app.post('/ogitech-kitchen-gate-2026', (req, res) => {
    const { username, password } = req.body;
    if (username === STAFF_CREDENTIALS.username && password === STAFF_CREDENTIALS.password) {
        req.session.isStaff = true; return res.redirect('/staff');
    }
    res.redirect('/ogitech-kitchen-gate-2026?error=true');
});
app.get('/staff-logout', (req, res) => { req.session.isStaff = null; res.redirect('/ogitech-kitchen-gate-2026'); });

app.get('/staff', isStaff, async (req, res) => {
    try {
        const activeJobs = await Order.find({ status: 'Preparing' });
        const readyToCollect = await Order.find({ status: 'Ready for Pickup' });
        const servedHistory = await Order.find({ status: 'Collected' }).sort({ updatedAt: -1 }).limit(10);
        const totalDispatchedCount = await Order.countDocuments({ status: 'Collected' });
        const grossRevenue = await Order.aggregate([{ $match: { status: 'Collected' } }, { $group: { _id: null, total: { $sum: "$totalPrice" } } }]);
        const finalSales = grossRevenue.length > 0 ? grossRevenue[0].total : 0;

        let orderedQueue = currentAlgorithm === 'sjf' ? scheduler.sjf(activeJobs) : scheduler.fifo(activeJobs);
        let counterSearchId = req.query.counterSearchId;
        let matchedCounterOrder = null;
        let counterSearchError = false;

        if (counterSearchId) {
            matchedCounterOrder = await Order.findOne({ orderId: counterSearchId.toUpperCase().trim(), status: 'Ready for Pickup' });
            if (!matchedCounterOrder) counterSearchError = true;
        }

        res.render('staff', {
            jobs: orderedQueue, pendingPickup: readyToCollect, history: servedHistory, revenue: finalSales,
            algo: currentAlgorithm, counterSearchQuery: counterSearchId || '', matchedCounterOrder, counterSearchError, completedCount: totalDispatchedCount
        });
    } catch (err) { res.status(500).send("Kitchen Operations Render Error"); }
});

app.get('/ogitech-boardroom-vault-2026', (req, res) => { res.render('admin-login', { error: req.query.error || null }); });
app.post('/ogitech-boardroom-vault-2026', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        req.session.isAdmin = true; return res.redirect('/admin');
    }
    res.redirect('/ogitech-boardroom-vault-2026?error=true');
});
app.get('/admin-logout', (req, res) => { req.session.isAdmin = null; res.redirect('/ogitech-boardroom-vault-2026'); });

app.get('/admin', isAdmin, async (req, res) => {
    try {
        const activeJobs = await Order.find({ status: 'Preparing' });
        const readyToCollect = await Order.find({ status: 'Ready for Pickup' }); 
        const servedHistory = await Order.find({ status: 'Collected' }).sort({ updatedAt: -1 }).limit(10);
        const totalDispatchedCount = await Order.countDocuments({ status: 'Collected' });
        const unverifiedPool = await Order.find({ status: 'Pending Payment' }).sort({ createdAt: -1 });
        const revenueAggregation = await Order.aggregate([{ $match: { status: 'Collected' } }, { $group: { _id: null, total: { $sum: "$totalPrice" } } }]);
        const totalRevenue = revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;
        
        let scheduledJobs = currentAlgorithm === 'sjf' ? scheduler.sjf(activeJobs) : scheduler.fifo(activeJobs);
        res.render('admin', { jobs: scheduledJobs, algo: currentAlgorithm, pendingPickup: readyToCollect, completedCount: totalDispatchedCount, revenue: totalRevenue, history: servedHistory, unverifiedOrders: unverifiedPool });
    } catch (err) { res.status(500).send("Admin Core View Render Error"); }
});

app.post('/admin/force-approve', isAdmin, async (req, res) => {
    const targetOrderId = req.body.orderId ? req.body.orderId.toUpperCase().trim() : null;
    if (!targetOrderId) return res.redirect('/admin');
    try {
        const forcedOrder = await Order.findOneAndUpdate({ orderId: targetOrderId }, { status: 'Preparing' }, { new: true });
        if (forcedOrder) {
            io.emit('queueUpdate', { message: `Order ${targetOrderId} manually verified.` });
            sendReceiptEmail(forcedOrder);
        }
        res.redirect('/admin');
    } catch (err) { res.status(500).send("Administrative Force-Approval Fail Loop"); }
});

app.post('/admin/delete-order', isAdmin, async (req, res) => {
    const targetOrderId = req.body.orderId ? req.body.orderId.toUpperCase().trim() : null;
    if (!targetOrderId) return res.redirect('/admin');
    try {
        await Order.deleteOne({ orderId: targetOrderId });
        res.redirect('/admin');
    } catch (err) { res.status(500).send("Administrative Data Elimination Fail Loop"); }
});

app.post('/complete-job/:id', isStaff, async (req, res) => {
    try {
        await Order.findByIdAndUpdate(req.params.id, { status: 'Ready for Pickup' });
        io.emit('queueUpdate', { message: "Queue update." });
        res.redirect('/staff');
    } catch (err) { res.status(500).send("Execution Lifecycle Transition Interrupted"); }
});

app.post('/pickup-job/:id', isStaff, async (req, res) => {
    try {
        await Order.findByIdAndUpdate(req.params.id, { status: 'Collected' });
        io.emit('queueUpdate', { message: "Counter collection complete." });
        res.redirect('/staff');
    } catch (err) { res.status(500).send("Cash Ledger Finalization Error"); }
});

app.post('/change-algo', isAdmin, (req, res) => {
    const targetAlgo = req.body.algorithm;
    if (targetAlgo === 'fifo' || targetAlgo === 'sjf') {
        currentAlgorithm = targetAlgo;
        io.emit('queueUpdate', { message: "Algorithm changed status map." });
    }
    res.redirect('/admin');
});

/* ==========================================================================
   NEW ADDITIONS: FULL LEDGER & AUDIT LOG ROUTING SYSTEM
   ========================================================================== */

// 1. Staff View Full Ledger Route
app.get('/staff/ledger', isStaff, async (req, res) => {
    try {
        const fullLedger = await Order.find({ status: 'Collected' }).sort({ updatedAt: -1 });
        res.render('staff-ledger', { history: fullLedger });
    } catch (err) {
        res.status(500).send("Staff Ledger Database Fetch Error");
    }
});

// 2. Admin View Full Audit Logs Route
app.get('/admin/audit-logs', isAdmin, async (req, res) => {
    try {
        const fullAuditLogs = await Order.find({}).sort({ createdAt: -1 });
        res.render('admin-audit', { logs: fullAuditLogs });
    } catch (err) {
        res.status(500).send("Admin Audit Log Database Fetch Error");
    }
});

/* ========================================================================== */

io.on('connection', (socket) => {
    console.log("WEBSOCKET STREAM TUNNEL SYNCED.");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SYSTEM ACTIVE on Port ${PORT}`));

module.exports = app;