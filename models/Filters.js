const mongoose = require("mongoose");

const FiltersSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  workType: {
    type: [String],
    default: []
  },
  camera: {
    type: String,
    enum: ["on", "off"],
    required: true
  },
},
 { timestamps: true }
);

module.exports = mongoose.model("Filters", FiltersSchema);
