const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = require("./db/connect");

const app = express();
const PORT = process.env.PORT || 9000;

/* =========================
   CORS CONFIGURATION
========================= */

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://spare-frontend-2bff.vercel.app",
  "https://spare-frontend-2bff-git-main-dawit2394s-projects.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow Postman, server-to-server, and allowed frontends
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

// 🔴 VERY IMPORTANT for preflight
app.options("*", cors());

/* =========================
   MIDDLEWARE
========================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   TEST ROUTE
========================= */

app.get("/", (req, res) => {
  res.status(200).send("🚀 Spare Parts Stock Management API is running");
});

/* =========================
   ROUTES
========================= */

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/spare-parts", require("./routes/sparePartRoutes"));
app.use("/api/stock", require("./routes/stockRoutes"));
app.use("/api/loans", require("./routes/loanRoutes"));

/* =========================
   START SERVER
========================= */

const startServer = async () => {
  try {
    await connectDB(process.env.MONGODB_URL);

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Server failed to start:", error.message);
    process.exit(1);
  }
};

startServer();
