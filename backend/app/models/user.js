var mongoose = require('mongoose');

var RouletteBet = require('./roulette-bet')('schema');

var UserSchema = new mongoose.Schema({
    id: {
      type: String,
      required: true,
      unique: true
    },
    tradeUrl: {
      type: String,
      default: ""
    },
    withdrawBanned: {
      type: Boolean,
      default: false,
      required: true
    },
    pictureUrl: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    balance: {
      type: Number,
      required: true,
      default: 0
    },
    rouletteRoundHistory: [Number],
    depositedAmount: {
      type: Number,
      required: true,
      default: -1
    },
    betAmount: {
      type: Number,
      required: true,
      default: 0
    },
    userType: {
      type: String,
      required: true,
      enum: ['Admin', 'Moderator', 'User'],
      default: 'User'
    },
    totalDeposited: {
      type: Number,
      default: 0
    },
    totalWithdrawn: {
      type: Number,
      default: 0
    },
    totalBets: {
      type: Number,
      default: 0
    },
    totalBetBalance: {
      type: Number,
      default: 0
    }
  });

module.exports = mongoose.model('User', UserSchema);
