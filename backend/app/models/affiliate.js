var mongoose = require('mongoose');


var AffiliateSchema = new mongoose.Schema({
      id: {
        type: String,
        unique: true,
        required: true
      },
      promocode: {
        type: String,
        unique: true,
        sparse: true
      },
      referredBy: {
        type: String,
        default: ''
      },
      referred: [String],
      currentBalance: {
        type: Number,
        required: true,
        default: 0
      }
});

module.exports = mongoose.model('Affiliate', AffiliateSchema);
