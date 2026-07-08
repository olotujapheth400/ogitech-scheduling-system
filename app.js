const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session'); 
const axios = require('axios'); // Secure HTTP client for verification calls to Paystack
const nodemailer = require('nodemailer'); // Automated mail delivery subsystem
const app = express();

// Wrap Express with HTTP Server to enable WebSocket tunneling
const server = require('http').createServer(app);
const io = require('socket.io')(server);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static assets from public folder if needed
app.use(express.static(path.join(__dirname, 'public')));

// Configure secure browser memory tracking cookies
app.use(session({
    secret: 'ogitech_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 } // Session expires in 1 hour
}));

// =========================================================================
// GLOBAL VIEW LOCAL MIDDLEWARE (Fixes interface render errors permanently)
// =========================================================================
app.use((req, res, next) => {
    res.locals.formatTime = (dateTimeStr) => {
        if (!dateTimeStr) return "N/A";
        const dt = new Date(dateTimeStr);
        return dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };
    next();
});

// =========================================================================
// GATEWAY KEYS & AUTOMATED EMAIL CONFIGURATIONS (TEST CONFIGS)
// =========================================================================
const PAYSTACK_SECRET_KEY = "sk_test_1ca6b8f88bca8aeea9fa4b2dc9d00972a4ee7bd0";

const mailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'olotujapheth400gmail@gmail.com',
        pass: 'Ivpdzphdhefmdpvi' // 16-character Google App Password
    }
});

// ==========================================
// DB CONNECTION (MongoDB Atlas Cloud Backend)
// ==========================================
const MONGO_URI = "mongodb+srv://Japheth:Password1320@cluster0.4yf5meu.mongodb.net/ogitech_restaurant?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("CONNECTED: Secured Cloud Pipeline to MongoDB Atlas."))
    .catch(err => console.error("CRITICAL ERROR: Failed to connect to Cloud Database:", err));

// =========================================================================
// DATABASE SCHEMA DEFINITION (Expanded to include customer verification email)
// =========================================================================
const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true }, // Added for real-time digital receipt delivery
    foodName: { type: String, required: true },
    processingTime: { type: Number, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    totalPrice: { type: Number, required: true },
    priority: { type: Number, default: 0 }, // 0 = Standard, 1 = VIP
    status: { type: String, default: 'Pending Payment', enum: ['Pending Payment', 'Preparing', 'Ready for Pickup', 'Collected'] }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

// ==========================================
// RESTAURANT CORE CONSTANTS & ACCESS CONFIG
// ==========================================
const ADMIN_CREDENTIALS = { username: "admin", password: "pass1120" };
const STAFF_CREDENTIALS = { username: "staff1", password: "flyboy1320" };
let currentAlgorithm = 'sjf'; 

// Capped at 3000 max price, added snacks, balanced prep durations to a solid 10 minutes max
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
    for (let i = 0; i < 4; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `OGI-${token}`;
}

// ==========================================
// SCHEDULING ALGORITHM OPTIMIZATION MODELS
// ==========================================
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

// HELPER ASSIGNMENT ENGINE TO DECORATE TICKET WITH METRICS
function decorateWithQueueMetrics(targetTicket, orderedQueue) {
    if (!targetTicket) return null;
    
    let cumulativeWaitTime = 0;
    let rankPosition = -1;
    
    for (let i = 0; i < orderedQueue.length; i++) {
        const job = orderedQueue[i];
        cumulativeWaitTime += (job.processingTime * job.quantity);
        if (job.orderId === targetTicket.orderId) {
            rankPosition = i + 1;
            break;
        }
    }

    // Fallback if order isn't found active in the line
    if (rankPosition === -1) {
        rankPosition = orderedQueue.length + 1;
        cumulativeWaitTime += (targetTicket.processingTime * targetTicket.quantity);
    }

    const readyAtTime = new Date();
    // Enforcing a neat standard pickup estimation window anchor instead of compounding out logic blocks
    readyAtTime.setMinutes(readyAtTime.getMinutes() + 10);
    
    const formattedClockTime = readyAtTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    // Strip Mongoose doc structures clean if present
    const cleanTicket = targetTicket.toObject ? targetTicket.toObject() : targetTicket;
    
    return {
        ...cleanTicket,
        queuePosition: rankPosition,
        totalWaitTime: 10, // Hard-coded cap to reflect cafe pick-up pacing cleanly
        estimatedTime: formattedClockTime,
        engineMode: currentAlgorithm.toUpperCase()
    };
}

// ==========================================
// SECURITY GATEKEEPER MIDDLEWARES
// ==========================================
function isAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    res.status(404).send("Cannot GET /admin");
}

function isStaff(req, res, next) {
    if (req.session && req.session.isStaff) return next();
    res.status(404).send("Cannot GET /staff");
}

app.get('/admin-login', (req, res) => res.status(404).send("Cannot GET /admin-login"));
app.post('/admin-login', (req, res) => res.status(404).send("Cannot POST /admin-login"));
app.get('/staff-login', (req, res) => res.status(404).send("Cannot GET /staff-login"));
app.post('/staff-login', (req, res) => res.status(404).send("Cannot POST /staff-login"));

// =========================================================================
// UPGRADED HTTP GATEWAY ROUTES (ENDPOINTS)
// =========================================================================

// 1. BRAND NEW MAIN LANDING PAGE ROUTE
app.get('/', (req, res) => {
    res.render('index'); // Renders the beautiful modern 3-color welcome homepage
});

// 2. ORDER PACKAGES HUB (Previously root customer portal)
app.get('/order', async (req, res) => {
    try {
        const activeJobs = await Order.find({ status: 'Preparing' });
        let orderedQueue = currentAlgorithm === 'sjf' ? scheduler.sjf(activeJobs) : scheduler.fifo(activeJobs);
        
        let searchResult = null;
        let searchError = false;
        if (req.query.searchId) {
            const rawSearch = await Order.findOne({ orderId: req.query.searchId.toUpperCase().trim() });
            if (!rawSearch) {
                searchError = true;
            } else {
                searchResult = decorateWithQueueMetrics(rawSearch, orderedQueue);
            }
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

// =========================================================================
// REAL-TIME TRANSACTION MANAGEMENT PIPELINE (PAYSTACK ENDPOINTS)
// =========================================================================

// 1. DISPATCH SECURE PAYSTACK TRANSACTION INITIALIZER
app.post('/place-order', async (req, res) => {
    const { customerName, customerEmail, foodId, priority, quantity } = req.body;
    const selectedMeal = MENU_ITEMS.find(dish => dish.id === foodId);
    const qty = parseInt(quantity) || 1;
    const orderPriority = parseInt(priority) || 0;

    if (!customerName || !customerEmail || !selectedMeal) return res.redirect('/order');

    const orderId = generateUniqueId();
    let calculatedPrice = selectedMeal.price * qty;
    if (orderPriority === 1) calculatedPrice += 500; // Premium service tier markup

    try {
        // Save temporary order record with 'Pending Payment' state constraints
        const pendingOrder = new Order({
            orderId: orderId,
            customerName: customerName,
            customerEmail: customerEmail,
            foodName: selectedMeal.name,
            processingTime: 10, // Base calculation locked explicitly to 10 mins highest
            price: selectedMeal.price,
            quantity: qty,
            totalPrice: calculatedPrice, 
            priority: orderPriority, 
            status: 'Pending Payment'
        });
        await pendingOrder.save();

        // Establish operational checkout initialization data packet payload for Paystack API
        const paystackPayload = {
            email: customerEmail,
            amount: calculatedPrice * 100, // Paystack counts transactions strictly in Kobo 
            reference: orderId,
            callback_url: `${req.protocol}://${req.get('host')}/payment/callback`
        };

        const response = await axios.post('https://api.paystack.co/transaction/initialize', paystackPayload, {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        // Redirect user immediately to secure banking selection window interface
        res.redirect(response.data.data.authorization_url);

    } catch (err) { 
        console.error("Paystack Gateway Initialization Failure: ", err.message);
        res.redirect('/order?error=payment_failed'); 
    }
});

// Helper Function: Shared Email template dispatcher logic to clean up both callback and override routes
function sendReceiptEmail(orderInstance) {
    const emailLayout = {
        from: '"OGITECH Restaurant" <olotujapheth400gmail@gmail.com>',
        to: orderInstance.customerEmail,
        subject: `Your Smart Food Order Receipt - Token: ${orderInstance.orderId}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; max-width: 600px;">
                <h2 style="color: #E63946;">OGITECH Restaurant Payment Confirmed!</h2>
                <p>Hello <strong>${orderInstance.customerName}</strong>, your transfer has been verified successfully.</p>
                <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #E63946; margin: 20px 0;">
                    <h3 style="margin-top: 0;">YOUR DISPATCH PICKUP TOKEN</h3>
                    <h1 style="letter-spacing: 2px; color: #1D3557; margin: 10px 0;">${orderInstance.orderId}</h1>
                    <p style="margin-bottom: 0; font-size: 13px; color: #666;">Show this alphanumeric code at the dispatch counter to pick up your meal.</p>
                </div>
                <p><strong>Order Summary:</strong> ${orderInstance.foodName} (x${orderInstance.quantity})</p>
                <p><strong>Total Cost Settled:</strong> ₦${orderInstance.totalPrice.toLocaleString()}</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #888; text-align: center;">OGITECH Smart Queue System Engineering Core &copy; 2026</p>
            </div>
        `
    };
    mailTransport.sendMail(emailLayout).catch(mailErr => console.error("Receipt Dispatch Blocked: ", mailErr));
}

// 2. VERIFICATION ASYNC CALLBACK ROUTE (Handles transaction resolution loops)
app.get('/payment/callback', async (req, res) => {
    const referenceId = req.query.reference;

    try {
        const response = await axios.get(`https://api.paystack.co/transaction/verify/${referenceId}`, {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
        });

        if (response.data.data.status === 'success') {
            // Upgrade target document status safely from 'Pending Payment' to 'Preparing'
            const confirmedOrder = await Order.findOneAndUpdate(
                { orderId: referenceId },
                { status: 'Preparing' },
                { new: true }
            );

            // Execute WebSocket real-time event hook broadcast to all open staff terminals
            io.emit('queueUpdate', { message: "A new token order has joined the algorithmic kitchen workflow!" });

            // Fire automated email receipt using shared configuration engine
            if (confirmedOrder) sendReceiptEmail(confirmedOrder);

            // Return customer back gracefully to order panel layout view showing pickup voucher
            res.redirect(`/order?successMsg=true&ticket=${encodeURIComponent(JSON.stringify(confirmedOrder))}`);
        } else {
            res.redirect('/order?error=transaction_declined');
        }
    } catch (err) {
        console.error("Payment Verification Loop Exception: ", err.message);
        res.redirect('/order?error=verification_error');
    }
});

// STAFF CORE ACCESS ROUTING GATES
app.get('/ogitech-kitchen-gate-2026', (req, res) => {
    res.render('login', { error: req.query.error || null });
});

app.post('/ogitech-kitchen-gate-2026', (req, res) => {
    const { username, password } = req.body;
    if (username === STAFF_CREDENTIALS.username && password === STAFF_CREDENTIALS.password) {
        req.session.isStaff = true;
        return res.redirect('/staff');
    }
    res.redirect('/ogitech-kitchen-gate-2026?error=true');
});

app.get('/staff-logout', (req, res) => {
    req.session.isStaff = null;
    res.redirect('/ogitech-kitchen-gate-2026');
});

app.get('/staff', isStaff, async (req, res) => {
    try {
        const activeJobs = await Order.find({ status: 'Preparing' });
        const readyToCollect = await Order.find({ status: 'Ready for Pickup' });
        const servedHistory = await Order.find({ status: 'Collected' }).sort({ updatedAt: -1 }).limit(10);
        const totalDispatchedCount = await Order.countDocuments({ status: 'Collected' });
        
        const grossRevenue = await Order.aggregate([
            { $match: { status: 'Collected' } },
            { $group: { _id: null, total: { $sum: "$totalPrice" } } }
        ]);
        const finalSales = grossRevenue.length > 0 ? grossRevenue[0].total : 0;

        let orderedQueue = currentAlgorithm === 'sjf' ? scheduler.sjf(activeJobs) : scheduler.fifo(activeJobs);

        let counterSearchId = req.query.counterSearchId;
        let matchedCounterOrder = null;
        let counterSearchError = false;

        if (counterSearchId) {
            matchedCounterOrder = await Order.findOne({ 
                orderId: counterSearchId.toUpperCase().trim(), 
                status: 'Ready for Pickup' 
            });
            if (!matchedCounterOrder) counterSearchError = true;
        }

        res.render('staff', {
            jobs: orderedQueue,
            pendingPickup: readyToCollect,
            history: servedHistory,
            revenue: finalSales,
            algo: currentAlgorithm,
            counterSearchQuery: counterSearchId || '',
            matchedCounterOrder,
            counterSearchError,
            completedCount: totalDispatchedCount
        });
    } catch (err) { 
        res.status(500).send("Kitchen Operations Render Error"); 
    }
});

app.get('/staff/archive', isStaff, async (req, res) => {
    try {
        const fullHistory = await Order.find({ status: 'Collected' }).sort({ updatedAt: -1 });
        res.render('archive-view', { role: 'staff', history: fullHistory });
    } catch (err) {
        res.status(500).send("Error compiling staff history matrix log");
    }
});

// ADMIN PORTAL ROUTING GATES
app.get('/ogitech-boardroom-vault-2026', (req, res) => {
    res.render('admin-login', { error: req.query.error || null });
});

app.post('/ogitech-boardroom-vault-2026', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        req.session.isAdmin = true;
        return res.redirect('/admin');
    }
    res.redirect('/ogitech-boardroom-vault-2026?error=true');
});

app.get('/admin-logout', (req, res) => {
    req.session.isAdmin = null;
    res.redirect('/ogitech-boardroom-vault-2026');
});

app.get('/admin', isAdmin, async (req, res) => {
    try {
        const activeJobs = await Order.find({ status: 'Preparing' });
        const readyToCollect = await Order.find({ status: 'Ready for Pickup' }); 
        const servedHistory = await Order.find({ status: 'Collected' }).sort({ updatedAt: -1 }).limit(10);
        const totalDispatchedCount = await Order.countDocuments({ status: 'Collected' });

        // Retrieve unverified transactions locked in 'Pending Payment' to populate the Demo Bypass Matrix Table
        const unverifiedPool = await Order.find({ status: 'Pending Payment' }).sort({ createdAt: -1 });

        const revenueAggregation = await Order.aggregate([
            { $match: { status: 'Collected' } },
            { $group: { _id: null, total: { $sum: "$totalPrice" } } }
        ]);
        const totalRevenue = revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;
        
        let scheduledJobs = currentAlgorithm === 'sjf' ? scheduler.sjf(activeJobs) : scheduler.fifo(activeJobs);
        
        res.render('admin', { 
            jobs: scheduledJobs, 
            algo: currentAlgorithm, 
            pendingPickup: readyToCollect, 
            completedCount: totalDispatchedCount,
            revenue: totalRevenue,
            history: servedHistory,
            unverifiedOrders: unverifiedPool // Passed safely into administrative layout context
        });
    } catch (err) { res.status(500).send("Admin Core View Render Error"); }
});

// MODULE 2 BACKEND ENDPOINT: LIVE DEMO WEBHOOK OVERRIDE FORCER
app.post('/admin/force-approve', isAdmin, async (req, res) => {
    const targetOrderId = req.body.orderId ? req.body.orderId.toUpperCase().trim() : null;
    if (!targetOrderId) return res.redirect('/admin');

    try {
        // Force state transition directly from 'Pending Payment' to 'Preparing' status bypassing Paystack
        const forcedOrder = await Order.findOneAndUpdate(
            { orderId: targetOrderId },
            { status: 'Preparing' },
            { new: true }
        );

        if (forcedOrder) {
            // Signal running monitors using real-time WebSockets to update queues live
            io.emit('queueUpdate', { message: `Order ${targetOrderId} manually verified via Admin Security Override Tunnel.` });
            
            // Deliver email confirmation receipt asynchronously
            sendReceiptEmail(forcedOrder);
        }

        res.redirect('/admin');
    } catch (err) {
        console.error("Bypass Vault Error:", err.message);
        res.status(500).send("Administrative Force-Approval Fail Loop");
    }
});

// NEW MODULE 2 BACKEND SUB-ROUTE: PURGE UNVERIFIED RECORD FROM DISPATCH POOL
app.post('/admin/delete-order', isAdmin, async (req, res) => {
    const targetOrderId = req.body.orderId ? req.body.orderId.toUpperCase().trim() : null;
    if (!targetOrderId) return res.redirect('/admin');

    try {
        // Delete the order explicitly from the cloud collection database 
        await Order.deleteOne({ orderId: targetOrderId });
        
        console.log(`🗑️ Administrative Action: Stale order token ${targetOrderId} permanently dropped.`);
        
        // Soft refresh the active workspace UI grid maps
        res.redirect('/admin');
    } catch (err) {
        console.error("Record Purging Failure Exception:", err.message);
        res.status(500).send("Administrative Data Elimination Fail Loop");
    }
});

app.get('/admin/archive', isAdmin, async (req, res) => {
    try {
        const fullHistory = await Order.find({ status: 'Collected' }).sort({ updatedAt: -1 });
        res.render('archive-view', { role: 'admin', history: fullHistory });
    } catch (err) {
        res.status(500).send("Error compiling admin audit logs");
    }
});

// =========================================================================
// REAL-TIME KITCHEN ORDER TRACKING LIFECYCLE (WebSockets Broadcast Enforcers)
// =========================================================================
app.post('/complete-job/:id', isStaff, async (req, res) => {
    try {
        await Order.findByIdAndUpdate(req.params.id, { status: 'Ready for Pickup' });
        io.emit('queueUpdate', { message: "An active culinary job processing order has been updated to ready!" });
        res.redirect('/staff');
    } catch (err) { res.status(500).send("Execution Lifecycle Transition Interrupted"); }
});

app.post('/pickup-job/:id', isStaff, async (req, res) => {
    try {
        await Order.findByIdAndUpdate(req.params.id, { status: 'Collected' });
        io.emit('queueUpdate', { message: "An order has been collected from the dispatch counter." });
        res.redirect('/staff');
    } catch (err) { res.status(500).send("Cash Ledger Finalization Error"); }
});

app.post('/change-algo', isAdmin, (req, res) => {
    const targetAlgo = req.body.algorithm;
    if (targetAlgo === 'fifo' || targetAlgo === 'sjf') {
        currentAlgorithm = targetAlgo;
        io.emit('queueUpdate', { message: "The master scheduling algorithm array model has been updated dynamically." });
    }
    res.redirect('/admin');
});

// Real-time Event Listener Matrix for incoming Socket lines
io.on('connection', (socket) => {
    console.log("WEBSOCKET CONNECTION INITIALIZED: A control panel page terminal interface has synced.");
    socket.on('disconnect', () => {
        console.log("WEBSOCKET STREAM TERMINATED: Control terminal pipe dropped safely.");
    });
});

// ==========================================
// SYSTEM LISTENER ACTIVATION
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SYSTEM ACTIVE: Server cluster initializing smoothly on Port ${PORT}`));

module.exports = app;