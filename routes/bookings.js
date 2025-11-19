const express = require("express");
const Booking = require("../models/Booking");
const Wallet = require("../models/Wallet");
const Dealer = require("../models/Dealer");
const { auth, adminAuth } = require("../middleware/auth");
const { Parser } = require('json2csv');
const Card = require("../models/Card");
const router = express.Router();

// Get all bookings with pagination and filtering
router.get("/", auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      platform = "",
      fromDate = "",
      toDate = "",
      userId = ""
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build filter object
    let filter = {};
    
    // Role-based filtering
    if (req.user.role !== "admin") {
      filter.userId = req.user._id;
    } else if (userId) {
      filter.userId = userId;
    }

    // Search filter
    if (search) {
      filter.$or = [
        { mobileModel: { $regex: search, $options: "i" } },
        { platform: { $regex: search, $options: "i" } },
        { bookingId: { $regex: search, $options: "i" } },
        { "userId.username": { $regex: search, $options: "i" } }
      ];
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Platform filter
    if (platform) {
      filter.platform = { $regex: platform, $options: "i" };
    }

    // Date range filter
    if (fromDate || toDate) {
      filter.bookingDate = {};
      if (fromDate) {
        filter.bookingDate.$gte = new Date(fromDate);
      }
      if (toDate) {
        filter.bookingDate.$lte = new Date(toDate);
      }
    }

    // Get total count for pagination
    const total = await Booking.countDocuments(filter);

    // Get bookings with pagination
    const bookings = await Booking.find(filter)
      .populate("userId", "username")
      .populate("assignedToDealerId")
      .populate("dealerBatchId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      bookings,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Export bookings to CSV/Excel
router.get("/export", auth, async (req, res) => {
  try {
    const { fromDate, toDate, format = "csv" } = req.query;

    // Build filter object for export
    let filter = {};
    
    // Role-based filtering
    if (req.user.role !== "admin") {
      filter.userId = req.user._id;
    }

    // Date range filter
    if (fromDate || toDate) {
      filter.bookingDate = {};
      if (fromDate) {
        filter.bookingDate.$gte = new Date(fromDate);
      }
      if (toDate) {
        filter.bookingDate.$lte = new Date(toDate);
      }
    }

    // Get bookings for export
    const bookings = await Booking.find(filter)
      .populate("userId", "username")
      .populate("assignedToDealerId", "name")
      .sort({ bookingDate: 1 });

    // Prepare data for export
    const exportData = bookings.map(booking => ({
      "Booking Date": new Date(booking.bookingDate).toLocaleDateString(),
      "User": booking.userId?.username || "N/A",
      "Mobile Model": booking.mobileModel,
      "Booking Price": booking.bookingPrice,
      "Selling Price": booking.sellingPrice || "N/A",
      "Profit/Loss": (booking.sellingPrice || 0) - booking.bookingPrice,
      "Platform": booking.platform,
      "Card": booking.card,
      "Status": booking.status,
      "Booking ID": booking.bookingId || "N/A",
      "Dealer": booking.assignedToDealerId?.name || booking.dealer || "N/A",
      "Notes": booking.notes || "N/A",
      "Created At": new Date(booking.createdAt).toLocaleDateString()
    }));

    if (format === "csv") {
      // Export as CSV
      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(exportData);
      
      res.header('Content-Type', 'text/csv');
      res.attachment(`bookings-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } else {
      // Export as JSON (for Excel or other formats)
      res.json({
        data: exportData,
        meta: {
          exportedAt: new Date().toISOString(),
          totalRecords: exportData.length,
          dateRange: fromDate && toDate ? `${fromDate} to ${toDate}` : "All dates"
        }
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Export failed", error: error.message });
  }
});

// Create booking (both user and admin)
router.post("/", auth, async (req, res) => {
  try {
    const { bookingDate, mobileModel, bookingPrice, sellingPrice, platform, card, notes } = req.body;

    const limit = await Card.findOne({ alias: card });
    console.log("CARD : ", limit);

    const updateLimit = await Card.findOneAndUpdate(
      { _id: limit._id },
      { availableLimit: limit.limit - bookingPrice },
      { new: true }
    );
    await updateLimit.save();
    
    const booking = new Booking({
      userId: req.user._id,
      bookingDate,
      mobileModel,
      bookingPrice,
      sellingPrice,
      platform,
      card,
      notes,
    });
    await booking.save();

    await booking.populate("userId", "username");
    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
    console.log("ERROR : ", error);
  }
});

// Update booking status
router.patch("/:id/status", auth, async (req, res) => {
  try {
    const { status } = req.body;
    let booking;

    if (req.user.role === "admin") {
      booking = await Booking.findById(req.params.id);
    } else {
      booking = await Booking.findOne({ _id: req.params.id, userId: req.user._id });
    }

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    booking.status = status;

    if (status === "given_to_admin") {
      booking.givenToAdminAt = new Date();
    }

    await booking.save();
    await booking.populate("userId", "username");
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update booking
router.put("/:id", auth, async (req, res) => {
  try {
    let booking;

    if (req.user.role === "admin") {
      const { sellingPrice, notes, status, bookingAccount, dealer, bookingId, assignedToDealerId, dealerAmount } = req.body;

      const updateFields = {
        sellingPrice,
        notes,
        status,
        bookingAccount,
        dealer,
        bookingId,
        assignedToDealerId,
        dealerAmount,
      };

      Object.keys(updateFields).forEach((key) => updateFields[key] === undefined && delete updateFields[key]);

      booking = await Booking.findByIdAndUpdate(req.params.id, updateFields, { new: true });
    } else {
      const { bookingDate, mobileModel, bookingPrice, sellingPrice, platform, card, notes } = req.body;
      const updateFields = {
        bookingDate,
        mobileModel,
        bookingPrice,
        sellingPrice,
        platform,
        card,
        notes,
      };
      booking = await Booking.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, updateFields, {
        new: true,
      });
    }

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    await booking.populate("userId", "username");
    await booking.populate("assignedToDealerId");
    await booking.populate("dealerBatchId");
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete booking
router.delete("/:id", auth, async (req, res) => {
  try {
    let booking;

    if (req.user.role === "admin") {
      booking = await Booking.findByIdAndDelete(req.params.id);
    } else {
      booking = await Booking.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    }

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json({ message: "Booking deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Mark user payment as given
router.patch("/:id/mark-user-paid", adminAuth, async (req, res) => {
  try {
    const { sellingPrice } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (sellingPrice !== undefined && sellingPrice !== null && Number(sellingPrice) >= 0) {
      booking.sellingPrice = Number(sellingPrice);
    } else if (booking.sellingPrice === undefined || booking.sellingPrice === null) {
      booking.sellingPrice = booking.bookingPrice;
    }

    const amountToDeduct = booking.sellingPrice || booking.bookingPrice;

    if (typeof amountToDeduct !== "number" || amountToDeduct <= 0) {
      return res.status(400).json({ message: "Invalid amount for user payment deduction." });
    }

    booking.userPaymentGiven = true;
    booking.userPaymentDate = new Date();
    booking.status = "payment_done";

    await booking.save();

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
      { upsert: true, new: true },
    );

    await booking.populate("userId", "username");
    await booking.populate("assignedToDealerId");
    await booking.populate("dealerBatchId");
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;