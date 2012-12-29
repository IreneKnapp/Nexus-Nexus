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
                columns: [],
            };
            var tables = {};
            
            if(_.isUndefined(entity.columns)) {
                entity.columns = [];
            }
            
            while(!_.isNull(entity.template)) {
                var template =
                    Data.schema.entity_templates[entity.template];
                
                entity.template = template.template;
                
                if(!_.isUndefined(template.columns)) {
                    entity.columns =
                        _.flatten([entity.columns, template.columns], true);
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
                table.columns = [];
                table.constraints = [];
            });
            
            var columnSpecifications = [];
            
            _.each(entity.columns, function(column) {
                var tableRole;
                if(!entity.versioned) tableRole = "main";
                else tableRole = "version";
                
                var subcolumnSpecifications = [];
                var subcolumns = Data._typeToColumnSpecifications(column.type);
                _.each(subcolumns, function(subcolumn) {
                    subcolumn.name =
                        Data._substituteNameSpecification(subcolumn.name, {
                            column: column.name,
                        });
                    subcolumn.tableRole = tableRole;
                    subcolumnSpecifications.push(subcolumn);
                });
                
                columnSpecifications.push({
                    name: column.name,
                    semanticType: column.type,
                    readOnly: false,
                    subcolumns: subcolumnSpecifications,
                });
            });
            
            if(entity.timestamped) {
                var modifiedAtTable;
                if(entity.versioned) modifiedAtTable = "version";
                else modifiedAtTable = "main";
                
                _.each([{
                    name: "created_at",
                    tableRole: "main",
                }, {
                    name: "modified_at",
                    tableRole: modifiedAtTable,
                }], function(item) {
                    columnSpecifications.push({
                        name: item.name,
                        semanticType: "timestamp",
                        readOnly: true,
                        subcolumns: [{
                            name: [{
                                "type": "constant",
                                "value": item.name,
                            }],
                            tableRole: item.tableRole,
                            sqlType: "integer",
                        }],
                    });
                });
            }
            
            _.each(columnSpecifications, function(columnSpecification) {
                var backing = [];
                _.each(columnSpecification.subcolumns, function(subcolumn) {
                    var subcolumnName =
                        Data._finalizeNameSpecification
                            (Data._substituteNameSpecification(subcolumn.name,
                    {
                        entity: entityName,
                    }));
                    
                    working[subcolumn.tableRole].columns.push({
                        name: subcolumnName,
                        type: subcolumn.sqlType,
                    });
                    
                    backing.push({
                        table: tableNames[subcolumn.tableRole],
                        column: subcolumnName,
                    });
                });
                
                entityOutput.columns.push({
                    name: columnSpecification.name,
                    type: columnSpecification.semanticType,
                    read_only: columnSpecification.readOnly,
                    sql: {
                        backing: backing,
                    },
                });
            });
            
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
    },
    
    _typeToColumnSpecifications: function(type) {
        var Data = this;
        
        var constructor;
        var parameters;
        if(_.isString(type)) {
            constructor = type;
            parameters = [];
        } else if(_.isArray(type)) {
            constructor = type[0];
            parameters = type.slice(1);
        }
        
        var simple = {};
        if(constructor == "integer") {
            simple.sqlType = "integer";
        } else if(constructor == "text") {
            simple.sqlType = "text";
        } else if(constructor == "blob") {
            simple.sqlType = "blob";
        } else if(constructor == "timestamp") {
            simple.sqlType = "integer";
        } else if(constructor == "boolean") {
            simple.sqlType = "integer";
        } else if(constructor == "password") {
            simple.sqlType = "blob";
        } else if(constructor == "email") {
            simple.sqlType = "text";
        } else if(constructor == "maybe") {
            return Data._typeToColumnSpecifications(parameters[0]);
        } else if(constructor == "array") {
            return Data._typeToColumnSpecifications(parameters[0]);
        }
        
        return [_.extend(simple, {
            name: [{
                "type": "variable",
                "name": "column",
            }],
        })];
    },
    
    _substituteNameSpecification: function(parts, variables) {
        var Data = this;
        
        var resultParts = _.map(parts, function(part) {
            if((part.type == "variable")
               && !_.isUndefined(variables[part.name]))
            {
                return {
                    type: "constant",
                    value: variables[part.name],
                };
            } else {
                return part;
            }
        });

        return resultParts;
    },

    _finalizeNameSpecification: function(parts) {
        var Data = this;
        
        var result = "";
        
        _.each(parts, function(part) {
            if(part.type == "constant") result += part.value;
        });
        
        return result;
    },
};

_.bindAll(Data);

module.exports = Data;

