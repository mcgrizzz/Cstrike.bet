var mongoose = require('mongoose');


var RouletteBetSchema = new mongoose.Schema({
      userId: {
        type: String,
        required: true
      },
      betAmount: {
        type: Number,
        required: true
      },
      betColor: {
        type: String,
        enum: ['Red', 'Green', 'Black'],
      }
});

module.exports = function(arg){
  var model = mongoose.model('RouletteBet', RouletteBetSchema);
  var schema = RouletteBetSchema;
  return { 'model': model,  'schema': schema};
}
