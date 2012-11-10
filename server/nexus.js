var http = require('http');
var sql = require('sqlite3');
var config = require('./config.json');
var schema = require('./schema.js');

var db = new sql.Database(config.database);


function createTable(db, table) {
    var tableSQL = "CREATE TABLE " + table.name + " (\n";
    
    var items = [];
    
    for(var i in table.columns) {
        var column = table.columns[i];
        var columnSQL = "  " + column[0] + " " + column[1];
        items.push(columnSQL);
    }
    
    for(var i in table.constraints) {
        var constraint = table.constraints[i];
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
    schema.load(config.schema);
    
    var tableNames = schema.getTableNames();
    var first = true;
    for(var i in tableNames) {
        var tableName = tableNames[i];
        var sql = schema.getCreateTableSQL(tableName);
        if(!first) console.log("");
        console.log(sql);
        first = false;
    }
    // createTable(db, table);
});


/*
http.createServer(function(request, response) {
  reponse.writeHead(200, {'Content-Type': 'text/plain'});
  response.end('Hello World\n');
}).listen(config.port, config.interface);

var url = 'http://' + config.interface + ':' + config.port + '/'
console.log('Server running at ' + url);
*/
