const express = require("express")
const DealerBatch = require("../models/DealerBatch")
const Booking = require("../models/Booking")
const Dealer = require("../models/Dealer")
const Wallet = require("../models/Wallet") // Import Wallet model
const { adminAuth } = require("../middleware/auth")

const router = express.Router()

// Helper to generate batch ID (e.g., A001, A002)
async function generateBatchId() {
  const lastBatch = await DealerBatch.findOne().sort({ createdAt: -1 })
  let nextNumber = 1
  if (lastBatch && lastBatch.batchId) {
    const lastNumber = Number.parseInt(lastBatch.batchId.substring(1), 10)
    nextNumber = lastNumber + 1
  }
  return `A${String(nextNumber).padStart(3, "0")}`
}

// Get all dealer batches (admin only)
router.get("/", adminAuth, async (req, res) => {
  try {
    const batches = await DealerBatch.find().populate("dealerId").sort({ assignedAt: -1 })
    res.json(batches)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get dealer batches for a specific dealer (admin only)
router.get("/dealer/:dealerId", adminAuth, async (req, res) => {
  try {
    const batches = await DealerBatch.find({ dealerId: req.params.dealerId })
      .populate("dealerId")
      .sort({ assignedAt: -1 })
    res.json(batches)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get a single dealer batch by ID (admin only)
router.get("/:id", adminAuth, async (req, res) => {
  try {
    const batch = await DealerBatch.findById(req.params.id)
      .populate("dealerId")
      .populate({
        path: "bookingIds",
        populate: { path: "userId", select: "username" }, // Populate user info for each booking
      })

    if (!batch) {
      return res.status(404).json({ message: "Dealer batch not found" })
    }
    res.json(batch)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Add payment to a dealer batch (admin only)
router.patch("/:id/add-payment", adminAuth, async (req, res) => {
  try {
    const { amount, notes } = req.body

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ message: "Payment amount must be a positive number" })
    }

    const batch = await DealerBatch.findById(req.params.id)

    if (!batch) {
      return res.status(404).json({ message: "Dealer batch not found" })
    }

    // Update batch payment details
    batch.paidAmount += amount
    batch.remainingAmount = batch.totalAmount - batch.paidAmount

    if (batch.remainingAmount <= 0) {
      batch.status = "completed_payment"
      batch.remainingAmount = 0 // Ensure it's not negative
    } else {
      batch.status = "partially_paid"
    }

    batch.payments.push({ amount, notes })
    await batch.save()

    // Update dealer's paidAmount
    const dealer = await Dealer.findById(batch.dealerId)
    if (dealer) {
      dealer.paidAmount += amount
      await dealer.save()
    }

    // Update Admin Wallet
    const adminWallet = await Wallet.findOneAndUpdate(
      { name: "Admin Wallet" }, // Find the admin wallet
      {
        $inc: { balance: amount },
        $push: {
          transactions: {
            type: "credit",
            amount,
            description: `Payment from dealer ${dealer.name} for batch ${batch.batchId}`,
            relatedBatchId: batch._id,
          },
        },
      },
      { upsert: true, new: true }, // Create if not exists, return updated doc
    )

    res.json(batch)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = { router, generateBatchId }
