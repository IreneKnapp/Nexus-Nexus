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
            schema: {
                columns: {
                    schema_id: { type: "uuid" }
                },
                constraints: []
            },
        };
        
        _.each(Data.schema.entities, function(entity, entityName) {
            var entityOutput = {
                key: [],
                columns: [],
            };
            var tables = {};
            
            if(_.isUndefined(entity.recursiveExtends)) {
                entity.recursiveExtends = [];
            }
            
            if(_.isUndefined(entity.columns)) {
                entity.columns = [];
            }
            
            while(!_.isNull(entity.template)) {
                var template =
                    Data.schema.entity_templates[entity.template];
                
                entity.template = template.template;
                
                if(!_.isUndefined(template["extends"])) {
                    entity.recursiveExtends =
                        _.flatten([template["extends"],
                                   entity["extends"]], true);
                }
                
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
            
            entityOutput.immediateExtends = entity["extends"];
            
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
            
            var preColumnSpecifications = [];
            
            _.each(entity.key, function(keyColumn, keyIndex) {
                var keyColumnName =
                    Data._finalizeNameSpecification
                        (Data._substituteNameSpecification(keyColumn.name,
                {
                    entity: entityName,
                }));
                
                var tableRoles = [];
                _.each(working, function(table, tableRole) {
                    if(_.isNull(table)) return;
                    
                    tableRoles.push(tableRole);
                });
                
                preColumnSpecifications.push({
                    name: keyColumnName,
                    type: keyColumn.type,
                    tableRoles: tableRoles,
                    readOnly: true,
                    order: 0,
                    keyIndex: keyIndex,
                });
                
                entityOutput.key.push(keyColumnName);
            });
            
            _.each(entity.columns, function(column) {
                var tableRole;
                if(!entity.versioned) tableRole = "main";
                else tableRole = "version";
                
                preColumnSpecifications.push({
                    name: column.name,
                    type: column.type,
                    tableRoles: [tableRole],
                    readOnly: false,
                    order: 2,
                    keyIndex: null,
                });
            });
            
            var columnSpecifications = [];
            
            _.each(preColumnSpecifications, function(column) {
                var subcolumnSpecifications = [];
                var subcolumns = Data._typeToColumnSpecifications(column.type);
                _.each(subcolumns, function(subcolumn) {
                    subcolumn.name =
                        Data._substituteNameSpecification(subcolumn.name, {
                            column: column.name,
                        });
                    subcolumn.tableRoles = column.tableRoles;
                    subcolumnSpecifications.push(subcolumn);
                });
                
                columnSpecifications.push({
                    name: column.name,
                    semanticType: column.type,
                    readOnly: column.readOnly,
                    order: column.order,
                    keyIndex: column.keyIndex,
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
                        order: 1,
                        keyIndex: null,
                        subcolumns: [{
                            name: [{
                                "type": "constant",
                                "value": item.name,
                            }],
                            tableRoles: [item.tableRole],
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
                    
                    _.each(subcolumn.tableRoles, function(tableRole) {
                        working[tableRole].columns.push({
                            name: subcolumnName,
                            type: subcolumn.sqlType,
                        });
                    });
                    
                    var backingColumn = {};
                    
                    _.each(subcolumn.tableRoles, function(tableRole) {
                        backingColumn[tableNames[tableRole]] = subcolumnName;
                    });
                    
                    backing.push(backingColumn);
                });
                
                entityOutput.columns.push({
                    name: columnSpecification.name,
                    allNames: [columnSpecification.name],
                    foreignNames: [{
                        entity: entityName,
                        name: columnSpecification.name,
                    }],
                    type: columnSpecification.semanticType,
                    readOnly: columnSpecification.readOnly,
                    order: columnSpecification.order,
                    keyIndex: columnSpecification.keyIndex,
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
        
        var unsortedEntityNames = [];
        _.each(Data._entities, function(entity, entityName) {
            unsortedEntityNames.push(entityName);
        });
        
        var sortedEntityNames = [];
        while(unsortedEntityNames.length > 0) {
            var anySortedThisStep = false;
            var i = 0;
            while(i < unsortedEntityNames.length) {
                var entityName = unsortedEntityNames[i];
                var entity = Data._entities[entityName];
                
                var canGoNext = true;
                _.each(entity.immediateExtends, function(extendedEntityName) {
                    if(!canGoNext) return;
                    if(!_.contains(sortedEntityNames, extendedEntityName)) {
                        canGoNext = false;
                        return;
                    }
                });
                
                if(canGoNext) {
                    sortedEntityNames.push(entityName);
                    unsortedEntityNames =
                        _.without(unsortedEntityNames, entityName);
                    anySortedThisStep = true;
                } else {
                    i++;
                }
            }
            
            if((unsortedEntityNames.length > 0) && !anySortedThisStep) {
                throw "Circular \"extends\" dependencies involving "
                    + "the entity \"" + unsortedEntityNames[0] + "\".";
            }
        }
        
        _.each(Data._entities, function(entity) {
            entity.recursiveExtends = Data._recursiveExtends(entity);
        });
        
        _.each(sortedEntityNames, function(entityName) {
            var entity = Data._entities[entityName];
            
            var prospectiveColumns = [];
            _.each(entity.recursiveExtends, function(extendedEntityName) {
                var extendedEntity = Data._entities[extendedEntityName];
                prospectiveColumns.push
                    (Data._deepCopy(extendedEntity.columns));
            });
            prospectiveColumns.push(entity.columns);
            prospectiveColumns = _.flatten(prospectiveColumns, true);
            
            var mergedColumns =  [];
            _.each(prospectiveColumns, function(column) {
                var found = false;
                _.each(mergedColumns, function(mergedColumn) {
                    if(found) return;
                    
                    var shouldMerge = false;
                    
                    _.each(column.allNames, function(columnName) {
                        if(shouldMerge) return;
                        
                        if(_.contains(mergedColumn.allNames, columnName)) {
                            shouldMerge = true;
                        }
                    });
                    
                    if(!shouldMerge
                       && !_.isNull(column.keyIndex)
                       && !_.isNull(mergedColumn.keyIndex)
                       && (column.keyIndex == mergedColumn.keyIndex))
                    {
                        shouldMerge = true;
                    }
                    
                    if(shouldMerge) {
                        found = true;
                        
                        mergedColumn.name = column.name;
                        
                        mergedColumn.allNames =
                            _.union(column.allNames, mergedColumn.allNames);
                        
                        mergedColumn.foreignNames =
                            _.flatten([column.foreignNames,
                                       mergedColumn.foreignNames], true);
                        
                        var mergedBacking = [];
                        _.each(mergedColumn.sql.backing,
                               function(mergedItem, index)
                        {
                            var mergedBackingItem =
                                _.extend({},
                                         mergedItem,
                                         column.sql.backing[index]);
                            mergedBacking.push(mergedBackingItem);
                        });
                        mergedColumn.sql.backing = mergedBacking;
                        
                        mergedColumn.readOnly |= column.readOnly;
                    }
                });
                
                if(!found) mergedColumns.push(column);
            });
            
            mergedColumns = _.sortBy(mergedColumns, "order");
            
            entity.columns = mergedColumns;
        });
        
        _.each(Data._entities, function(entity, entityName) {
            _.each(entity.columns, function(column) {
                column.readOnly = column.readOnly ? true : false;
                
                column.foreignNames =
                    _.reject(column.foreignNames, function(foreignName)
                {
                    return foreignName.entity == entityName;
                });
                
                delete column.allNames;
                delete column.order;
                delete column.keyIndex;
            });
            
            entity.joins = [];
            
            _.each(entity.recursiveExtends, function(extendedEntityName) {
                var extendedEntity = Data._entities[extendedEntityName];
                
                var keyColumnNames = [];
                var foreignKeyColumnNames = [];
                _.each(extendedEntity.key, function(extendedKeyColumnName) {
                    var found = false;
                    _.each(entity.columns, function(column) {
                        if(found) return;
                        
                        _.each(column.foreignNames, function(foreignName) {
                            if(found) return;
                            
                            if(foreignName.entity == extendedEntityName) {
                                keyColumnNames.push(column.name);
                                foreignKeyColumnNames.push(foreignName.name);
                                found = true;
                            }
                        });
                    });
                });
                
                entity.joins.push({
                    entity: extendedEntityName,
                    purpose: ["extends"],
                    columns: keyColumnNames,
                    foreignColumns: foreignKeyColumnNames,
                });
            });
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
        } else if(constructor == "uuid") {
            simple.sqlType = "blob";
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
        
        if(_.isString(parts)) {
            parts = [{
                type: "constant",
                value: parts,
            }];
        }
        
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
    
    _recursiveExtends: function(entity) {
        var Data = this;
        
        if(!_.isUndefined(entity.recursiveExtends)) {
            return entity.recursiveExtends;
        }
        
        var results = [];
        _.each(entity.immediateExtends, function(extendedEntityName) {
            var extendedEntity = Data._entities[extendedEntityName];
            results.push(Data._recursiveExtends(extendedEntity));
            results.push([extendedEntityName]);
        });
        results = _.flatten(results, true);
        
        entity.recursiveExtends = results;
        
        return results;
    },
    
    _deepCopy: function(structure) {
        var Data = this;
        
        if(_.isArray(structure)) {
            var result = [];
            _.each(structure, function(substructure) {
                result.push(Data._deepCopy(substructure));
            });
            return result;
        } else if(_.isObject(structure)) {
            var result = {};
            _.each(structure, function(substructure, key) {
                result[key] = Data._deepCopy(substructure);
            });
            return result;
        } else {
            return structure;
        }
    },
};

_.bindAll(Data);

module.exports = Data;

