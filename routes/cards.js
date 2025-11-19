const express = require("express")
const Card = require("../models/Card")
const { auth } = require("../middleware/auth")

const router = express.Router()


router.post("/amountpay", auth, async (req, res) => {
  try {
    const { id, amount } = req.body;

    const card = await Card.findOne({ _id: id, userId: req.user._id });

    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    const newAvailableLimit = Number(card.availableLimit) + Number(amount);
    card.availableLimit = newAvailableLimit;
    console.log(card.availableLimit ,card.availableLimit + amount, card.availableLimit);
    
    await card.save();

    res.json({ message: "Available limit updated", availableLimit: card.availableLimit });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});
// Get all cards for user
router.get("/", auth, async (req, res) => {
  try {
    const cards = await Card.find({ userId: req.user._id }).sort({ createdAt: -1 })
    res.json(cards)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Create card
router.post("/", auth, async (req, res) => {
  try {
    const card = new Card({
      ...req.body,
      userId: req.user._id,
    })
    await card.save()
    res.status(201).json(card)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update card
router.put("/:id", auth, async (req, res) => {
  try {
    const card = await Card.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, req.body, { new: true })

    if (!card) {
      return res.status(404).json({ message: "Card not found" })
    }

    res.json(card)
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Delete card
router.delete("/:id", auth, async (req, res) => {
  try {
    const card = await Card.findOneAndDelete({ _id: req.params.id, userId: req.user._id })

    if (!card) {
      return res.status(404).json({ message: "Card not found" })
    }

    res.json({ message: "Card deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
