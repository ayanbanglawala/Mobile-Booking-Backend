const mongoose = require("mongoose")

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bookingDate: {
      type: Date,
      required: true,
    },
    mobileModel: {
      type: String,
      required: true,
    },
    bookingPrice: {
      type: Number,
      required: true,
    },
    sellingPrice: {
      type: Number, // This will be used for profit/loss calculation
    },
    platform: {
      type: String,
      required: true,
    },
    bookingAccount: {
      type: String,
      // No longer required, will be set by admin or system
    },
    card: {
      type: String,
      required: true,
    },
    dealer: {
      type: String,
      // No longer required, will be set by admin or system
    },
    bookingId: {
      type: String,
      // No longer required, will be set by admin or system
    },
    notes: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "delivered", "given_to_admin", "given_to_dealer", "payment_done"],
      default: "pending",
    },
    assignedToDealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dealer",
    },
    dealerBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DealerBatch",
    },
    givenToAdminAt: {
      type: Date,
    },
    assignedToDealerAt: {
      type: Date,
    },
    dealerPaymentReceived: {
      type: Boolean,
      default: false,
    },
    userPaymentGiven: {
      type: Boolean,
      default: false,
    },
    dealerPaymentDate: {
      type: Date,
    },
    userPaymentDate: {
      type: Date,
    },
    dealerAmount: {
      type: Number,
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model("Booking", bookingSchema)
