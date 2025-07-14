const mongoose = require("mongoose")

const cardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    alias: {
      type: String,
      required: true,
    },
    bankName: {
      type: String,
      required: true,
    },
    lastFour: {
      type: String,
      required: true,
      maxlength: 4,
    },
    cardType: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model("Card", cardSchema)
