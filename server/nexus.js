var http = require("http");
var fs = require("fs");
var sql = require("sqlite3");
var config = require("./../config/config.json");
var schema = require("./schema.js");

var db = new sql.Database(config.database);


db.serialize(function() {
    schema.load('config/schema.json');
});


/*
http.createServer(function(request, response) {
  reponse.writeHead(200, {"Content-Type": "text/plain"});
  response.end("Hello World\n");
}).listen(config.port, config.interface);

var url = "http://" + config.interface + ":" + config.port + "/"
console.log("Server running at " + url);
*/
