const express = require("express")
const Booking = require("../models/Booking")
const Wallet = require("../models/Wallet") // Import Wallet model
const Dealer = require("../models/Dealer") // Import Dealer model for assignedToDealerId dropdown
const { auth, adminAuth } = require("../middleware/auth")

const router = express.Router()

// Get all bookings for user OR all bookings for admin
router.get("/", auth, async (req, res) => {
  try {
    let bookings
    if (req.user.role === "admin") {
      // Admin can see all bookings from all users
      bookings = await Booking.find()
        .populate("userId", "username")
        .populate("assignedToDealerId")
        .populate("dealerBatchId") // Populate dealer batch info
        .sort({ createdAt: -1 })
    } else {
      // Regular users see only their bookings
      bookings = await Booking.find({ userId: req.user._id })
        .populate("assignedToDealerId")
        .populate("dealerBatchId") // Populate dealer batch info
        .sort({ createdAt: -1 })
    }
    res.json(bookings)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Create booking (both user and admin)
router.post("/", auth, async (req, res) => {
  try {
    // Destructure only allowed fields for creation
    const { bookingDate, mobileModel, bookingPrice, sellingPrice, platform, card, notes } = req.body

    const booking = new Booking({
      userId: req.user._id,
      bookingDate,
      mobileModel,
      bookingPrice,
      sellingPrice,
      platform,
      card,
      notes,
    })
    await booking.save()

    // Populate user info for response
    await booking.populate("userId", "username")
    res.status(201).json(booking)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update booking status (both user and admin, but admin can update any booking)
router.patch("/:id/status", auth, async (req, res) => {
  try {
    const { status } = req.body
    let booking

    if (req.user.role === "admin") {
      // Admin can update any booking
      booking = await Booking.findById(req.params.id)
    } else {
      // Regular user can only update their own bookings
      booking = await Booking.findOne({ _id: req.params.id, userId: req.user._id })
    }

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" })
    }

    booking.status = status

    if (status === "given_to_admin") {
      booking.givenToAdminAt = new Date()
    }

    await booking.save()
    await booking.populate("userId", "username")
    res.json(booking)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update booking (both user and admin, but admin can update any booking)
router.put("/:id", auth, async (req, res) => {
  try {
    let booking

    if (req.user.role === "admin") {
      // Admin can update any booking and specific fields
      const { sellingPrice, notes, status, bookingAccount, dealer, bookingId, assignedToDealerId, dealerAmount } =
        req.body

      const updateFields = {
        sellingPrice,
        notes,
        status,
        bookingAccount,
        dealer,
        bookingId,
        assignedToDealerId,
        dealerAmount,
      }

      // Remove undefined fields to prevent overwriting with null/undefined
      Object.keys(updateFields).forEach((key) => updateFields[key] === undefined && delete updateFields[key])

      booking = await Booking.findByIdAndUpdate(req.params.id, updateFields, { new: true })
    } else {
      // Regular user can only update their own bookings and limited fields
      const { bookingDate, mobileModel, bookingPrice, sellingPrice, platform, card, notes } = req.body
      const updateFields = {
        bookingDate,
        mobileModel,
        bookingPrice,
        sellingPrice,
        platform,
        card,
        notes,
      }
      booking = await Booking.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, updateFields, {
        new: true,
      })
    }

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" })
    }

    await booking.populate("userId", "username")
    await booking.populate("assignedToDealerId")
    await booking.populate("dealerBatchId")
    res.json(booking)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Delete booking (both user and admin, but admin can delete any booking)
router.delete("/:id", auth, async (req, res) => {
  try {
    let booking

    if (req.user.role === "admin") {
      // Admin can delete any booking
      booking = await Booking.findByIdAndDelete(req.params.id)
    } else {
      // Regular user can only delete their own bookings
      booking = await Booking.findOneAndDelete({ _id: req.params.id, userId: req.user._id })
    }

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" })
    }

    res.json({ message: "Booking deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// NEW: Admin marks user payment as given and deducts from wallet
router.patch("/:id/mark-user-paid", adminAuth, async (req, res) => {
  try {
    const { sellingPrice } = req.body // Admin can provide/update sellingPrice here

    const booking = await Booking.findById(req.params.id)

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" })
    }

    // Update sellingPrice if provided and different
    if (sellingPrice !== undefined && sellingPrice !== null && Number(sellingPrice) >= 0) {
      booking.sellingPrice = Number(sellingPrice)
    } else if (booking.sellingPrice === undefined || booking.sellingPrice === null) {
      // If sellingPrice is not provided and not set, use bookingPrice as fallback for deduction
      booking.sellingPrice = booking.bookingPrice
    }

    // Ensure sellingPrice is a number for deduction
    const amountToDeduct = booking.sellingPrice || booking.bookingPrice

    if (typeof amountToDeduct !== "number" || amountToDeduct <= 0) {
      return res.status(400).json({ message: "Invalid amount for user payment deduction." })
    }

    // Update booking status
    booking.userPaymentGiven = true
    booking.userPaymentDate = new Date()
    booking.status = "payment_done"

    await booking.save()

    // Deduct from Admin Wallet
    const adminWallet = await Wallet.findOneAndUpdate(
      { name: "Admin Wallet" },
      {
        $inc: { balance: -amountToDeduct },
        $push: {
          transactions: {
            type: "debit",
            amount: amountToDeduct,
            description: `Payment to user ${booking.userId?.username || booking.userId} for mobile ${booking.mobileModel} (Booking ID: ${booking.bookingId || booking._id})`,
            relatedBookingId: booking._id,
          },
        },
      },
      { upsert: true, new: true }, // Create if not exists, return updated doc
    )

    await booking.populate("userId", "username")
    await booking.populate("assignedToDealerId")
    await booking.populate("dealerBatchId")
    res.json(booking)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
