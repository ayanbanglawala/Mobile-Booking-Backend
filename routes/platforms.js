const express = require("express")
const Platform = require("../models/Platform")
const { auth } = require("../middleware/auth")

const router = express.Router()

// Get all platforms for user
router.get("/", auth, async (req, res) => {
  try {
    const platforms = await Platform.find({ userId: req.user._id }).sort({ createdAt: -1 })
    res.json(platforms)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Create platform
router.post("/", auth, async (req, res) => {
  try {
    const platform = new Platform({
      ...req.body,
      userId: req.user._id,
    })
    await platform.save()
    res.status(201).json(platform)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update platform
router.put("/:id", auth, async (req, res) => {
  try {
    const platform = await Platform.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, req.body, {
      new: true,
    })

    if (!platform) {
      return res.status(404).json({ message: "Platform not found" })
    }

    res.json(platform)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Delete platform
router.delete("/:id", auth, async (req, res) => {
  try {
    const platform = await Platform.findOneAndDelete({ _id: req.params.id, userId: req.user._id })

    if (!platform) {
      return res.status(404).json({ message: "Platform not found" })
    }

    res.json({ message: "Platform deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
