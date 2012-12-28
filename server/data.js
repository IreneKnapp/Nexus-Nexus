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
    getSQLSchema: function() {
        var Data = this;
        
        if(!Data.sqlSchema) {
            Data.sqlSchema = {};
            
            Data.sqlSchema.id = Data.schema.id;
            Data.sqlSchema.tables = {
                "schema": {
                    "columns": {
                        "schema_id": { "type": "uuid" }
                    },
                    "constraints": []
                },
            };
            
            _.each(Data.schema.entities, function(entity, entityName) {
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
                    version: null
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
                        createdAt: {},
                        modifiedAt: {}
                    };
                    
                    _.each(timestamps, function(timestamp) {
                        timestamp.type = "integer";
                        timestamp.semantic_type = "timestamp";
                        timestamp.read_only = true;
                    });
                    
                    working.main.columns["created_at"] = timestamps.createdAt;
                    
                    if(!entity.versioned) {
                        working.main.columns["modified_at"] =
                            timestamps.modifiedAt;
                    } else {
                        working.version.columns["modified_at"] =
                            timestamps.modifiedAt;
                    }
                }
                
                if(!_.isNull(working.main)) {
                    tables[entityName] = working.main;
                }
                
                if(!_.isNull(working.version)) {
                    tables[entityName + "_version"] = working.version;
                }
                
                _.each(tables, function(table, tableName) {
                    if(!_.isUndefined(Data.sqlSchema.tables[tableName])) {
                        throw "Duplicate table \"" + tableName + "\".";
                    }
                    Data.sqlSchema.tables[tableName] = table;
                });
            });
        }
        
        return Data.sqlSchema;
    },
};

_.bindAll(Data);

module.exports = Data;
