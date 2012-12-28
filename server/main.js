var HTTP = require("http");
var OS = require("os");
var URL = require("url");
var SQLITE3 = require("sqlite3");
var _ = require("underscore");
var CONFIG = require("./../config.json");
var SQL = require("./sql.js");
var DATA = require("./data.js");

var db = new SQLITE3.Database(CONFIG.database);
var dataSchema = DATA.load("data-schemas/nexus.data-schema.json");
//var sqlSchema = SQL.load("sql-schemas/nexus.sql-schema.json");

/*
SQLITE3.serialize(function() {
    SQL.load("sql-schemas/nexus.sql-schema.json");
});
*/


var staticContent = {};

var ports = [{
    path: ["api", "2012-12-27"],
    type: "container",
    children: [{
        path: ["ports.json"],
        type: "endpoint",
        directory: false,
        handler: function(request, response) {
            response.writeHead(200, {"Content-Type": "application/json"});
            response.write(staticContent.ports);
            response.end();
        },
    }, {
        path: ["entities.json"],
        type: "endpoint",
        directory: false,
        handler: function(request, response) {
            response.writeHead(200, {"Content-Type": "application/json"});
            response.write(staticContent.entities);
            response.end();
        },
    }, {
        path: ["data-schema.json"],
        type: "endpoint",
        directory: false,
        handler: function(request, response) {
            response.writeHead(200, {"Content-Type": "application/json"});
            response.write(staticContent.dataSchema);
            response.end();
        },
    }, {
        path: ["sql-schema.json"],
        type: "endpoint",
        directory: false,
        handler: function(request, response) {
            response.writeHead(200, {"Content-Type": "application/json"});
            response.write(staticContent.sqlSchema);
            response.end();
        },
    }],
}];


function decodeComponent(component) {
    if(_.isString(component)) {
        return {
            type: "constant",
            value: component,
        };
    } else {
        return component;
    }
}


function describePorts(ports) {
    return _.map(ports, function(port) {
        var result = {
            path: _.map(port.path, decodeComponent),
            type: port.type,
        };
        if(port.type == "container") {
            result.children = describePorts(port.children);
        } else if(port.type == "endpoint") {
            result.directory = port.directory;
        }
        return result;
    });
}


function matchPorts(match) {
    var found = false;
    _.each(match.ports, function(port) {
        if(!found) {
            var subpath = match.path.slice(0);
            var matches = true;
            _.each(port.path, function(component) {
                if(!matches) return;
                
                component = decodeComponent(component);
                
                if(subpath.length > 0) {
                    if(component.type == "constant") {
                        if(subpath.shift() != component.value) {
                            matches = false;
                        }
                    }
                } else {
                    matches = false;
                }
            });
            if(matches) {
                if(port.type == "container") {
                    found = matchPorts(_.defaults({
                        ports: port.children,
                        path: subpath,
                    }, match));
                } else if(port.type == "endpoint") {
                    if(!found && (subpath.length == 0)) {
                        if(match.directory == port.directory) {
                            found = true;
                            port.handler(match.request, match.response);
                        }
                    }
                }
            }
        }
    });
    return found;
}


staticContent.ports = JSON.stringify(describePorts(ports));
staticContent.dataSchema = JSON.stringify(dataSchema.schema);
staticContent.entities = JSON.stringify(dataSchema.getEntities());
staticContent.sqlSchema = JSON.stringify(dataSchema.getSQLSchema());


function createServer(port, interface) {
    HTTP.createServer(function(request, response) {
        var match = {
            ports: ports,
            request: request,
            response: response,
        };
        match.path = URL.parse(request.url).pathname.split("/").slice(1);
        match.directory = (match.path[match.path.length - 1] == "");
        if(match.directory) match.path.pop();
        if(!matchPorts(match)) {
            response.writeHead(400, {});
            response.end();
        }
    }).listen(port, interface);
    
    console.log("Listening on " + interface + " port " + port + ".");
}


console.log("Initializing...");

if(_.isNull(CONFIG.interface)) {
    _.each(OS.networkInterfaces(), function(interfaceObjects) {
        _.each(interfaceObjects, function(interfaceObject) {
            if(interfaceObject.family != "IPv4") return;
            createServer(CONFIG.port, interfaceObject.address);
        });
    });
} else {
    createServer(CONFIG.port, CONFIG.interface);
}

console.log("Initialization complete.");

