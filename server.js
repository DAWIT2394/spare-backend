const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 9000;

require("dotenv").config();
const connectDB = require("./db/connect");

// ✅ Middleware

// Allow multiple frontend origins (adjust as needed)
const allowedOrigins = [
  "http://localhost:3000", // React default
  "http://localhost:3001", // if you use this port
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like Postman) or allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Test route
app.get("/", (req, res) => {
  res.send("Spare Parts Stock Management API is running");
});

// ✅ Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/spare-parts", require("./routes/sparePartRoutes"));
app.use("/api/stock", require("./routes/stockRoutes"));
app.use("/api/loans", require("./routes/loanRoutes"));

// ✅ Start server after DB connection
const start = async () => {
  try {
    await connectDB(process.env.MONGODB_URL);
    app.listen(PORT, () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
};

start();
