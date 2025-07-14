const mongoose = require("mongoose")

const walletTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["credit", "debit", "profit_addition", "profit_withdrawal"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  description: {
    type: String,
    required: true,
  },
  relatedBookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    required: false,
  },
  relatedBatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DealerBatch",
    required: false,
  },
})

const walletSchema = new mongoose.Schema(
  {
    // Assuming a single admin wallet for simplicity.
    // If multiple admins, you might link this to an admin userId.
    name: {
      type: String,
      default: "Admin Wallet",
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    transactions: [walletTransactionSchema],
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model("Wallet", walletSchema)
