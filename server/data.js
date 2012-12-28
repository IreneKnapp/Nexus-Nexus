var DirectSchema = require("direct-schema");
var FS = require("fs");
var _ = require("underscore");

var Data = {};

Data.initialized = false;

Data.load = function(filename) {
    var Data = this;

    if(!Data.initialized) {
        Data.initialized = true;
        var metaschema =
            JSON.parse(FS.readFileSync
                ("./json-schemas/data.json-schema.json", "utf8"));
        Data.validator = DirectSchema(metaschema);
    }
    
    var schema = JSON.parse(FS.readFileSync(filename, "utf8"));
    Data.validator(schema,
    function(error) {
        console.log(error);
        throw "Invalid schema.";
    });
    return _.extend({
    schema: schema,
    }, Data.template);
};

Data.template = {
    getEntities: function() {
        var Data = this;
        
        if(!Data._entities) {
            Data._computeEverything();
        }
        
        return Data._entities;
    },
    
    getSQLSchema: function() {
        var Data = this;
        
        if(!Data._sqlSchema) {
            Data._computeEverything();
        }
        
        return Data._sqlSchema;
    },
    
    _computeEverything: function() {
        var Data = this;

        Data._entities = {};
        Data._sqlSchema = {};
        
        Data._sqlSchema.id = Data.schema.id;
        Data._sqlSchema.tables = {
            "schema": {
                "columns": {
                    "schema_id": { "type": "uuid" }
                },
                "constraints": []
            },
        };
        
        _.each(Data.schema.entities, function(entity, entityName) {
            var entityOutput = {
                columns: {},
            };
            var tables = {};
            
            while(!_.isNull(entity.template)) {
                var template =
                    Data.schema.entity_templates[entity.template];
                
                entity.template = template.template;
                
                if(!_.isUndefined(template.columns)) {
                    entity.columns = _.flatten
                        ([entity.columns, template.columns], true);
                }
                
                entity = _.defaults(entity, template);
            }
            
            if(entity.unique_relation) {
                if(entity.versioned) {
                    throw "Unique relations cannot be versioned, but \""
                          + entityName + "\" is.";
                }
                
                if(entity.timestamped) {
                    throw "Unique relations cannot be timestamped, but \""
                          + entityName + "\" is.";
                }
            }
            
            var working = {
                main: null,
                version: null,
            };
            var tableNames = {
                main: entityName,
                version: entityName + "_version",
            };
            
            if(!entity.unique_relation) {
                working.main = {};
                
                if(entity.versioned) {
                    working.version = {};
                }
            } else {
                working.main = {};
            }
            
            _.each(working, function(table) {
                if(_.isNull(table)) return;
                table.columns = {};
                table.constraints = [];
            });
            
            _.each(entity.columns, function(column) {
                
            });
            
            if(entity.timestamped) {
                var timestamps = {
                    createdAt: {
                        name: "created_at",
                        table: "main",
                    },
                    modifiedAt: {
                        name: "modified_at",
                        table: "main",
                    },
                };
                
                if(entity.versioned) {
                    timestamps.modifiedAt.table = "version";
                }
                
                _.each(timestamps, function(timestamp, key) {
                    entityOutput.columns[timestamp.name] = {
                        type: "timestamp",
                        read_only: true,
                        sql: {
                            backing: [{
                                table: tableNames[timestamp.table],
                                column: timestamp.name,
                            }],
                        },
                    };
                    
                    working[timestamp.table].columns[timestamp.name] = {
                        type: "integer",
                    };
                });
            }
            
            _.each(working, function(table, key) {
                if(_.isNull(table)) return;
                var name = tableNames[key];
                tables[name] = table;
            });
            
            _.each(tables, function(table, tableName) {
                if(!_.isUndefined(Data._sqlSchema.tables[tableName])) {
                    throw "Duplicate table \"" + tableName + "\".";
                }
                Data._sqlSchema.tables[tableName] = table;
            });
            
            Data._entities[entityName] = entityOutput;
        });
    }
};

_.bindAll(Data);

module.exports = Data;

