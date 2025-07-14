const express = require("express")
const Wallet = require("../models/Wallet")
const { adminAuth } = require("../middleware/auth")

const router = express.Router()

// Get admin wallet details (balance and transactions)
router.get("/", adminAuth, async (req, res) => {
  try {
    // Find or create the admin wallet
    const wallet = await Wallet.findOneAndUpdate(
      { name: "Admin Wallet" },
      { $setOnInsert: { balance: 0, transactions: [] } },
      { upsert: true, new: true },
    )
    res.json(wallet)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Admin adds profit to wallet
router.post("/add-profit", adminAuth, async (req, res) => {
  try {
    const { amount, notes } = req.body

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" })
    }

    const wallet = await Wallet.findOneAndUpdate(
      { name: "Admin Wallet" },
      {
        $inc: { balance: -amount },
        $push: {
          transactions: {
            type: "profit_withdrawal",
            amount,
            description: `Profit withdrawn by ${req.user.username} (${notes || "No notes"})`,
          },
        },
      },
      { upsert: true, new: true },
    )

    res.json(wallet)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
