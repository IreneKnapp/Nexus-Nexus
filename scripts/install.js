var prefix = process.env["npm_config_prefix"];
var npm = require(prefix + "/lib/node_modules/npm/lib/npm.js");

npm.load({}, function(error) {
    if(error) process.exit(1);
    npm.commands.build(["node_modules/sqlite3"]);
});
