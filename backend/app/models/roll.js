var mongoose = require('mongoose');


var RollSchema = new mongoose.Schema({
      round: {
        type: Number,
        required: true,
        unique: true,
      },
      winningNumber: {
        type: Number,
        required: true
      },
      date: {
        type: String,
        required: true,
      }
});

module.exports = mongoose.model('Roll', RollSchema);
