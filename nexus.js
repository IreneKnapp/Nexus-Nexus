var http = require('http');
var config = require('./config.json');

http.createServer(function(request, response) {
  reponse.writeHead(200, {'Content-Type': 'text/plain'});
  response.end('Hello World\n');
}).listen(config.port, config.interface);

var url = 'http://' + config.interface + ':' + config.port + '/'
console.log('Server running at ' + url);
