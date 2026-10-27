
require("dotenv").config();

const { MongoClient, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json({ limit: "20kb" }));

const uri = process.env.MONGO_URI;
const jwtSecret = process.env.JWT_SECRET;
const port = process.env.PORT || 5000;

if (!uri || !jwtSecret) {
  throw new Error("MONGO_URI and JWT_SECRET must be set in server/.env");
}

const client = new MongoClient(uri);
const STARTING_CASH = 1000000;

let users;
let tasks;
let portfolios;
let orders;

// These are illustrative prices, not live market quotes.
const MARKETS = {
  RELIANCE: { name: "Reliance Industries", price: 1420, market: "Stocks" },
  TCS: { name: "Tata Consultancy Services", price: 3250, market: "Stocks" },
  INFY: { name: "Infosys", price: 1580, market: "Stocks" },
  AAPL: { name: "Apple", price: 18500, market: "Stocks" },
  BTC: { name: "Bitcoin", price: 5800000, market: "Crypto" },
  ETH: { name: "Ethereum", price: 245000, market: "Crypto" },
  "USD/INR": { name: "US Dollar / Indian Rupee", price: 83.5, market: "Forex" },
  "EUR/INR": { name: "Euro / Indian Rupee", price: 90.2, market: "Forex" },
  GOLD: { name: "Gold per gram", price: 7200, market: "Commodities" },
  SILVER: { name: "Silver per gram", price: 88, market: "Commodities" }
};

function createToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email },
    jwtSecret,
    { expiresIn: "1d" }
  );
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: "Please log in first" });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function getUserId(req) {
  return req.user.userId;
}

async function getOrCreatePortfolio(userId) {
  let portfolio = await portfolios.findOne({ userId });

  if (!portfolio) {
    const initialPortfolio = {
      userId,
      cash: STARTING_CASH,
      holdings: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      await portfolios.insertOne(initialPortfolio);
    } catch (error) {
      // Another request may have created the portfolio simultaneously.
      if (error.code !== 11000) throw error;
    }

    portfolio = await portfolios.findOne({ userId });
  }

  return portfolio;
}

// ---------------- AUTHENTICATION ----------------

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = req.body.password;

    if (!name || !email || typeof password !== "string") {
      return res.status(400).json({
        message: "Name, email and password are required"
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email" });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters"
      });
    }

    if (await users.findOne({ email })) {
      return res.status(409).json({
        message: "An account with this email already exists"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await users.insertOne({
      name,
      email,
      passwordHash,
      createdAt: new Date()
    });

    const user = { _id: result.insertedId, name, email };

    res.status(201).json({
      message: "Account created successfully",
      token: createToken(user),
      user
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists"
      });
    }

    console.error("Registration error:", error);
    res.status(500).json({ message: "Could not create account" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = req.body.password;

    if (!email || typeof password !== "string") {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    const user = await users.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        message: "Incorrect email or password"
      });
    }

    res.json({
      message: "Login successful",
      token: createToken(user),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Could not log in" });
  }
});

app.get("/api/auth/me", authenticate, async (req, res) => {
  try {
    if (!ObjectId.isValid(getUserId(req))) {
      return res.status(401).json({ message: "Invalid user session" });
    }

    const user = await users.findOne(
      { _id: new ObjectId(getUserId(req)) },
      { projection: { passwordHash: 0 } }
    );

    if (!user) {
      return res.status(401).json({ message: "Account not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Session verification error:", error);
    res.status(500).json({ message: "Could not verify session" });
  }
});

// ---------------- EXISTING TASK APIs ----------------

app.use("/api/tasks", authenticate);

app.get("/api/tasks", async (req, res) => {
  try {
    const filter = { userId: getUserId(req) };

    if (req.query.status) filter.status = req.query.status;

    const data = await tasks.find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load tasks" });
  }
});

app.post("/api/tasks", async (req, res) => {
  try {
    const { title, description, priority, status } = req.body;

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Title is required" });
    }

    const task = {
      userId: getUserId(req),
      title: title.trim(),
      description: typeof description === "string" ? description : "",
      priority: ["low", "medium", "high"].includes(priority)
        ? priority : "medium",
      status: ["todo", "in-progress", "done"].includes(status)
        ? status : "todo",
      createdAt: new Date()
    };

    const result = await tasks.insertOne(task);
    res.status(201).json({ ...task, _id: result.insertedId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not create task" });
  }
});

app.put("/api/tasks/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const changes = {};
    const { title, description, priority, status } = req.body;

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ message: "Title is required" });
      }
      changes.title = title.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string") {
        return res.status(400).json({ message: "Invalid description" });
      }
      changes.description = description;
    }

    if (priority !== undefined) {
      if (!["low", "medium", "high"].includes(priority)) {
        return res.status(400).json({ message: "Invalid priority" });
      }
      changes.priority = priority;
    }

    if (status !== undefined) {
      if (!["todo", "in-progress", "done"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      changes.status = status;
    }

    const result = await tasks.updateOne(
      { _id: new ObjectId(req.params.id), userId: getUserId(req) },
      { $set: changes }
    );

    if (!result.matchedCount) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json({ message: "Task updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not update task" });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const result = await tasks.deleteOne({
      _id: new ObjectId(req.params.id),
      userId: getUserId(req)
    });

    if (!result.deletedCount) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json({ message: "Task deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not delete task" });
  }
});

// ---------------- FLEXI TRADE APIs ----------------

// Get the logged-in user's wallet and holdings.
app.get("/api/trading/portfolio", authenticate, async (req, res) => {
  try {
    const portfolio = await getOrCreatePortfolio(getUserId(req));
    res.json(portfolio);
  } catch (error) {
    console.error("Portfolio error:", error);
    res.status(500).json({ message: "Could not load portfolio" });
  }
});

// Get this user's order history.
app.get("/api/trading/orders", authenticate, async (req, res) => {
  try {
    const data = await orders.find({ userId: getUserId(req) })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    res.json(data);
  } catch (error) {
    console.error("Orders error:", error);
    res.status(500).json({ message: "Could not load orders" });
  }
});

// Buy or sell using virtual money only.
app.post("/api/trading/order", authenticate, async (req, res) => {
  try {
    const symbol = String(req.body.symbol || "").trim().toUpperCase();
    const side = String(req.body.side || "").trim().toUpperCase();
    const quantity = Number(req.body.quantity);

    if (!MARKETS[symbol]) {
      return res.status(400).json({ message: "Unknown asset symbol" });
    }

    if (!["BUY", "SELL"].includes(side)) {
      return res.status(400).json({ message: "Side must be BUY or SELL" });
    }

    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    const asset = MARKETS[symbol];
    const price = asset.price;
    const total = price * quantity;

    if (!Number.isFinite(total) || !Number.isSafeInteger(Math.round(total * 100))) {
      return res.status(400).json({ message: "Order value is too large" });
    }

    const userId = getUserId(req);
    const portfolio = await getOrCreatePortfolio(userId);
    const current = portfolio.holdings?.[symbol] || {
      quantity: 0,
      averagePrice: 0
    };

    let newCash = portfolio.cash;
    let newHolding;

    if (side === "BUY") {
      if (total > portfolio.cash) {
        return res.status(400).json({
          message: "Not enough virtual cash"
        });
      }

      const nextQuantity = current.quantity + quantity;
      const averagePrice =
        ((current.quantity * current.averagePrice) + total) / nextQuantity;

      newCash = portfolio.cash - total;
      newHolding = { quantity: nextQuantity, averagePrice };
    } else {
      const tolerance = 1e-9;

      if (quantity > current.quantity + tolerance) {
        return res.status(400).json({
          message: "You do not own enough units to sell"
        });
      }

      const remaining = Math.max(0, current.quantity - quantity);
      newCash = portfolio.cash + total;

      newHolding = remaining === 0
        ? null
        : { quantity: remaining, averagePrice: current.averagePrice };
    }

    const holdings = { ...portfolio.holdings };

    if (newHolding) {
      holdings[symbol] = newHolding;
    } else {
      delete holdings[symbol];
    }

    const updateResult = await portfolios.updateOne(
      {
        _id: portfolio._id,
        cash: portfolio.cash,
      },
      {
        $set: {
          cash: newCash,
          holdings,
          updatedAt: new Date()
        }
      }
    );

    if (!updateResult.modifiedCount) {
      return res.status(409).json({
        message: "Portfolio changed during this order. Please try again."
      });
    }

    const order = {
      userId,
      symbol,
      name: asset.name,
      market: asset.market,
      side,
      quantity,
      price,
      total,
      createdAt: new Date()
    };

    const savedOrder = await orders.insertOne(order);

    res.status(201).json({
      message: `${side} order completed in paper trading`,
      order: { ...order, _id: savedOrder.insertedId },
      portfolio: {
        cash: newCash,
        holdings
      }
    });
  } catch (error) {
    console.error("Trade error:", error);
    res.status(500).json({ message: "Could not process order" });
  }
});

// Health checks
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/trading/health", (req, res) => {
  res.json({ ok: true, service: "trading" });
});

// ---------------- START SERVER ----------------

async function startServer() {
  try {
    await client.connect();

    const db = client.db("flexi");
    users = db.collection("users");
    tasks = db.collection("tasks");
    portfolios = db.collection("portfolios");
    orders = db.collection("orders");

    await users.createIndex({ email: 1 }, { unique: true });
    await portfolios.createIndex({ userId: 1 }, { unique: true });
    await portfolios.createIndex({ userId: 1, updatedAt: -1 });
    await orders.createIndex({ userId: 1, createdAt: -1 });

    app.listen(port, () => {
      console.log("Connected successfully to MongoDB");
      console.log(`Server started at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Startup error:", error);
    process.exit(1);
  }
}

startServer();
