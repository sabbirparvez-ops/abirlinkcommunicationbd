import express from "express";
import cors from "cors";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import pool from "../src/lib/mysql";

const app = express();

const DB_FILE = path.join(process.cwd(), "db.json");
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// Fallback Data Store (if MySQL fails)
let fallbackData: any = { 
  users: [], 
  income: [], 
  expenses: [], 
  requisitions: [], 
  notifications: [], 
  stock_items: [],
  purchases: [],
  due_payments: [],
  stock_out: [],
  settings: { 
    companyName: "Abirlink ERP", 
    balances: { cash: 0, bkash: 0, nagad: 0, dbbl: 0 },
    logo: null
  } 
};
let useFallback = false;

async function loadFallback() {
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    fallbackData = JSON.parse(data);
    console.log("Loaded fallback data from db.json");
  } catch (error) {
    console.log("No db.json found, using empty fallback state.");
  }
  
  // Ensure default admin exists in fallback
  if (fallbackData.users.length === 0) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    fallbackData.users.push({
      id: 1,
      username: "admin",
      password: hashedPassword,
      role: "Admin",
      name: "System Admin",
      photo: null,
      created_at: new Date()
    });
    await saveFallback();
  }
}

async function saveFallback() {
  try {
    await fs.writeFile(DB_FILE, JSON.stringify(fallbackData, null, 2));
  } catch (error) {
    console.error("Failed to save fallback data:", error);
  }
}

app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://erp.abirlinkcommunicationbd.com",
    "http://erp.abirlinkcommunicationbd.com"
  ],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// SQLite Database Initialization
async function initializeDB() {
  console.log("Initializing SQLite database...");
  
  try {
    // Test connection
    await pool.query("SELECT 1");
    console.log("SQLite connection established.");
    useFallback = false;

    // Create Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'User',
        name TEXT NOT NULL,
        photo TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      )
    `);

    // Create Income Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS income (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        category TEXT NOT NULL,
        source TEXT NOT NULL,
        description TEXT,
        date DATETIME DEFAULT (datetime('now','localtime')),
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      )
    `);

    // Create Expenses Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT,
        source TEXT NOT NULL,
        description TEXT,
        attachment TEXT,
        date DATETIME DEFAULT (datetime('now','localtime')),
        status TEXT DEFAULT 'Pending',
        managerNote TEXT,
        deductedAmount DECIMAL(15,2) DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      )
    `);

    // Create Notifications Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        date DATETIME DEFAULT (datetime('now','localtime')),
        is_read BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      )
    `);

    // Create Settings Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        companyName TEXT DEFAULT 'Abirlink ERP',
        logo TEXT DEFAULT NULL,
        balances TEXT
      )
    `);

    // Create Requisitions Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS requisitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        title TEXT NOT NULL,
        items TEXT NOT NULL,
        totalAmount DECIMAL(15,2) NOT NULL,
        reason TEXT,
        date DATETIME DEFAULT (datetime('now','localtime')),
        status TEXT DEFAULT 'Pending',
        adminNote TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      )
    `);

    // Create Stock Items Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        quantity DECIMAL(15,2) DEFAULT 0,
        unit TEXT DEFAULT 'pcs',
        last_purchase_price DECIMAL(15,2) DEFAULT 0,
        min_stock_level DECIMAL(15,2) DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      )
    `);

    // Create Purchases Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itemId INTEGER NOT NULL,
        quantity DECIMAL(15,2) NOT NULL,
        pricePerUnit DECIMAL(15,2) NOT NULL,
        totalAmount DECIMAL(15,2) NOT NULL,
        paidAmount DECIMAL(15,2) DEFAULT 0,
        dueAmount DECIMAL(15,2) DEFAULT 0,
        supplier TEXT,
        source TEXT NOT NULL,
        date DATETIME DEFAULT (datetime('now','localtime')),
        userId INTEGER NOT NULL,
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      )
    `);

    // Create Due Payments Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS due_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchaseId INTEGER NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        source TEXT NOT NULL,
        date DATETIME DEFAULT (datetime('now','localtime')),
        userId INTEGER NOT NULL,
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      )
    `);

    // Create Stock Out Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_out (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itemId INTEGER NOT NULL,
        quantity DECIMAL(15,2) NOT NULL,
        destination TEXT NOT NULL,
        date DATETIME DEFAULT (datetime('now','localtime')),
        userId INTEGER NOT NULL,
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      )
    `);

    // Check if default admin exists
    const [users]: any = await pool.query("SELECT * FROM users WHERE username = 'admin'");
    if (users.length === 0) {
      console.log("Creating default admin in SQLite...");
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await pool.query(
        "INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)",
        ["admin", hashedPassword, "Admin", "System Admin"]
      );
    }

    // Check if default settings exist
    const [settings]: any = await pool.query("SELECT * FROM settings");
    if (settings.length === 0) {
      console.log("Creating default settings in SQLite...");
      const defaultBalances = JSON.stringify({ cash: 0, bkash: 0, nagad: 0, dbbl: 0 });
      await pool.query(
        "INSERT INTO settings (companyName, balances) VALUES (?, ?)",
        ["Abirlink ERP", defaultBalances]
      );
    }

    console.log("SQLite initialization complete.");
  } catch (error) {
    console.error("SQLite initialization failed:", error);
    console.error("Switching to Offline Mode (JSON Fallback).");
    useFallback = true;
    await loadFallback();
  }
}
initializeDB();

// Ensure uploads directory exists
async function ensureUploadsDir() {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
  }
}
ensureUploadsDir();

// Notification Helper
async function addNotification(userId: number, title: string, message: string, type: "info" | "success" | "warning" = "info") {
  try {
    if (useFallback) {
      fallbackData.notifications.unshift({
        id: Date.now(),
        userId,
        title,
        message,
        type,
        date: new Date(),
        is_read: false
      });
      await saveFallback();
    } else {
      await pool.query(
        "INSERT INTO notifications (userId, title, message, type, date, is_read) VALUES (?, ?, ?, ?, ?, ?)",
        [userId, title, message, type, new Date(), false]
      );
    }
  } catch (error) {
    console.error("Failed to add notification:", error);
  }
}

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// API Routes
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    let user;
    if (useFallback) {
      user = fallbackData.users.find((u: any) => u.username === username);
    } else {
      const [users]: any = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
      user = users[0];
    }
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
    res.json({ 
      token, 
      user: { id: user.id, username: user.username, role: user.role, name: user.name, photo: user.photo } 
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/api/users", authenticate, async (req: any, res) => {
  if (req.user.role !== "Admin") return res.status(403).json({ error: "Forbidden" });
  try {
    if (useFallback) {
      const users = fallbackData.users.map(({ password, ...u }: any) => u);
      return res.json(users);
    }
    const [users]: any = await pool.query("SELECT id, username, role, name, photo, created_at FROM users");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.post("/api/users", authenticate, async (req: any, res) => {
  if (req.user.role !== "Admin") return res.status(403).json({ error: "Forbidden" });
  try {
    const { username, password, role, name, photo } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    if (useFallback) {
      const newUser = { id: Date.now(), username, password: hashedPassword, role, name, photo, created_at: new Date() };
      fallbackData.users.push(newUser);
      await saveFallback();
      const { password: _, ...userWithoutPassword } = newUser;
      return res.json(userWithoutPassword);
    }
    
    const [result]: any = await pool.query(
      "INSERT INTO users (username, password, role, name, photo) VALUES (?, ?, ?, ?, ?)",
      [username, hashedPassword, role, name, photo]
    );
    res.json({ id: result.insertId, username, role, name, photo });
  } catch (error) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

app.put("/api/users/:id", authenticate, async (req: any, res) => {
  if (req.user.role !== "Admin") return res.status(403).json({ error: "Forbidden" });
  try {
    const { username, password, role, name, photo } = req.body;
    const id = parseInt(req.params.id);
    
    if (useFallback) {
      const index = fallbackData.users.findIndex((u: any) => u.id === id);
      if (index === -1) return res.status(404).json({ error: "User not found" });
      
      fallbackData.users[index] = { ...fallbackData.users[index], username, role, name, photo };
      if (password) {
        fallbackData.users[index].password = await bcrypt.hash(password, 10);
      }
      await saveFallback();
      return res.json({ id, username, role, name, photo });
    }
    
    let query = "UPDATE users SET username = ?, role = ?, name = ?, photo = ? WHERE id = ?";
    let params = [username, role, name, photo, req.params.id];
    
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = "UPDATE users SET username = ?, password = ?, role = ?, name = ?, photo = ? WHERE id = ?";
      params = [username, hashedPassword, role, name, photo, req.params.id];
    }
    
    await pool.query(query, params);
    res.json({ id: req.params.id, username, role, name, photo });
  } catch (error) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

app.delete("/api/users/:id", authenticate, async (req: any, res) => {
  if (req.user.role !== "Admin") return res.status(403).json({ error: "Forbidden" });
  try {
    const id = parseInt(req.params.id);
    if (useFallback) {
      fallbackData.users = fallbackData.users.filter((u: any) => u.id !== id);
      await saveFallback();
      return res.json({ success: true });
    }
    await pool.query("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

app.get("/api/income", authenticate, async (req: any, res) => {
  try {
    if (useFallback) {
      let income = fallbackData.income;
      if (req.user.role !== "Admin" && req.user.role !== "Manager") {
        income = income.filter((i: any) => i.userId === req.user.id);
      }
      return res.json(income);
    }
    let query = "SELECT * FROM income";
    let params: any[] = [];
    if (req.user.role !== "Admin" && req.user.role !== "Manager") {
      query = "SELECT * FROM income WHERE userId = ?";
      params = [req.user.id];
    }
    const [income]: any = await pool.query(query, params);
    res.json(income);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch income" });
  }
});

app.post("/api/income", authenticate, async (req: any, res) => {
  try {
    const { amount, source, category, note, date } = req.body;
    const incomeDate = date ? new Date(date) : new Date();
    const description = note || "";
    
    if (useFallback) {
      const newIncome = { id: Date.now(), userId: req.user.id, amount, source, category, description, date: incomeDate };
      fallbackData.income.push(newIncome);
      await saveFallback();
      
      // Notify Admins and Managers
      const adminsAndManagers = fallbackData.users.filter((u: any) => u.role === "Admin" || u.role === "Manager");
      for (const user of adminsAndManagers) {
        await addNotification(user.id, "New Income Added", `${req.user.username} added ${amount} to ${source}`, "success");
      }
      return res.json(newIncome);
    }
    
    const [result]: any = await pool.query(
      "INSERT INTO income (userId, amount, category, source, description, date) VALUES (?, ?, ?, ?, ?, ?)",
      [req.user.id, amount, category, source, description, incomeDate]
    );
    
    // Notify Admins and Managers
    const [adminsAndManagers]: any = await pool.query("SELECT id FROM users WHERE role IN ('Admin', 'Manager')");
    for (const user of adminsAndManagers) {
      await addNotification(user.id, "New Income Added", `${req.user.username} added ${amount} to ${source}`, "success");
    }

    res.json({ id: result.insertId, userId: req.user.id, amount, category, source, description, date: incomeDate });
  } catch (error) {
    console.error("Failed to add income:", error);
    res.status(500).json({ error: "Failed to add income" });
  }
});

app.get("/api/expenses", authenticate, async (req: any, res) => {
  try {
    if (useFallback) {
      let expenses = fallbackData.expenses;
      if (req.user.role !== "Admin" && req.user.role !== "Manager") {
        expenses = expenses.filter((e: any) => e.userId === req.user.id);
      }
      return res.json(expenses);
    }
    let query = "SELECT * FROM expenses";
    let params: any[] = [];
    if (req.user.role !== "Admin" && req.user.role !== "Manager") {
      query = "SELECT * FROM expenses WHERE userId = ?";
      params = [req.user.id];
    }
    const [expenses]: any = await pool.query(query, params);
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

app.post("/api/expenses", authenticate, async (req: any, res) => {
  try {
    const { amount, source, category, subcategory, note, attachment, date } = req.body;
    const expenseDate = date ? new Date(date) : new Date();
    const description = note || "";
    
    if (useFallback) {
      const newExpense = { 
        id: Date.now(), 
        userId: req.user.id, 
        amount, 
        source, 
        category, 
        subcategory, 
        description, 
        attachment, 
        date: expenseDate, 
        status: "Pending", 
        managerNote: "", 
        deductedAmount: 0 
      };
      fallbackData.expenses.push(newExpense);
      await saveFallback();
      
      // Notify Managers
      const managers = fallbackData.users.filter((u: any) => u.role === "Admin" || u.role === "Manager");
      for (const user of managers) {
        await addNotification(user.id, "New Expense Pending", `${req.user.username} submitted an expense of ${amount}`, "warning");
      }
      return res.json(newExpense);
    }
    
    const [result]: any = await pool.query(
      "INSERT INTO expenses (userId, amount, category, subcategory, source, description, attachment, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')",
      [req.user.id, amount, category, subcategory, source, description, attachment, expenseDate]
    );

    // Notify Managers
    const [managers]: any = await pool.query("SELECT id FROM users WHERE role IN ('Admin', 'Manager')");
    for (const user of managers) {
      await addNotification(user.id, "New Expense Pending", `${req.user.username} submitted an expense of ${amount}`, "warning");
    }

    res.json({ 
      id: result.insertId, 
      userId: req.user.id, 
      amount, 
      category, 
      subcategory, 
      source, 
      description, 
      attachment, 
      date: expenseDate, 
      status: "Pending" 
    });
  } catch (error) {
    console.error("Failed to add expense:", error);
    res.status(500).json({ error: "Failed to add expense" });
  }
});

app.put("/api/expenses/:id/verify", authenticate, async (req: any, res) => {
  if (req.user.role !== "Manager" && req.user.role !== "Admin") return res.status(403).json({ error: "Forbidden" });
  try {
    const { note, deductedAmount } = req.body;
    const id = parseInt(req.params.id);
    
    if (useFallback) {
      const index = fallbackData.expenses.findIndex((e: any) => e.id === id);
      if (index === -1) return res.status(404).json({ error: "Expense not found" });
      
      fallbackData.expenses[index].status = "Verified";
      fallbackData.expenses[index].managerNote = note;
      fallbackData.expenses[index].deductedAmount = deductedAmount || 0;
      await saveFallback();
      
      const expense = fallbackData.expenses[index];
      // Notify Admins
      const admins = fallbackData.users.filter((u: any) => u.role === "Admin");
      for (const user of admins) {
        await addNotification(user.id, "Expense Verified", `An expense of ${expense.amount} has been verified.`, "info");
      }
      // Notify Submitter
      await addNotification(expense.userId, "Expense Verified", `Your expense of ${expense.amount} has been verified.`, "success");
      return res.json(expense);
    }
    
    await pool.query(
      "UPDATE expenses SET status = 'Verified', managerNote = ?, deductedAmount = ? WHERE id = ?",
      [note, deductedAmount || 0, req.params.id]
    );
    
    const [expenses]: any = await pool.query("SELECT * FROM expenses WHERE id = ?", [req.params.id]);
    const expense = expenses[0];

    // Notify Admins
    const [admins]: any = await pool.query("SELECT id FROM users WHERE role = 'Admin'");
    for (const user of admins) {
      await addNotification(user.id, "Expense Verified", `An expense of ${expense.amount} has been verified.`, "info");
    }

    // Notify Submitter
    await addNotification(expense.userId, "Expense Verified", `Your expense of ${expense.amount} has been verified.`, "success");

    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: "Failed to verify expense" });
  }
});

app.put("/api/expenses/:id/approve", authenticate, async (req: any, res) => {
  if (req.user.role !== "Admin") return res.status(403).json({ error: "Forbidden" });
  try {
    const { deductedAmount } = req.body;
    const id = parseInt(req.params.id);
    
    if (useFallback) {
      const index = fallbackData.expenses.findIndex((e: any) => e.id === id);
      if (index === -1) return res.status(404).json({ error: "Expense not found" });
      
      fallbackData.expenses[index].status = "Approved";
      if (deductedAmount !== undefined) {
        fallbackData.expenses[index].deductedAmount = deductedAmount;
      }
      await saveFallback();
      
      const expense = fallbackData.expenses[index];
      // Notify Submitter
      await addNotification(expense.userId, "Expense Approved", `Your expense of ${expense.amount} has been approved.`, "success");
      return res.json(expense);
    }
    
    if (deductedAmount !== undefined) {
      await pool.query("UPDATE expenses SET status = 'Approved', deductedAmount = ? WHERE id = ?", [deductedAmount, req.params.id]);
    } else {
      await pool.query("UPDATE expenses SET status = 'Approved' WHERE id = ?", [req.params.id]);
    }
    
    const [expenses]: any = await pool.query("SELECT * FROM expenses WHERE id = ?", [req.params.id]);
    const expense = expenses[0];

    // Notify Submitter
    await addNotification(expense.userId, "Expense Approved", `Your expense of ${expense.amount} has been approved.`, "success");

    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: "Failed to approve expense" });
  }
});

app.post("/api/upload", authenticate, async (req: any, res) => {
  if (req.user.role !== "Admin") return res.status(403).json({ error: "Forbidden" });
  const { image, filename } = req.body;
  if (!image) return res.status(400).json({ error: "No image provided" });

  const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const ext = image.match(/^data:image\/(\w+);base64,/)[1];
  const name = `${Date.now()}-${filename || "logo"}.${ext}`;
  const filePath = path.join(process.cwd(), "uploads", name);

  try {
    await fs.writeFile(filePath, buffer);
    res.json({ url: `/uploads/${name}` });
  } catch (error) {
    console.error("Upload failed:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Public settings for Login page
app.get("/api/public/settings", async (req, res) => {
  try {
    const [settings]: any = await pool.query("SELECT companyName, logo FROM settings LIMIT 1");
    res.json(settings[0] || { companyName: "Abirlink ERP", logo: null });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch public settings" });
  }
});

// Public upload for Admin branding (requires admin credentials)
app.post("/api/public/upload-logo", async (req, res) => {
  const { username, password, image, filename } = req.body;
  try {
    const [users]: any = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
    const user = users[0];
    
    if (!user || user.role !== "Admin" || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid admin credentials" });
    }

    if (!image) return res.status(400).json({ error: "No image provided" });

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const ext = image.match(/^data:image\/(\w+);base64,/)[1];
    const name = `${Date.now()}-${filename || "logo"}.${ext}`;
    const filePath = path.join(process.cwd(), "uploads", name);

    await fs.writeFile(filePath, buffer);
    const url = `/uploads/${name}`;
    
    await pool.query("UPDATE settings SET logo = ? LIMIT 1", [url]);
    res.json({ url });
  } catch (error) {
    console.error("Upload failed:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.get("/api/settings", authenticate, async (req, res) => {
  try {
    if (useFallback) {
      return res.json(fallbackData.settings);
    }
    const [settings]: any = await pool.query("SELECT * FROM settings LIMIT 1");
    const setting = settings[0];
    if (setting && setting.balances) {
      setting.balances = JSON.parse(setting.balances);
    }
    res.json(setting);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

app.put("/api/settings", authenticate, async (req: any, res) => {
  if (req.user.role !== "Admin") return res.status(403).json({ error: "Forbidden" });
  try {
    const { companyName, logo, balances } = req.body;
    
    if (useFallback) {
      fallbackData.settings = { companyName, logo, balances };
      await saveFallback();
      return res.json(fallbackData.settings);
    }
    
    const balancesStr = JSON.stringify(balances);
    await pool.query(
      "UPDATE settings SET companyName = ?, logo = ?, balances = ? LIMIT 1",
      [companyName, logo, balancesStr]
    );
    res.json({ companyName, logo, balances });
  } catch (error) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

app.post("/api/admin/reset", authenticate, async (req: any, res) => {
  if (req.user.role !== "Admin") return res.status(403).json({ error: "Forbidden" });
  try {
    if (useFallback) {
      fallbackData.income = [];
      fallbackData.expenses = [];
      fallbackData.notifications = [];
      fallbackData.requisitions = [];
      fallbackData.stock_items = [];
      fallbackData.purchases = [];
      fallbackData.due_payments = [];
      fallbackData.stock_out = [];
      fallbackData.users = fallbackData.users.filter((u: any) => u.username === "admin");
      fallbackData.settings = { 
        companyName: "Abirlink ERP", 
        balances: { cash: 0, bkash: 0, nagad: 0, dbbl: 0 },
        logo: null
      };
      await saveFallback();
      return res.json({ success: true });
    }
    
    // SQLite Reset
    await pool.query("DELETE FROM income");
    await pool.query("DELETE FROM expenses");
    await pool.query("DELETE FROM notifications");
    await pool.query("DELETE FROM requisitions");
    await pool.query("DELETE FROM stock_items");
    await pool.query("DELETE FROM purchases");
    await pool.query("DELETE FROM due_payments");
    await pool.query("DELETE FROM stock_out");
    await pool.query("DELETE FROM users WHERE username != 'admin'");
    
    // Reset settings to default
    const defaultBalances = JSON.stringify({ cash: 0, bkash: 0, nagad: 0, dbbl: 0 });
    await pool.query("UPDATE settings SET companyName = ?, logo = ?, balances = ?", ["Abirlink ERP", null, defaultBalances]);
    
    // Clear uploads directory
    try {
      const uploadsDir = path.join(process.cwd(), "uploads");
      const files = await fs.readdir(uploadsDir);
      for (const file of files) {
        if (file !== ".gitkeep") { // Keep .gitkeep if it exists
          await fs.unlink(path.join(uploadsDir, file));
        }
      }
    } catch (err) {
      console.error("Failed to clear uploads:", err);
      // Don't fail the whole reset if uploads fail to clear
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Reset error:", error);
    res.status(500).json({ error: "Failed to reset data" });
  }
});

app.get("/api/notifications", authenticate, async (req: any, res) => {
  try {
    if (useFallback) {
      const notifications = fallbackData.notifications.filter((n: any) => n.userId === req.user.id);
      return res.json(notifications);
    }
    const [notifications]: any = await pool.query(
      "SELECT * FROM notifications WHERE userId = ? ORDER BY date DESC",
      [req.user.id]
    );
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

app.put("/api/notifications/read-all", authenticate, async (req: any, res) => {
  try {
    if (useFallback) {
      fallbackData.notifications.forEach((n: any) => {
        if (n.userId === req.user.id) n.is_read = true;
      });
      await saveFallback();
      return res.json({ success: true });
    }
    await pool.query("UPDATE notifications SET is_read = TRUE WHERE userId = ?", [req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
});

// Stock Management Endpoints
app.get("/api/stock", authenticate, async (req, res) => {
  try {
    const [stock]: any = await pool.query("SELECT * FROM stock_items ORDER BY name ASC");
    res.json(stock);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stock" });
  }
});

app.post("/api/stock", authenticate, async (req: any, res) => {
  if (req.user.role !== "Admin" && req.user.role !== "Manager") return res.status(403).json({ error: "Forbidden" });
  try {
    const { name, description, unit, min_stock_level } = req.body;
    const [result]: any = await pool.query(
      "INSERT INTO stock_items (name, description, unit, min_stock_level) VALUES (?, ?, ?, ?)",
      [name, description, unit, min_stock_level || 0]
    );
    res.json({ id: result.insertId, name, description, unit, min_stock_level, quantity: 0, last_purchase_price: 0 });
  } catch (error) {
    res.status(500).json({ error: "Failed to add stock item" });
  }
});

app.put("/api/stock/:id", authenticate, async (req: any, res) => {
  if (req.user.role !== "Admin" && req.user.role !== "Manager") return res.status(403).json({ error: "Forbidden" });
  try {
    const { name, description, unit, min_stock_level } = req.body;
    await pool.query(
      "UPDATE stock_items SET name = ?, description = ?, unit = ?, min_stock_level = ? WHERE id = ?",
      [name, description, unit, min_stock_level, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update stock item" });
  }
});

// Purchase Endpoints
app.get("/api/purchases", authenticate, async (req, res) => {
  try {
    const [purchases]: any = await pool.query(`
      SELECT p.*, s.name as itemName, u.name as userName 
      FROM purchases p 
      JOIN stock_items s ON p.itemId = s.id 
      JOIN users u ON p.userId = u.id 
      ORDER BY p.date DESC
    `);
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch purchases" });
  }
});

app.post("/api/purchases", authenticate, async (req: any, res) => {
  try {
    const { itemId, quantity, pricePerUnit, supplier, source, date, paidAmount } = req.body;
    const totalAmount = quantity * pricePerUnit;
    const purchaseDate = date ? new Date(date) : new Date();
    const paid = Number(paidAmount || 0);
    const due = totalAmount - paid;

    // 1. Record Purchase
    const [result]: any = await pool.query(
      "INSERT INTO purchases (itemId, quantity, pricePerUnit, totalAmount, paidAmount, dueAmount, supplier, source, date, userId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [itemId, quantity, pricePerUnit, totalAmount, paid, due, supplier, source, purchaseDate, req.user.id]
    );

    const purchaseId = result.insertId;

    // 2. Update Stock
    await pool.query(
      "UPDATE stock_items SET quantity = quantity + ?, last_purchase_price = ? WHERE id = ?",
      [quantity, pricePerUnit, itemId]
    );

    // 3. Adjust Balance (Add as Approved Expense for the paid amount)
    if (paid > 0) {
      const [item]: any = await pool.query("SELECT name FROM stock_items WHERE id = ?", [itemId]);
      const itemName = item[0]?.name || "Stock Item";
      
      await pool.query(
        "INSERT INTO expenses (userId, amount, category, subcategory, source, description, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'Approved')",
        [req.user.id, paid, "Stock Purchase", itemName, source, `Purchase of ${quantity} ${itemName} from ${supplier || 'Unknown'} (Paid: ${paid})`, purchaseDate]
      );
    }

    res.json({ id: purchaseId, success: true });
  } catch (error) {
    console.error("Purchase error:", error);
    res.status(500).json({ error: "Failed to record purchase" });
  }
});

// Due Purchase Endpoints
app.get("/api/due-purchases", authenticate, async (req, res) => {
  try {
    const [dues]: any = await pool.query(`
      SELECT p.*, s.name as itemName, u.name as userName 
      FROM purchases p 
      JOIN stock_items s ON p.itemId = s.id 
      JOIN users u ON p.userId = u.id 
      WHERE p.dueAmount > 0
      ORDER BY p.date DESC
    `);
    res.json(dues);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch due purchases" });
  }
});

app.post("/api/due-payments", authenticate, async (req: any, res) => {
  try {
    const { purchaseId, amount, source, date } = req.body;
    const paymentDate = date ? new Date(date) : new Date();
    const payAmount = Number(amount);

    // 1. Get purchase details
    const [purchases]: any = await pool.query("SELECT * FROM purchases WHERE id = ?", [purchaseId]);
    if (purchases.length === 0) return res.status(404).json({ error: "Purchase not found" });
    
    const purchase = purchases[0];
    if (payAmount > purchase.dueAmount) {
      return res.status(400).json({ error: "Payment amount exceeds due amount" });
    }

    // 2. Record Payment
    await pool.query(
      "INSERT INTO due_payments (purchaseId, amount, source, date, userId) VALUES (?, ?, ?, ?, ?)",
      [purchaseId, payAmount, source, paymentDate, req.user.id]
    );

    // 3. Update Purchase
    await pool.query(
      "UPDATE purchases SET paidAmount = paidAmount + ?, dueAmount = dueAmount - ? WHERE id = ?",
      [payAmount, payAmount, purchaseId]
    );

    // 4. Create Expense
    await pool.query(
      "INSERT INTO expenses (userId, amount, category, subcategory, source, description, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'Approved')",
      [req.user.id, payAmount, "Due Payment", "Inventory", source, `Due Payment for Purchase ID: ${purchaseId}`, paymentDate]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Due payment error:", error);
    res.status(500).json({ error: "Failed to record due payment" });
  }
});

// Stock Out Endpoints
app.get("/api/stock-out", authenticate, async (req, res) => {
  try {
    const [stockOut]: any = await pool.query(`
      SELECT so.*, s.name as itemName, u.name as userName 
      FROM stock_out so 
      JOIN stock_items s ON so.itemId = s.id 
      JOIN users u ON so.userId = u.id 
      ORDER BY so.date DESC
    `);
    res.json(stockOut);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stock out history" });
  }
});

app.post("/api/stock-out", authenticate, async (req: any, res) => {
  try {
    const { itemId, quantity, destination, date } = req.body;
    const stockOutDate = date ? new Date(date) : new Date();

    // 1. Check stock availability
    const [stock]: any = await pool.query("SELECT quantity, name FROM stock_items WHERE id = ?", [itemId]);
    if (stock.length === 0) return res.status(404).json({ error: "Item not found" });
    
    if (stock[0].quantity < quantity) {
      return res.status(400).json({ error: `Insufficient stock. Available: ${stock[0].quantity}` });
    }

    // 2. Record Stock Out
    const [result]: any = await pool.query(
      "INSERT INTO stock_out (itemId, quantity, destination, date, userId) VALUES (?, ?, ?, ?, ?)",
      [itemId, quantity, destination, stockOutDate, req.user.id]
    );

    // 3. Update Stock
    await pool.query(
      "UPDATE stock_items SET quantity = quantity - ? WHERE id = ?",
      [quantity, itemId]
    );

    res.json({ id: result.insertId, success: true });
  } catch (error) {
    console.error("Stock out error:", error);
    res.status(500).json({ error: "Failed to record stock out" });
  }
});

app.put("/api/notifications/:id/read", authenticate, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    if (useFallback) {
      const index = fallbackData.notifications.findIndex((n: any) => n.id === id && n.userId === req.user.id);
      if (index !== -1) {
        fallbackData.notifications[index].is_read = true;
        await saveFallback();
      }
      return res.json({ success: true });
    }
    await pool.query("UPDATE notifications SET is_read = TRUE WHERE id = ? AND userId = ?", [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

// Requisition Routes
app.get("/api/requisitions", authenticate, async (req: any, res) => {
  try {
    if (useFallback) {
      let requisitions = fallbackData.requisitions;
      if (req.user.role !== "Admin" && req.user.role !== "Manager") {
        requisitions = requisitions.filter((r: any) => r.userId === req.user.id);
      }
      return res.json(requisitions);
    }
    let query = "SELECT r.*, u.name as userName FROM requisitions r JOIN users u ON r.userId = u.id";
    let params: any[] = [];
    if (req.user.role !== "Admin" && req.user.role !== "Manager") {
      query = "SELECT r.*, u.name as userName FROM requisitions r JOIN users u ON r.userId = u.id WHERE r.userId = ?";
      params = [req.user.id];
    }
    const [requisitions]: any = await pool.query(query, params);
    res.json(requisitions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch requisitions" });
  }
});

app.post("/api/requisitions", authenticate, async (req: any, res) => {
  try {
    const { title, items, totalAmount, reason } = req.body;
    const itemsStr = JSON.stringify(items);
    
    if (useFallback) {
      const newReq = { 
        id: Date.now(), 
        userId: req.user.id, 
        title, 
        items: itemsStr, 
        totalAmount, 
        reason, 
        date: new Date(), 
        status: "Pending",
        adminNote: ""
      };
      fallbackData.requisitions.push(newReq);
      await saveFallback();
      
      // Notify Admins
      const admins = fallbackData.users.filter((u: any) => u.role === "Admin" || u.role === "Manager");
      for (const user of admins) {
        await addNotification(user.id, "New Requisition", `${req.user.username} submitted a requisition for ${title}`, "info");
      }
      return res.json(newReq);
    }
    
    const [result]: any = await pool.query(
      "INSERT INTO requisitions (userId, title, items, totalAmount, reason, status) VALUES (?, ?, ?, ?, ?, 'Pending')",
      [req.user.id, title, itemsStr, totalAmount, reason]
    );
    
    // Notify Admins
    const [admins]: any = await pool.query("SELECT id FROM users WHERE role IN ('Admin', 'Manager')");
    for (const user of admins) {
      await addNotification(user.id, "New Requisition", `${req.user.username} submitted a requisition for ${title}`, "info");
    }

    res.json({ id: result.insertId, userId: req.user.id, title, items: itemsStr, totalAmount, reason, status: "Pending" });
  } catch (error) {
    res.status(500).json({ error: "Failed to add requisition" });
  }
});

app.put("/api/requisitions/:id/status", authenticate, async (req: any, res) => {
  if (req.user.role !== "Admin" && req.user.role !== "Manager") return res.status(403).json({ error: "Forbidden" });
  try {
    const { status, adminNote } = req.body;
    const id = parseInt(req.params.id);
    
    if (useFallback) {
      const index = fallbackData.requisitions.findIndex((r: any) => r.id === id);
      if (index === -1) return res.status(404).json({ error: "Requisition not found" });
      
      fallbackData.requisitions[index].status = status;
      fallbackData.requisitions[index].adminNote = adminNote;
      await saveFallback();
      
      const reqDoc = fallbackData.requisitions[index];
      await addNotification(reqDoc.userId, "Requisition Updated", `Your requisition for ${reqDoc.title} has been ${status.toLowerCase()}.`, status === "Approved" ? "success" : "warning");
      return res.json(reqDoc);
    }
    
    await pool.query(
      "UPDATE requisitions SET status = ?, adminNote = ? WHERE id = ?",
      [status, adminNote, req.params.id]
    );
    
    const [requisitions]: any = await pool.query("SELECT * FROM requisitions WHERE id = ?", [req.params.id]);
    const reqDoc = requisitions[0];
    await addNotification(reqDoc.userId, "Requisition Updated", `Your requisition for ${reqDoc.title} has been ${status.toLowerCase()}.`, status === "Approved" ? "success" : "warning");

    res.json(reqDoc);
  } catch (error) {
    res.status(500).json({ error: "Failed to update requisition status" });
  }
});

// Health check endpoint for keep-alive
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// MySQL Database Status & Query Test
app.get("/api/db-status", authenticate, async (req: any, res) => {
  if (req.user.role !== "Admin") return res.status(403).json({ error: "Forbidden" });
  
  const maxRetries = 2;
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const [rows] = await pool.query("SELECT 1 as connection_test");
      const [tables]: any = await pool.query("SELECT name FROM sqlite_master WHERE type='table'");
      
      return res.json({
        status: "Connected",
        database: "SQLite",
        test: rows,
        tables: tables.map((t: any) => t.name),
        attempts: attempt + 1
      });
    } catch (error: any) {
      lastError = error;
      console.error(`SQLite Connection Attempt ${attempt + 1} failed:`, error.message);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
      }
    }
  }

  res.status(500).json({
    status: "Error",
    message: lastError?.message || "Connection failed after retries",
    code: lastError?.code,
    host: process.env.DB_HOST || 'sdb-t.hosting.stackcp.net'
  });
});

export default app;
