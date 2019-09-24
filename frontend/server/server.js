var express = require('express');
var fs = require('fs'),
 https = require('https');
var path = require('path');
var app = express();
 
 https.createServer({
	 key: fs.readFileSync('../../ssl/cstrike.bet.key'),
     cert: fs.readFileSync('../../ssl/cstrike.bet.pem')
 }, app).listen(8443);
 
 app.use(function log (req, res, next) {
  console.log([req.method, req.url].join(' '));
  next();
});
// serve angular front end files from root path
app.use('/', express.static('/srv/cstrike.bet/frontend/dist/', { redirect: false }));
 
// rewrite virtual urls to angular app to enable refreshing of internal pages
app.get('*', function (req, res, next) {
    res.sendFile(path.resolve('/srv/cstrike.bet/frontend/dist/index.html'));
});


 