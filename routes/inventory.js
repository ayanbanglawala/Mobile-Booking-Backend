const express = require("express")
const Booking = require("../models/Booking")
const Dealer = require("../models/Dealer")
const DealerBatch = require("../models/DealerBatch")
const Wallet = require("../models/Wallet") // Import Wallet model
const { auth, adminAuth } = require("../middleware/auth")
const { generateBatchId } = require("./dealerBatches")

const router = express.Router()

// Get user inventory (delivered but not given to admin)
router.get("/user", auth, async (req, res) => {
  try {
    const inventory = await Booking.find({
      userId: req.user._id,
      status: "delivered",
    }).sort({ createdAt: -1 })

    res.json(inventory)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get admin inventory (given to admin but not assigned to dealer)
router.get("/admin", adminAuth, async (req, res) => {
  try {
    const inventory = await Booking.find({
      status: "given_to_admin",
    })
      .populate("userId", "username")
      .sort({ givenToAdminAt: -1 })

    res.json(inventory)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Assign mobiles to dealer (admin only) - NOW CREATES A DEALER BATCH
router.post("/assign-to-dealer", adminAuth, async (req, res) => {
  try {
    const { dealerId, bookingIds, amounts } = req.body

    if (!dealerId || !bookingIds || bookingIds.length === 0 || !amounts) {
      return res.status(400).json({ message: "Dealer ID, booking IDs, and amounts are required" })
    }

    const dealer = await Dealer.findById(dealerId)
    if (!dealer) {
      return res.status(404).json({ message: "Dealer not found" })
    }

    let totalBatchAmount = 0
    const updatedBookingIds = []

    // Validate amounts and calculate total
    for (let i = 0; i < bookingIds.length; i++) {
      const bookingId = bookingIds[i]
      const amount = amounts[bookingId] || 0 // Use object for amounts
      if (typeof amount !== "number" || amount < 0) {
        return res.status(400).json({ message: `Invalid amount for booking ${bookingId}` })
      }
      totalBatchAmount += amount
      updatedBookingIds.push(bookingId)
    }

    // Generate unique batch ID
    const batchId = await generateBatchId()

    // Create new DealerBatch
    const newDealerBatch = new DealerBatch({
      dealerId,
      batchId,
      bookingIds: updatedBookingIds,
      totalAmount: totalBatchAmount,
      remainingAmount: totalBatchAmount,
      status: "pending_payment",
    })
    await newDealerBatch.save()

    // Update individual bookings
    const updatePromises = updatedBookingIds.map(async (bookingId) => {
      const amount = amounts[bookingId] || 0
      return Booking.findByIdAndUpdate(bookingId, {
        status: "given_to_dealer",
        assignedToDealerId: dealerId,
        dealerBatchId: newDealerBatch._id, // Link to the new batch
        assignedToDealerAt: new Date(),
        dealerAmount: amount,
      })
    })

    await Promise.all(updatePromises)

    // Update dealer stats (totalMobiles and totalAmount)
    dealer.totalMobiles += updatedBookingIds.length
    dealer.totalAmount += totalBatchAmount
    await dealer.save()

    res.status(201).json({ message: "Mobiles assigned to dealer in a new batch successfully", batch: newDealerBatch })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Mark user payment given (admin only)
router.patch("/user-payment/:bookingId", adminAuth, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.bookingId,
      {
        userPaymentGiven: true,
        userPaymentDate: new Date(),
        status: "payment_done",
      },
      { new: true },
    )

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" })
    }

    // Deduct from Admin Wallet
    const payoutAmount = booking.sellingPrice || booking.bookingPrice // Use sellingPrice if available, else bookingPrice
    if (payoutAmount) {
      const adminWallet = await Wallet.findOneAndUpdate(
        { name: "Admin Wallet" },
        {
          $inc: { balance: -payoutAmount },
          $push: {
            transactions: {
              type: "debit",
              amount: payoutAmount,
              description: `Payment to user ${booking.userId} for mobile ${booking.mobileModel}`,
              relatedBookingId: booking._id,
            },
          },
        },
        { upsert: true, new: true },
      )
    }

    res.json(booking)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get dashboard stats - No change needed here, it uses existing booking counts
router.get("/stats", auth, async (req, res) => {
  try {
    let stats

    if (req.user.role === "admin") {
      // Admin stats
      const totalBookings = await Booking.countDocuments()
      const mobilesDelivered = await Booking.countDocuments({ status: "delivered" })
      const mobilesWithAdmin = await Booking.countDocuments({ status: "given_to_admin" })
      const mobilesAssignedToDealers = await Booking.countDocuments({ status: "given_to_dealer" })
      const dealerPaymentPending = await DealerBatch.countDocuments({ status: { $ne: "completed_payment" } }) // Count pending batches
      const userPaymentPending = await Booking.countDocuments({
        dealerPaymentReceived: true,
        userPaymentGiven: false,
      })

      stats = {
        totalBookings,
        mobilesDelivered,
        mobilesWithAdmin,
        mobilesAssignedToDealers,
        dealerPaymentPending,
        userPaymentPending,
      }
    } else {
      // User stats
      const totalBookings = await Booking.countDocuments({ userId: req.user._id })
      const mobilesDelivered = await Booking.countDocuments({
        userId: req.user._id,
        status: "delivered",
      })
      const mobilesGivenToAdmin = await Booking.countDocuments({
        userId: req.user._id,
        status: "given_to_admin",
      })
      const mobilesAssignedToDealers = await Booking.countDocuments({
        userId: req.user._id,
        status: "given_to_dealer",
      })
      const paymentPending = await Booking.countDocuments({
        userId: req.user._id,
        dealerPaymentReceived: true,
        userPaymentGiven: false,
      })

      stats = {
        totalBookings,
        mobilesDelivered,
        mobilesGivenToAdmin,
        mobilesAssignedToDealers,
        paymentPending,
      }
    }

    res.json(stats)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
