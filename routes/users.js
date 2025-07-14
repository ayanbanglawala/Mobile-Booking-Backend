const express = require("express")
const User = require("../models/User")
const Booking = require("../models/Booking")
const { adminAuth } = require("../middleware/auth")

const router = express.Router()

// Get all users (admin only)
router.get("/", adminAuth, async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 })

    // Get booking counts for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const bookingCount = await Booking.countDocuments({ userId: user._id })
        const totalAmount = await Booking.aggregate([
          { $match: { userId: user._id } },
          { $group: { _id: null, total: { $sum: "$bookingPrice" } } },
        ])

        return {
          ...user.toObject(),
          bookingCount,
          totalAmount: totalAmount[0]?.total || 0,
        }
      }),
    )

    res.json(usersWithStats)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update user (admin only)
router.put("/:id", adminAuth, async (req, res) => {
  try {
    const { username, role } = req.body

    const user = await User.findByIdAndUpdate(req.params.id, { username, role }, { new: true }).select("-password")

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json(user)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Delete user (admin only)
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id)

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Also delete all bookings by this user
    await Booking.deleteMany({ userId: req.params.id })

    res.json({ message: "User and associated bookings deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get user details with bookings (admin only)
router.get("/:id", adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password")

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const bookings = await Booking.find({ userId: req.params.id })
      .populate("assignedToDealerId")
      .sort({ createdAt: -1 })

    res.json({ user, bookings })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
