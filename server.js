const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
require("dotenv").config()

const authRoutes = require("./routes/auth")
const bookingRoutes = require("./routes/bookings")
const cardRoutes = require("./routes/cards")
const platformRoutes = require("./routes/platforms")
const dealerRoutes = require("./routes/dealers")
const inventoryRoutes = require("./routes/inventory")
const userRoutes = require("./routes/users")
const dealerBatchRoutes = require("./routes/dealerBatches").router
const walletRoutes = require("./routes/wallet") // Import new wallet routes

const similarityRoutes = require("./routes/similarity") // Import similarity routes

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Database connection
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/mobile-booking", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/similarity", similarityRoutes) // Use similarity routes
app.use("/api/bookings", bookingRoutes)
app.use("/api/cards", cardRoutes)
app.use("/api/platforms", platformRoutes)
app.use("/api/dealers", dealerRoutes)
app.use("/api/inventory", inventoryRoutes)
app.use("/api/users", userRoutes)
app.use("/api/dealer-batches", dealerBatchRoutes)
app.use("/api/wallet", walletRoutes) // New wallet routes

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
