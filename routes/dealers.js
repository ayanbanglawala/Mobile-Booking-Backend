const express = require("express")
const Dealer = require("../models/Dealer")
const { adminAuth } = require("../middleware/auth")

const router = express.Router()

// Get all dealers (admin only)
router.get("/", adminAuth, async (req, res) => {
  try {
    const dealers = await Dealer.find().sort({ createdAt: -1 })
    res.json(dealers)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Create dealer (admin only)
router.post("/", adminAuth, async (req, res) => {
  try {
    const dealer = new Dealer(req.body)
    await dealer.save()
    res.status(201).json(dealer)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update dealer (admin only)
router.put("/:id", adminAuth, async (req, res) => {
  try {
    const dealer = await Dealer.findByIdAndUpdate(req.params.id, req.body, { new: true })

    if (!dealer) {
      return res.status(404).json({ message: "Dealer not found" })
    }

    res.json(dealer)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Delete dealer (admin only)
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const dealer = await Dealer.findByIdAndDelete(req.params.id)

    if (!dealer) {
      return res.status(404).json({ message: "Dealer not found" })
    }

    res.json({ message: "Dealer deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
