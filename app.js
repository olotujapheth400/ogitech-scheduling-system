require('dotenv').config();
const dns = require('node:dns');

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const session = require('express-session'); 
const axios = require('axios'); 
const nodemailer = require('nodemailer'); 
const bcrypt = require('bcryptjs');
const multer = require('multer');

// CLOUDINARY INTEGRATION LIBRARIES
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static assets setup
app.use(express.static(path.join(__dirname, 'public')));

// =========================================================================
// CLOUDINARY & MULTER CONFIGURATION (PERMANENT STORAGE)
// =========================================================================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'ogitech-express-menu',
        allowed_formats: ['jpeg', 'jpg', 'png', 'gif', 'webp'],
        transformation: [{ width: 800, height: 600, crop: 'limit' }]
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'ogitech_secret_session_key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 3600000,
        secure: process.env.NODE_ENV === 'production'
    }
}));

app.use((req, res, next) => {
    res.locals.formatTime = (dateTimeStr) => {
        if (!dateTimeStr) return "N/A";
        const dt = new Date(dateTimeStr);
        return dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };
    next();
});

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const mailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS 
    }
});

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    heartbeatFrequencyMS: 10000,
    family: 4
})
.then(async () => {
    console.log("CONNECTED: Secured Cloud Pipeline to MongoDB Atlas.");
    await seedDefaultFoods();
})
.catch(err => console.error("CRITICAL ERROR: Failed to connect to Cloud Database:", err));

// =========================================================================
// MONGOOSE SCHEMAS & MODELS
// =========================================================================

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

const foodSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    processingTime: { type: Number, default: 10 },
    category: { type: String, default: 'Main Dish' },
    imageUrl: { type: String, default: '' },
    description: { type: String, default: '' }
}, { timestamps: true });

const Food = mongoose.model('Food', foodSchema);

const subAdminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Staff' }
}, { timestamps: true });

const SubAdmin = mongoose.model('SubAdmin', subAdminSchema);

// =========================================================================
// DEFAULT MENU ITEMS & SEEDER
// =========================================================================

const ADMIN_CREDENTIALS = { username: process.env.ADMIN_USER, password: process.env.ADMIN_PASS };
const STAFF_CREDENTIALS = { username: process.env.STAFF_USER, password: process.env.STAFF_PASS };
let currentAlgorithm = 'sjf'; 

const DEFAULT_MENU_ITEMS = [
    { name: "Jollof Rice & Fried Rice with Chicken & Plantain", price: 3000, processingTime: 10, category: "Main Dish" },
    { name: "White Rice & Beans with Fish & Assorted Meat", price: 2800, processingTime: 10, category: "Main Dish" },
    { name: "Pounded Yam / Amala with Egusi / Ewedu & Beef", price: 3000, processingTime: 10, category: "Main Dish" },
    { name: "Spaghetti Deluxe with Turkey & Coleslaw", price: 2900, processingTime: 10, category: "Main Dish" },
    { name: "Ofada Rice with Ayamase Sauce, Egg & Ponmo", price: 3000, processingTime: 10, category: "Main Dish" },
    { name: "Eba (Garri) with Native Okro Soup & Fresh Fish", price: 2500, processingTime: 10, category: "Main Dish" },
    { name: "Coconut Rice with Peppered Gizzard & Plantain Fries", price: 2800, processingTime: 10, category: "Main Dish" },
    { name: "Yam Porridge (Asaro) with Peppered Fish & Shaki", price: 2700, processingTime: 10, category: "Main Dish" },
    { name: "Semovita / Wheat with Efo Riro & Assorted Meat", price: 3000, processingTime: 10, category: "Main Dish" },
    { name: "Gizdodo Special (Gizzard & Plantain Mix) with White Rice", price: 2600, processingTime: 10, category: "Main Dish" },
    { name: "Beans Porridge (Ewa Agoyin) with Fried Fish & Agege Bread", price: 2200, processingTime: 10, category: "Main Dish" },
    { name: "Fried Yam, Potato & Akara Combo with Pepper Sauce", price: 2000, processingTime: 10, category: "Main Dish" },
    { name: "Village Rice (Locust Beans Blend) with Smoked Fish & Egg", price: 2500, processingTime: 10, category: "Main Dish" },
    { name: "Abula Special (Amala, Gbegiri, Ewedu) with Ogunfe", price: 3000, processingTime: 10, category: "Main Dish" },
    { name: "Crispy Chicken and Chips Platter", price: 2500, processingTime: 10, category: "Snack" },
    { name: "Golden Baked Egg Roll", price: 400, processingTime: 10, category: "Snack" },
    { name: "Gourmet Sliced Cake Slice", price: 600, processingTime: 10, category: "Snack" },
    { name: "Sausage Roll & Meat Pie Pastry Mix", price: 800, processingTime: 10, category: "Snack" }
];

async function seedDefaultFoods() {
    try {
        for (const item of DEFAULT_MENU_ITEMS) {
            const exists = await Food.findOne({ name: item.name });
            if (!exists) {
                await Food.create(item);
            }
        }
        console.log("[SEED] Default menu items seeded successfully.");
    } catch (err) {
        console.error("Error seeding menu:", err);
    }
}

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

    const cleanTicket = targetTicket.toObject ? targetTicket.toObject() : targetTicket;
    let rankPosition = -1;
    let totalWaitMinutes = 0;

    for (let i = 0; i < orderedQueue.length; i++) {
        const job = orderedQueue[i];
        const jobDuration = (job.processingTime || 10) * (job.quantity || 1);
        
        totalWaitMinutes += jobDuration;

        if (job.orderId === cleanTicket.orderId) {
            rankPosition = i + 1;
            break;
        }
    }

    if (rankPosition === -1) {
        rankPosition = orderedQueue.length + 1;
        totalWaitMinutes += (cleanTicket.processingTime || 10) * (cleanTicket.quantity || 1);
    }

    const readyAtTime = new Date();
    readyAtTime.setMinutes(readyAtTime.getMinutes() + totalWaitMinutes); 
    
    const formattedClockTime = readyAtTime.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true
    });

    return {
        ...cleanTicket,
        queuePosition: rankPosition,
        totalWaitTime: totalWaitMinutes, 
        estimatedTime: formattedClockTime,
        engineMode: currentAlgorithm.toUpperCase()
    };
}

function isAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    res.redirect('/ogitech-boardroom-vault-2026');
}

function isStaff(req, res, next) {
    if (req.session && req.session.isStaff) return next();
    res.redirect('/ogitech-kitchen-gate-2026');
}

// =========================================================================
// PUBLIC & CUSTOMER ROUTES
// =========================================================================

app.get('/', async (req, res) => {
    try {
        const totalServed = await Order.countDocuments({ status: 'Collected' });
        res.render('index', { totalMealsServedToday: totalServed });
    } catch (err) {
        console.error("Index Render Error:", err);
        res.render('index', { totalMealsServedToday: 0 });
    }
});

app.get('/order', async (req, res) => {
    try {
        const activeJobs = await Order.find({ status: 'Preparing' }).lean();
        let orderedQueue = currentAlgorithm === 'sjf' ? scheduler.sjf(activeJobs) : scheduler.fifo(activeJobs);
        
        let dbFoods = await Food.find({}).lean();

        let searchResult = null;
        let searchError = false;
        if (req.query.searchId) {
            const rawSearch = await Order.findOne({ orderId: req.query.searchId.toUpperCase().trim() }).lean();
            if (!rawSearch) { searchError = true; } 
            else { searchResult = decorateWithQueueMetrics(rawSearch, orderedQueue); }
        }

        let finalTicket = null;
        if (req.query.ticket) {
            try {
                const rawTicket = JSON.parse(decodeURIComponent(req.query.ticket));
                finalTicket = decorateWithQueueMetrics(rawTicket, orderedQueue);
            } catch (e) {
                console.error("Ticket parsing error:", e);
            }
        }

        res.render('customer', {
            menu: dbFoods,
            jobs: orderedQueue,
            searchQuery: req.query.searchId || '',
            searchResult,
            searchError,
            error: req.query.error || null,
            successMsg: req.query.successMsg || null,
            ticket: finalTicket,
            algo: currentAlgorithm
        });
    } catch (err) { 
        console.error("Customer Interface Render Error:", err);
        res.status(500).send("Customer Interface Render Error"); 
    }
});

app.post('/place-order', async (req, res) => {
    try {
        const { customerName, customerEmail, foodId, priority, quantity } = req.body;
        
        if (!foodId) {
            console.error("Order Failed: Missing foodId in request body");
            return res.redirect('/order?error=missing_food_selection');
        }

        let selectedMeal = null;
        if (mongoose.Types.ObjectId.isValid(foodId)) {
            selectedMeal = await Food.findById(foodId);
        }

        if (!selectedMeal) {
            console.error(`Order Failed: Food ID ${foodId} not found in database`);
            return res.redirect('/order?error=invalid_food_item');
        }

        const qty = parseInt(quantity, 10) || 1;
        const orderPriority = parseInt(priority, 10) || 0;

        if (!customerName || !customerEmail) {
            return res.redirect('/order?error=missing_customer_details');
        }

        const orderId = generateUniqueId();
        let calculatedPrice = selectedMeal.price * qty;
        if (orderPriority === 1) calculatedPrice += 500; 

        const pendingOrder = new Order({
            orderId: orderId,
            customerName: customerName,
            customerEmail: customerEmail,
            foodName: selectedMeal.name,
            processingTime: selectedMeal.processingTime || 10, 
            price: selectedMeal.price,
            quantity: qty,
            totalPrice: calculatedPrice, 
            priority: orderPriority, 
            status: 'Pending Payment'
        });
        await pendingOrder.save();

        const koboAmount = Math.round(calculatedPrice * 100);
        const hostUrl = req.get('host');
        const protocol = req.protocol;

        const paystackPayload = {
            email: customerEmail,
            amount: koboAmount,
            reference: orderId,
            callback_url: `${protocol}://${hostUrl}/payment/callback`
        };

        const response = await axios.post('https://api.paystack.co/transaction/initialize', paystackPayload, {
            headers: { 
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 
                'Content-Type': 'application/json' 
            }
        });

        if (response.data && response.data.status && response.data.data && response.data.data.authorization_url) {
            return res.redirect(response.data.data.authorization_url);
        } else {
            console.error("Paystack API Error Response:", response.data);
            return res.redirect('/order?error=payment_initialization_failed');
        }
    } catch (err) { 
        console.error("Payment initialization error:", err.response ? err.response.data : err.message);
        return res.redirect('/order?error=payment_gateway_error'); 
    }
});

function sendReceiptEmail(orderInstance) {
    const emailLayout = {
        from: '"OGITECH Restaurant" <' + process.env.EMAIL_USER + '>',
        to: orderInstance.customerEmail,
        subject: `Your Smart Food Order Receipt - Token: ${orderInstance.orderId}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; max-width: 600px;">
                <h2 style="color: #E63946;">OGITECH Restaurant Payment Confirmed!</h2>
                <p>Hello <strong>${orderInstance.customerName}</strong>, your order has been verified successfully.</p>
                <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #E63946; margin: 20px 0;">
                    <h3>YOUR PICKUP TOKEN: ${orderInstance.orderId}</h3>
                    <p>Meal preparation max limit: ${orderInstance.processingTime || 10} minutes window.</p>
                </div>
                <p><strong>Order Summary:</strong> ${orderInstance.foodName} (x${orderInstance.quantity})</p>
                <p><strong>Total Paid:</strong> ₦${orderInstance.totalPrice.toLocaleString()}</p>
            </div>`
    };
    mailTransport.sendMail(emailLayout).catch(err => console.error("Email send error:", err));
}

app.get('/payment/callback', async (req, res) => {
    const referenceId = req.query.reference;
    if (!referenceId) return res.redirect('/order?error=missing_reference');

    try {
        const response = await axios.get(`https://api.paystack.co/transaction/verify/${referenceId}`, {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
        });
        if (response.data && response.data.data && response.data.data.status === 'success') {
            const confirmedOrder = await Order.findOneAndUpdate({ orderId: referenceId }, { status: 'Preparing' }, { new: true });
            io.emit('queueUpdate', { message: "Queue dynamic refresh." });
            if (confirmedOrder) sendReceiptEmail(confirmedOrder);
            res.redirect(`/order?successMsg=true&ticket=${encodeURIComponent(JSON.stringify(confirmedOrder))}`);
        } else { 
            res.redirect('/order?error=transaction_declined'); 
        }
    } catch (err) { 
        console.error("Verification error:", err.response ? err.response.data : err.message);
        res.redirect('/order?error=verification_error'); 
    }
});

// =========================================================================
// STAFF PORTAL
// =========================================================================

app.get('/ogitech-kitchen-gate-2026', (req, res) => { 
    res.render('login', { error: req.query.error || null }, (err, html) => {
        if (err) {
            console.error("Login Page Render Error:", err);
            return res.status(500).send("Error rendering login page: " + err.message);
        }
        res.send(html);
    }); 
});

app.post('/ogitech-kitchen-gate-2026', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (username === STAFF_CREDENTIALS.username && password === STAFF_CREDENTIALS.password) {
            req.session.isStaff = true; 
            return res.redirect('/staff');
        }
        
        const subAdminMatch = await SubAdmin.findOne({ username });
        if (subAdminMatch) {
            const passwordMatches = await bcrypt.compare(password, subAdminMatch.password);
            if (passwordMatches) {
                req.session.isStaff = true; 
                return res.redirect('/staff');
            }
        }
        res.redirect('/ogitech-kitchen-gate-2026?error=true');
    } catch (err) {
        console.error("Staff Login Error:", err);
        res.redirect('/ogitech-kitchen-gate-2026?error=true');
    }
});

app.get('/staff-logout', (req, res) => { req.session.isStaff = null; res.redirect('/ogitech-kitchen-gate-2026'); });

app.get('/staff', isStaff, async (req, res) => {
    try {
        const activeJobs = await Order.find({ status: 'Preparing' }).lean();
        const readyToCollect = await Order.find({ status: 'Ready for Pickup' }).lean();
        const servedHistory = await Order.find({ status: 'Collected' }).sort({ updatedAt: -1 }).limit(10).lean();
        const totalDispatchedCount = await Order.countDocuments({ status: 'Collected' });
        const grossRevenue = await Order.aggregate([{ $match: { status: 'Collected' } }, { $group: { _id: null, total: { $sum: "$totalPrice" } } }]);
        const finalSales = grossRevenue.length > 0 ? grossRevenue[0].total : 0;

        let orderedQueue = currentAlgorithm === 'sjf' ? scheduler.sjf(activeJobs) : scheduler.fifo(activeJobs);
        let counterSearchId = req.query.counterSearchId;
        let matchedCounterOrder = null;
        let counterSearchError = false;

        if (counterSearchId) {
            matchedCounterOrder = await Order.findOne({ orderId: counterSearchId.toUpperCase().trim(), status: 'Ready for Pickup' }).lean();
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
            completedCount: totalDispatchedCount,
            activeTab: req.query.tab || (counterSearchId ? 'despatchTool' : 'allView')
        });
    } catch (err) { res.status(500).send("Kitchen Operations Render Error"); }
});

// =========================================================================
// EXECUTIVE ADMIN PORTAL
// =========================================================================

app.get('/ogitech-boardroom-vault-2026', (req, res) => { res.render('admin-login', { error: req.query.error || null }); });

app.post('/ogitech-boardroom-vault-2026', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
            req.session.isAdmin = true; 
            return res.redirect('/admin');
        }

        const subAdminMatch = await SubAdmin.findOne({ username });
        if (subAdminMatch) {
            const passwordMatches = await bcrypt.compare(password, subAdminMatch.password);
            if (passwordMatches) {
                req.session.isAdmin = true; 
                return res.redirect('/admin');
            }
        }
        res.redirect('/ogitech-boardroom-vault-2026?error=true');
    } catch (err) {
        console.error("Admin Login Error:", err);
        res.redirect('/ogitech-boardroom-vault-2026?error=true');
    }
});

app.get('/admin-logout', (req, res) => { req.session.isAdmin = null; res.redirect('/ogitech-boardroom-vault-2026'); });

app.get('/admin', isAdmin, async (req, res) => {
    try {
        const activeJobs = await Order.find({ status: 'Preparing' }).lean();
        const readyToCollect = await Order.find({ status: 'Ready for Pickup' }).lean(); 
        const servedHistory = await Order.find({ status: 'Collected' }).sort({ updatedAt: -1 }).limit(10).lean();
        const totalDispatchedCount = await Order.countDocuments({ status: 'Collected' });
        const unverifiedPool = await Order.find({ status: 'Pending Payment' }).sort({ createdAt: -1 }).lean();
        const revenueAggregation = await Order.aggregate([{ $match: { status: 'Collected' } }, { $group: { _id: null, total: { $sum: "$totalPrice" } } }]);
        const totalRevenue = revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;
        
        const foodsList = await Food.find({}).lean();
        const subAdminsList = await SubAdmin.find({}).lean();

        let scheduledJobs = currentAlgorithm === 'sjf' ? scheduler.sjf(activeJobs) : scheduler.fifo(activeJobs);
        res.render('admin', { 
            jobs: scheduledJobs, 
            algo: currentAlgorithm, 
            pendingPickup: readyToCollect, 
            completedCount: totalDispatchedCount, 
            revenue: totalRevenue, 
            history: servedHistory, 
            unverifiedOrders: unverifiedPool,
            foods: foodsList || [],
            subAdmins: subAdminsList || [],
            activeTab: req.query.tab || 'dashboard'
        });
    } catch (err) { res.status(500).send("Admin Core View Render Error"); }
});

// ADD MEAL WITH CLOUDINARY FILE UPLOAD
app.post('/admin/add-food', isAdmin, upload.single('image'), async (req, res) => {
    try {
        const { name, price, processingTime, category, imageUrl, description } = req.body;
        
        let finalImagePath = imageUrl || '';
        if (req.file) {
            // req.file.path contains the permanent HTTPS Cloudinary URL
            finalImagePath = req.file.path;
        }

        await Food.create({
            name,
            price: Number(price),
            processingTime: Number(processingTime) || 10,
            category: category || 'Main Dish',
            imageUrl: finalImagePath,
            description: description || ''
        });
        console.log(`[MENU] Added new dish with Cloudinary image: ${name}`);
        res.redirect('/admin?tab=meals');
    } catch (err) {
        console.error("Error adding dish:", err);
        res.status(500).send("Administrative Dish Creation Fail");
    }
});

// EDIT MEAL WITH CLOUDINARY FILE UPLOAD
app.post('/admin/edit-food', isAdmin, upload.single('image'), async (req, res) => {
    try {
        const { foodId, name, price, processingTime, category, imageUrl, description } = req.body;
        
        const existingFood = await Food.findById(foodId);
        let finalImagePath = existingFood ? existingFood.imageUrl : '';

        if (req.file) {
            // req.file.path contains the permanent HTTPS Cloudinary URL
            finalImagePath = req.file.path;
        } else if (imageUrl && imageUrl.trim() !== '') {
            finalImagePath = imageUrl;
        }

        await Food.findByIdAndUpdate(foodId, {
            name,
            price: Number(price),
            processingTime: Number(processingTime) || 10,
            category: category || 'Main Dish',
            imageUrl: finalImagePath,
            description: description || ''
        });
        console.log(`[MENU] Updated dish ID: ${foodId} with Cloudinary image`);
        res.redirect('/admin?tab=meals');
    } catch (err) {
        console.error("Error updating dish:", err);
        res.status(500).send("Administrative Dish Edit Fail");
    }
});

app.post('/admin/delete-food', isAdmin, async (req, res) => {
    try {
        const { foodId } = req.body;
        await Food.findByIdAndDelete(foodId);
        console.log(`[MENU] Removed dish ID: ${foodId}`);
        res.redirect('/admin?tab=meals');
    } catch (err) {
        console.error("Error deleting dish:", err);
        res.status(500).send("Administrative Dish Deletion Fail");
    }
});

app.post('/admin/create-admin', isAdmin, async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await SubAdmin.create({ username, password: hashedPassword, role });
        console.log(`[ADMIN] Provisioned sub-admin: ${username}`);
        res.redirect('/admin?tab=staff');
    } catch (err) {
        console.error("Error creating sub-admin:", err);
        res.status(500).send("Sub-Admin Account Creation Fail");
    }
});

app.post('/admin/delete-admin', isAdmin, async (req, res) => {
    try {
        const { adminId } = req.body;
        await SubAdmin.findByIdAndDelete(adminId);
        console.log(`[ADMIN] Deleted sub-admin ID: ${adminId}`);
        res.redirect('/admin?tab=staff');
    } catch (err) {
        console.error("Error deleting sub-admin:", err);
        res.status(500).send("Sub-Admin Account Deletion Fail");
    }
});

app.post('/admin/force-approve', isAdmin, async (req, res) => {
    const targetOrderId = req.body.orderId ? req.body.orderId.toUpperCase().trim() : null;
    if (!targetOrderId) return res.redirect('/admin?tab=unverified');
    try {
        const forcedOrder = await Order.findOneAndUpdate({ orderId: targetOrderId }, { status: 'Preparing' }, { new: true });
        if (forcedOrder) {
            io.emit('queueUpdate', { message: `Order ${targetOrderId} manually verified.` });
            sendReceiptEmail(forcedOrder);
        }
        res.redirect('/admin?tab=unverified');
    } catch (err) { res.status(500).send("Administrative Force-Approval Fail Loop"); }
});

app.post('/admin/delete-order', isAdmin, async (req, res) => {
    const targetOrderId = req.body.orderId ? req.body.orderId.toUpperCase().trim() : null;
    if (!targetOrderId) return res.redirect('/admin?tab=unverified');
    try {
        await Order.deleteOne({ orderId: targetOrderId });
        res.redirect('/admin?tab=unverified');
    } catch (err) { res.status(500).send("Administrative Data Elimination Fail Loop"); }
});

app.post('/change-algo', isAdmin, (req, res) => {
    const targetAlgo = req.body.algorithm;
    if (targetAlgo === 'fifo' || targetAlgo === 'sjf') {
        currentAlgorithm = targetAlgo;
        io.emit('queueUpdate', { message: "Algorithm changed status map." });
    }
    res.redirect('/admin?tab=queue');
});

// =========================================================================
// KITCHEN JOB COMPLETION ROUTES
// =========================================================================

app.post('/complete-job/:id', isStaff, async (req, res) => {
    try {
        await Order.findByIdAndUpdate(req.params.id, { status: 'Ready for Pickup' });
        io.emit('queueUpdate', { message: "Queue update." });
        res.redirect('/staff?tab=activeQueue');
    } catch (err) { res.status(500).send("Execution Lifecycle Transition Interrupted"); }
});

app.post('/pickup-job/:id', isStaff, async (req, res) => {
    try {
        await Order.findByIdAndUpdate(req.params.id, { status: 'Collected' });
        io.emit('queueUpdate', { message: "Counter collection complete." });
        res.redirect('/staff?tab=counterPickup');
    } catch (err) { res.status(500).send("Cash Ledger Finalization Error"); }
});

// =========================================================================
// ARCHIVE, LEDGER, & AUDIT VIEW ROUTES
// =========================================================================

app.get('/staff/ledger', isStaff, async (req, res) => {
    try {
        const fullServedHistory = await Order.find({ status: 'Collected' }).sort({ updatedAt: -1 }).lean();
        res.render('archive-view', { history: fullServedHistory, role: 'staff' });
    } catch (err) { 
        res.status(500).send("Ledger Full History View Render Error"); 
    }
});

app.get('/staff/archive', isStaff, async (req, res) => {
    try {
        const fullServedHistory = await Order.find({ status: 'Collected' }).sort({ updatedAt: -1 }).lean();
        res.render('archive-view', { history: fullServedHistory, role: 'staff' });
    } catch (err) { 
        res.status(500).send("Ledger Archive View Render Error"); 
    }
});

app.get('/admin/audit-logs', isAdmin, async (req, res) => {
    try {
        const fullAuditLogs = await Order.find({}).sort({ createdAt: -1 }).lean();
        res.render('archive-view', { history: fullAuditLogs, role: 'admin' });
    } catch (err) { 
        res.status(500).send("Admin Full Audit Logs Render Error"); 
    }
});

app.get('/admin/archive', isAdmin, async (req, res) => {
    try {
        const fullServedHistory = await Order.find({ status: 'Collected' }).sort({ updatedAt: -1 }).lean();
        res.render('archive-view', { history: fullServedHistory, role: 'admin' });
    } catch (err) { 
        res.status(500).send("Administrative Audit Logs Render Error"); 
    }
});

// =========================================================================

io.on('connection', (socket) => {
    console.log("WEBSOCKET STREAM TUNNEL SYNCED.");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SYSTEM ACTIVE on Port ${PORT}`));

module.exports = app;