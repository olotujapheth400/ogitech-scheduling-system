const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session'); 
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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

// ==========================================
// DB CONNECTION (MongoDB Atlas Cloud Backend)
// ==========================================
const MONGO_URI = "mongodb+srv://Japheth:Password1320@cluster0.4yf5meu.mongodb.net/ogitech_restaurant?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("CONNECTED: Secured Cloud Pipeline to MongoDB Atlas."))
    .catch(err => console.error("CRITICAL ERROR: Failed to connect to Cloud Database:", err));

// ==========================================
// DATABASE SCHEMA DEFINITION
// ==========================================
const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    foodName: { type: String, required: true },
    processingTime: { type: Number, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    totalPrice: { type: Number, required: true },
    priority: { type: Number, default: 0 }, // 0 = Standard, 1 = VIP
    status: { type: String, default: 'Preparing', enum: ['Preparing', 'Ready for Pickup', 'Collected'] }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

// ==========================================
// RESTAURANT CORE CONSTANTS & ACCESS CONFIG
// ==========================================
const ADMIN_CREDENTIALS = { username: "admin", password: "pass1120" };
const STAFF_CREDENTIALS = { username: "staff1", password: "flyboy1320" };
let currentAlgorithm = 'sjf'; 

// Structured as an array containing ID properties for smooth loop iteration inside customer UI layouts
const MENU_ITEMS = [
    { id: "combo1", name: "Jollof Rice & Fried Rice with Chicken & Plantain", price: 3500, time: 12 },
    { id: "combo2", name: "White Rice & Beans with Fish & Assorted Meat", price: 3200, time: 15 },
    { id: "combo3", name: "Pounded Yam / Amala with Egusi / Ewedu & Beef", price: 4000, time: 18 },
    { id: "combo4", name: "Spaghetti Deluxe with Turkey & Coleslaw", price: 3800, time: 10 },
    { id: "combo5", name: "Ofada Rice with Ayamase Sauce, Egg & Ponmo", price: 3600, time: 14 },
    { id: "combo6", name: "Eba (Garri) with Native Okro Soup & Fresh Fish", price: 2800, time: 11 },
    { id: "combo7", name: "Coconut Rice with Peppered Gizzard & Plantain Fries", price: 3700, time: 13 },
    { id: "combo8", name: "Yam Porridge (Asaro) with Peppered Fish & Shaki", price: 3000, time: 16 },
    { id: "combo9", name: "Semovita / Wheat with Efo Riro & Assorted Meat", price: 4200, time: 17 },
    { id: "combo10", name: "Gizdodo Special (Gizzard & Plantain Mix) with White Rice", price: 3400, time: 9 },
    { id: "combo11", name: "Beans Porridge (Ewa Agoyin) with Fried Fish & Agege Bread", price: 2500, time: 12 },
    { id: "combo12", name: "Fried Yam, Potato & Akara Combo with Pepper Sauce", price: 2200, time: 8 },
    { id: "combo13", name: "Village Rice (Locust Beans Blend) with Smoked Fish & Egg", price: 3100, time: 10 },
    { id: "combo14", name: "Abula Special (Amala, Gbegiri, Ewedu) with Ogunfe (Goat Meat)", price: 4500, time: 20 }
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

// ==========================================
// SECURITY GATEKEEPER MIDDLEWARES
// ==========================================
function isAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    // Instead of redirecting to the login page, throw a dead error!
    res.status(404).send("Cannot GET /admin");
}

function isStaff(req, res, next) {
    if (req.session && req.session.isStaff) return next();
    // Instead of redirecting to the login page, throw a dead error!
    res.status(404).send("Cannot GET /staff");
}

// =========================================================================
// ANTI-URL GUESSING BLOCKER MATRIX (Intercepts and drops old standard endpoints)
// =========================================================================
app.get('/admin-login', (req, res) => res.status(404).send("Cannot GET /admin-login"));
app.post('/admin-login', (req, res) => res.status(404).send("Cannot POST /admin-login"));

app.get('/staff-login', (req, res) => res.status(404).send("Cannot GET /staff-login"));
app.post('/staff-login', (req, res) => res.status(404).send("Cannot POST /staff-login"));
// ==========================================
// HTTP GATEWAY ROUTES (ENDPOINTS)
// ==========================================

app.get('/', (req, res) => res.redirect('/customer'));

app.get('/customer', async (req, res) => {
    try {
        const activeJobs = await Order.find({ status: 'Preparing' });
        let orderedQueue = currentAlgorithm === 'sjf' ? scheduler.sjf(activeJobs) : scheduler.fifo(activeJobs);
        
        let searchResult = null;
        let searchError = false;
        if (req.query.searchId) {
            searchResult = await Order.findOne({ orderId: req.query.searchId.toUpperCase().trim() });
            if (!searchResult) searchError = true;
        }

        let parsedTicket = null;
        if (req.query.ticket) {
            parsedTicket = JSON.parse(decodeURIComponent(req.query.ticket));
        }

        res.render('customer', {
            menu: MENU_ITEMS,
            jobs: orderedQueue,
            searchQuery: req.query.searchId || '',
            searchResult,
            searchError,
            successMsg: req.query.successMsg || null,
            ticket: parsedTicket
        });
    } catch (err) { res.status(500).send("Customer Interface Render Error"); }
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
    res.redirect('/ogitech-kitchen-gate-2026');// Redirects back to secret gate
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
        console.error(err);
        res.status(500).send("Kitchen Operations Render Error"); 
    }
});

// HISTORICAL LEDGER ROUTE FOR STAFF ARCHIVE
app.get('/staff/archive', isStaff, async (req, res) => {
    try {
        const fullHistory = await Order.find({ status: 'Collected' }).sort({ updatedAt: -1 });
        res.render('archive-view', { role: 'staff', history: fullHistory });
    } catch (err) {
        res.status(500).send("Error compiling staff history matrix log");
    }
});

// ADMIN PORTAL ROUTING GATES (Obfuscated Secret URL)
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
    res.redirect('/ogitech-boardroom-vault-2026');// Redirects back to secret vault
});

app.get('/admin', isAdmin, async (req, res) => {
    try {
        const activeJobs = await Order.find({ status: 'Preparing' });
        const readyToCollect = await Order.find({ status: 'Ready for Pickup' }); 
        const servedHistory = await Order.find({ status: 'Collected' }).sort({ updatedAt: -1 }).limit(10);
        
        const totalDispatchedCount = await Order.countDocuments({ status: 'Collected' });

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
            history: servedHistory
        });
    } catch (err) { res.status(500).send("Admin Core View Render Error"); }
});

// HISTORICAL LEDGER ROUTE FOR ADMIN ARCHIVE
app.get('/admin/archive', isAdmin, async (req, res) => {
    try {
        const fullHistory = await Order.find({ status: 'Collected' }).sort({ updatedAt: -1 });
        res.render('archive-view', { role: 'admin', history: fullHistory });
    } catch (err) {
        res.status(500).send("Error compiling admin audit logs");
    }
});

// ==========================================
// ORDER FORM SUBMISSION HANDLING ENDPOINT
// ==========================================
app.post('/place-order', async (req, res) => {
    const { customerName, foodId, priority, quantity } = req.body;
    const selectedMeal = MENU_ITEMS.find(dish => dish.id === foodId);
    const qty = parseInt(quantity) || 1;
    const orderPriority = parseInt(priority) || 0;

    if (!customerName || !selectedMeal) return res.redirect('/customer');

    const orderId = generateUniqueId();
    let calculatedPrice = selectedMeal.price * qty;
    
    if (orderPriority === 1) {
        calculatedPrice += 500;
    }

    const newJob = new Order({
        orderId: orderId,
        customerName: customerName,
        foodName: selectedMeal.name,
        processingTime: selectedMeal.time, 
        price: selectedMeal.price,
        quantity: qty,
        totalPrice: calculatedPrice, 
        priority: orderPriority, 
        status: 'Preparing'
    });

    try {
        await newJob.save();
        res.redirect(`/customer?successMsg=true&ticket=${encodeURIComponent(JSON.stringify(newJob))}`);
    } catch (err) { 
        console.error("Order Creation Error: ", err);
        res.redirect('/customer'); 
    }
});

app.post('/complete-job/:id', isStaff, async (req, res) => {
    try {
        await Order.findByIdAndUpdate(req.params.id, { status: 'Ready for Pickup' });
        res.redirect('/staff');
    } catch (err) { res.status(500).send("Execution Lifecycle Transition Interrupted"); }
});

app.post('/pickup-job/:id', isStaff, async (req, res) => {
    try {
        await Order.findByIdAndUpdate(req.params.id, { status: 'Collected' });
        res.redirect('/staff');
    } catch (err) { res.status(500).send("Cash Ledger Finalization Error"); }
});

app.post('/change-algo', isAdmin, (req, res) => {
    const targetAlgo = req.body.algorithm;
    if (targetAlgo === 'fifo' || targetAlgo === 'sjf') {
        currentAlgorithm = targetAlgo;
    }
    res.redirect('/admin');
});

// ==========================================
// SYSTEM LISTENER ACTIVATION
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SYSTEM ACTIVE: Server cluster initializing smoothly on Port ${PORT}`));

module.exports = app;