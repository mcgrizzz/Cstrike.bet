var mongoose = require('mongoose');

var sessionSchema = new mongoose.Schema({
      hash: {
        type: String,
        required: true,
        unique: true
      },
      id: {
        type: String,
        required: true,
        unique: true
      },
      expiresAt: {
        type: Number,
        required: true
      },
      initTime: {
        type: Number,
        required: true
      }

});

module.exports = mongoose.model('UserSession', sessionSchema);
