var http = require("http");
var fs = require("fs");
var sql = require("sqlite3");
var jsv = require("JSV").JSV;
var config = require("./../config/config.json");
//var schema = require("./schema.js");

var db = new sql.Database(config.database);


db.serialize(function() {
    var metaschema = JSON.parse(fs.readFileSync('schemas/schema.json', "utf8"));
    var schema = JSON.parse(fs.readFileSync('config/schema.json', "utf8"));
    var environment = jsv.createEnvironment();
    var report = environment.validate(schema, metaschema);
    if(report.errors.length == 0) {
        console.log("Okay!");
    } else {
        console.log(report.errors);
    }
});


/*
http.createServer(function(request, response) {
  reponse.writeHead(200, {"Content-Type": "text/plain"});
  response.end("Hello World\n");
}).listen(config.port, config.interface);

var url = "http://" + config.interface + ":" + config.port + "/"
console.log("Server running at " + url);
*/
