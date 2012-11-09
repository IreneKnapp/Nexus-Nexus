var http = require('http');
var sql = require('sqlite3');
var config = require('./config.json');


var db = new sql.Database(config.database);


function createTable(db, tableName, columns, constraints) {
    var tableSQL = "CREATE TABLE " + tableName + " (\n";
    
    var items = [];
    
    for(var i in columns) {
        var column = columns[i];
        var columnSQL = "  " + column[0] + " " + column[1];
        items.push(columnSQL);
    }
    
    for(var i in constraints) {
        var constraint = constraints[i];
        var constraintSQL = constraint;
        items.push(constraintSQL);
    }
    
    for(var i = 0; i < items.length; i++) {
        var last = (i + 1 == items.length);
        
        tableSQL += items[i];
        
        if(!last) tableSQL += ",";
        tableSQL += "\n";
    }
    
    tableSQL += ")";
    
    db.run(tableSQL);
}


db.serialize(function() {
    createTable(db, "images", [
        ["image_id", "blob primary key"],
        ["name", "text"],
        ["data", "blob"]
    ], []);
});



http.createServer(function(request, response) {
  reponse.writeHead(200, {'Content-Type': 'text/plain'});
  response.end('Hello World\n');
}).listen(config.port, config.interface);

var url = 'http://' + config.interface + ':' + config.port + '/'
console.log('Server running at ' + url);
