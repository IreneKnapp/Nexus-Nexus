var amanda = require('amanda');
var fs = require('fs');
var _ = require('underscore');


function validateSpecification(specification) {
    if(!_.isObject(specification)) {
        console.log(specification);
        throw "Schema specification not an object.";
    }
    
    validateUUID(specification.id);
    for(var tableName in specification.tables) {
        validateTableName(tableName);
        validateTable(specification, tableName,
                      specification.tables[tableName]);
    }
    
    var unknownKeys = _.difference(_.keys(specification), ['id', 'tables']);
    if(unknownKeys.length > 0) {
        console.log(unknownKeys);
        throw "Unexpected keys in top level of schema specification.";
    }
}


function validateTableName(tableName) {
    if(!_.isString(tableName)) {
        console.log(tableName);
        throw "Table name not a string.";
    }
    
    if(tableName.length = 0) {
        throw "Table name is the empty string.";
    }
}


function validateTable(specification, tableName, table) {
    if(!_.isObject(specification)) {
        console.log(tableName);
        console.log(table);
        throw "Table specification not an object.";
    }
    
    if(!_.isObject(table.columns)) {
        console.log(tableName);
        console.log(table.columns);
        throw "Table specification columns field not an object.";
    }
    
    for(var columnName in table.columns) {
        validateColumnName(columnName);
        validateColumn(specification, tableName, table, columnName,
                       table.columns[columnName]);
    }
    
    if(!_.isArray(table.constraints)) {
        console.log(tableName);
        console.log(table.constraints);
        throw "Table specification constraints field not an array.";
    }
    
    for(var i in table.constraints) {
        validateTableConstraint(specification, tableName, table,
                                table.constraints[i]);
    }
    
    var unknownKeys = _.difference(_.keys(table), ['columns', 'constraints']);
    if(unknownKeys.length > 0) {
        console.log(tableName);
        console.log(unknownKeys);
        throw "Unexpected keys in table specification.";
    }
}


function validateColumnName(columnName) {
    if(!_.isString(columnName)) {
        console.log(columnName);
        throw "Column name not a string.";
    }
    
    if(columnName.length = 0) {
        throw "Column name is the empty string.";
    }
}


function validateColumn(specification, tableName, table, columnName, column) {
    if(!_.isObject(column)) {
        console.log(tableName);
        console.log(columnName);
        console.log(column);
        throw "Column specification not an object.";
    }
    
    validateTypeReference(column.type);
    
    if(!_.isUndefined(column.read_only)) {
        validateBoolean(column.read_only);
    }
    
    if(!_.isUndefined(column.constraints)) {
        if(!_.isArray(column.constraints)) {
            console.log(tableName);
            console.log(columnName);
            console.log(column.constraints);
            throw "Column specification constraints field not an array.";
        }
        
        for(var i in column.constraints) {
            validateColumnConstraint(specification, tableName, table,
                                     columnName, column,
                                     column.constraints[i]);
        }
    }
    
    var unknownKeys = _.difference(_.keys(column), ['type', 'constraints',
                                                    'read_only']);
    if(unknownKeys.length > 0) {
        console.log(tableName);
        console.log(columnName);
        console.log(unknownKeys);
        throw "Unexpected keys in column specification.";
    }
}


function validateColumnConstraint(specification, tableName, table, columnName,
                                  column, constraint)
{
    if(!_.isObject(constraint)) {
        console.log(tableName);
        console.log(columnName);
        console.log(constraint);
        throw "Column-constraint specification not an object.";
    }
    
    if(!_.isString(constraint.type)) {
        console.log(tableName);
        console.log(columnName);
        console.log(constraint.type);
        throw "Column-constraint specification type field not a string.";
    }
    
    if(constraint.type == "primary_key") {
        var unknownKeys = _.difference(_.keys(constraint), ['type']);
        if(unknownKeys.length > 0) {
            console.log(tableName);
            console.log(columnName);
            console.log(unknownKeys);
            throw "Unexpected keys in primary-key column-constraint "
                  + "specification.";
        }
    } else if(constraint.type == "foreign_key") {
        validateTableName(constraint.foreign_table);
        
        if(tableName == constraint.foreign_table) {
            console.log(tableName);
            console.log(columnName);
            console.log(constraint.foreign_table);
            throw "Foreign-key column constraint references the table it "
                  + "belongs to.";
        }
        
        var foreignTable = specification.tables[constraint.foreign_table];
        if(_.isUndefined(foreignTable)) {
            console.log(tableName);
            console.log(columnName);
            console.log(constraint.foreign_table);
            throw "Foreign-key column constraint references nonexistent table.";
        }
        
        if(!_.isArray(constraint.foreign_columns)) {
            console.log(tableName);
            console.log(columnName);
            console.log(constraint.foreign_columns);
            throw "Foreign-key column constraint foreign-columns field "
                  + "not an array.";
        }
        
        for(var i in constraint.foreign_columns) {
            var foreignColumnName = constraint.foreign_columns[i];
            validateColumnName(foreignColumnName);
            if(_.isUndefined(foreignTable.columns[foreignColumnName])) {
                console.log(tableName);
                console.log(columnName);
                console.log(foreignColumnName);
                throw "Foreign-key column constraint column "
                      + "not in the referenced table.";
            }
        }
        
        var unknownKeys = _.difference(_.keys(constraint),
                                       ['type', 'foreign_table',
                                        'foreign_columns']);
        if(unknownKeys.length > 0) {
            console.log(tableName);
            console.log(columnName);
            console.log(unknownKeys);
            throw "Unexpected keys in foreign-key column-constraint "
                  + "specification.";
        }
    } else {
        console.log(tableName);
        console.log(columnName);
        console.log(constraint.type);
        throw "Column-constraint specification type field not a known value.";
    }
}


function validateTableConstraint(specification, tableName, table, constraint) {
    if(!_.isObject(constraint)) {
        console.log(tableName);
        console.log(constraint);
        throw "Table-constraint specification not an object.";
    }
    
    if(!_.isString(constraint.type)) {
        console.log(tableName);
        console.log(constraint.type);
        throw "Table-constraint specification type field not a string.";
    }
    
    if(constraint.type == "primary_key") {
        if(!_.isArray(constraint.columns)) {
            console.log(tableName);
            console.log(constraint.columns);
            throw "Primary-key table constraint columns field not an array.";
        }
        
        for(var i in constraint.columns) {
            var columnName = constraint.columns[i];
            validateColumnName(columnName);
            if(_.isUndefined(table.columns[columnName])) {
                console.log(tableName);
                console.log(columnName);
                throw "Primary-key table constraint column not in this table.";
            }
        }
        
        var unknownKeys = _.difference(_.keys(constraint), ['type', 'columns']);
        if(unknownKeys.length > 0) {
            console.log(tableName);
            console.log(unknownKeys);
            throw "Unexpected keys in primary-key table-constraint "
                  + "specification.";
        }
    } else if(constraint.type == "foreign_key") {
        if(!_.isArray(constraint.columns)) {
            console.log(tableName);
            console.log(constraint.columns);
            throw "Foreign-key table constraint columns field not an array.";
        }
        
        for(var i in constraint.columns) {
            var columnName = constraint.columns[i];
            validateColumnName(columnName);
            if(_.isUndefined(table.columns[columnName])) {
                console.log(tableName);
                console.log(columnName);
                throw "Foreign-key table constraint column not in this table.";
            }
        }
        
        validateTableName(constraint.foreign_table);
        
        if(tableName == constraint.foreign_table) {
            console.log(tableName);
            console.log(constraint.foreign_table);
            throw "Foreign-key table constraint references the table it "
                  + "belongs to.";
        }
        
        var foreignTable = specification.tables[constraint.foreign_table];
        if(_.isUndefined(foreignTable)) {
            console.log(tableName);
            console.log(constraint.foreign_table);
            throw "Foreign-key table constraint references nonexistent table.";
        }
        
        if(!_.isArray(constraint.foreign_columns)) {
            console.log(tableName);
            console.log(constraint.foreign_columns);
            throw "Foreign-key table constraint foreign-columns field "
                  + "not an array.";
        }
        
        for(var i in constraint.foreign_columns) {
            var columnName = constraint.foreign_columns[i];
            validateColumnName(columnName);
            if(_.isUndefined(foreignTable.columns[columnName])) {
                console.log(tableName);
                console.log(columnName);
                throw "Foreign-key table constraint column "
                      + "not in the referenced table.";
            }
        }
        
        var unknownKeys = _.difference(_.keys(constraint),
                                       ['type', 'columns', 'foreign_table',
                                        'foreign_columns']);
        if(unknownKeys.length > 0) {
            console.log(tableName);
            console.log(columnName);
            console.log(unknownKeys);
            throw "Unexpected keys in foreign-key table-constraint "
                  + "specification.";
        }
    } else {
        console.log(tableName);
        console.log(constraint.type);
        throw "Table-constraint specification type field not a known value.";
    }
}


function validateTypeReference(reference) {
    if(_.isString(reference)) {
        reference = [reference];
    }
    
    if(!_.isArray(reference)) {
        console.log(reference);
        throw "Type reference not a string or array.";
    }
    
    if(reference.length == 0) {
        console.log(reference);
        throw "Type reference is an empty array.";
    }
    
    var head = reference[0];
    var arity;
    if(head == "integer") arity = 0;
    else if(head == "text") arity = 0;
    else if(head == "blob") arity = 0;
    else if(head == "uuid") arity = 0;
    else if(head == "timestamp") arity = 0;
    else if(head == "boolean") arity = 0;
    else if(head == "password") arity = 0;
    else if(head == "email") arity = 0;
    else if(head == "array") arity = 1;
    else if(head == "maybe") arity = 1;
    else {
        console.log(head);
        throw "Unrecognized type constructor name.";
    }
    
    if(reference.length != arity + 1) {
        console.log(head);
        console.log(reference.length);
        throw "Incorrect arity for given type constructor.";
    }
    
    for(var i in reference) {
        if(i == 0) continue;
        validateTypeReference(reference[i]);
    }
}


function validateBoolean(boolean) {
    if(!_.isBoolean(boolean)) {
        console.log(boolean);
        throw "Boolean not one.";
    }
}


function validateInteger(integer) {
    if(!_.isInteger(integer)) {
        console.log(integer);
        throw "Integer not one.";
    }
}


function validateUUID(uuid) {
    if(!_.isString(uuid)) {
        console.log(uuid);
        throw "UUID not a string.";
    }
    
    var pattern = "^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-"
                  + "[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$";
    var regexp = new RegExp(pattern);
    if(!uuid.match(regexp)) {
        console.log(uuid);
        throw "UUID in invalid syntax.";
    }
}


function validateSelect(select) {
    if(!_.isObject(select)) {
        console.log(select);
        throw "Select specification not an object.";
    }
    
    validateSelectCore(select.core);
    
    if(!_.isUndefined(select.order)) {
        validateOrder(select.order);
    }
    
    if(!_.isUndefined(select.limit)) {
        validateLImit(select.limit);
    }
    
    var unknownKeys = _.difference(_.keys(select), ['core', 'order', 'limit']);
    if(unknownKeys.length > 0) {
        console.log(unknownKeys);
        throw "Unexpected keys in select specification.";
    }
}


function validateSelectCore(selectCore) {
}


function validateOrder(order) {
    if(!_.isArray(order)) {
        console.log(order);
        throw "Oder specification not an array.";
    }
}


function validateLimit(limit) {
    if(!_.isArray(limit)) {
        limit = [limit];
    }
    
    if(limit.length == 0) {
        throw "Empty array for limit specification.";
    }
    
    if(limit.length > 2) {
        console.log(limit);
        throw "Array longer than 2 items for limit specification.";
    }
    
    validateExpression("integer", limit[0]);
    
    if(limit.length > 1) {
        validateExpression("integer", limit[1]);
    }
}


function validateExpression(type, expression) {
    if(_.isArray(expression)) {
        throw "Unimplemented.";
    } else {
        var head;
        if(_.isArray(type)) head = type[0];
        else head = type;
        
        if(head == "integer") {
            validateInteger(expression);
        } else if(head == "uuid") {
            validateUUID(expression);
        } else {
            throw "Unimplemented.";
        }
    }
}


var schema = {
    initialized: false,
    
    initialize: function() {
        if(schema.initialized) return;
        schema.initialized = true;
        
        schema.validator = amanda("json");
        schema.metaschema =
            JSON.parse(fs.readFileSync("./schemas/schema.json", "utf8"));
    },
    
    load: function(filename) {
        schema.initialize();
        
        var specification = JSON.parse(fs.readFileSync(filename, "utf8"));
        console.log(schema.metaschema);
        schema.validator.validate(specification, schema.metaschema,
        function(error) {
            console.log(error);
            throw "Invalid schema.";
        });
        schema.specification = specification;
        var id = schema.specification.id;
        var sql = schema.getSelectSQL({
        });
        //var sql = schema.getInsertValuesSQL("schema", ["schema_id"], [[id]]);
        console.log(sql);
    },
    
    getID: function() {
        return schema.specification.id;
    },
    
    getTableNames: function() {
        var result = [];
        for(var name in schema.specification.tables) {
            result.push(name);
        }
        return result;
    },
    
    getCreateTableSQL: function(tableName) {
        var table = schema.specification.tables[tableName];
        
        var sql = "CREATE TABLE " + tableName + " (\n";
        
        var items = [];
        for(var columnName in table.columns) {
            var column = table.columns[columnName];
            
            var translations = {
                "integer": "integer",
                "text": "text",
                "blob": "blob",
                "uuid": "blob",
                "timestamp": "integer",
                "boolean": "integer",
                "password": "blob",
                "email": "text",
            };
            
            var reference = column.type;
            
            if(_.isString(reference)) {
                reference = [reference];
            }
            
            var head = reference[0];
            
            var type;
            var columnConstraintsSQL = [];
            if(!_.isUndefined(translations[head])) {
                type = translations[head];
                columnConstraintsSQL.push("NOT NULL");
            } else if(column.type == "array") {
                type = translations[reference[1]];
                columnConstraintsSQL.push("NOT NULL");
            } else if(column.type == "maybe") {
                type = translations[reference[1]];
            }
            
            for(var i in column.constraints) {
                var constraint = column.constraints[i];
                
                if(constraint.type == "primary_key") {
                    columnConstraintsSQL.push("PRIMARY KEY");
                } else if(constraint.type == "foreign_key") {
                    var constraintSQL = "REFERENCES "
                        + constraint.foreign_table + " (";
                    var first = true;
                    for(var i in constraint.foreign_columns) {
                        if(!first) constraintSQL += ", ";
                        constraintSQL += constraint.foreign_columns[i];
                        first = false;
                    }
                    constraintSQL += ")";
                    columnConstraintsSQL.push(constraintSQL);
                }
            }
            
            var item = columnName + " " + type;
            for(var i in columnConstraintsSQL) {
                item += " " + columnConstraintsSQL[i];
            }
            
            items.push(item);
        }
        
        for(var i in table.constraints) {
            var constraint = table.constraints[i];
            
            if(constraint.type == "primary_key") {
                var constraintSQL = "PRIMARY KEY (";
                
                var first = true;
                for(var j in constraint.columns) {
                    if(!first) constraintSQL += ", ";
                    constraintSQL += constraint.columns[j];
                    first = false;
                }
                
                constraintSQL += ")";
                
                items.push(constraintSQL);
            } else if(constraint.type == "foreign_key") {
                var constraintSQL = "FOREIGN KEY (";
                
                var first = true;
                for(var j in constraint.columns) {
                    if(!first) constraintSQL += ", ";
                    constraintSQL += constraint.columns[j];
                    first = false;
                }
                
                constraintSQL += ") REFERENCES " + constraint.foreign_table
                                 + " (";
                
                var first = true;
                for(var j in constraint.foreign_columns) {
                    if(!first) constraintSQL += ", ";
                    constraintSQL += constraint.foreign_columns[j];
                    first = false;
                }
                constraintSQL += ")";
                
                items.push(constraintSQL);
            }
        }
        
        var first = true;
        for(var i in items) {
            if(!first) sql += ",\n";
            sql += "  " + items[i];
            first = false;
        }
        
        sql += "\n);";
        return sql;
    },
    
    getSelectSQL: function(select) {
        validateSelect(select);
    },
    
    getInsertValuesSQL: function(tableName, columnNames, values) {
        var table = schema.specification.tables[tableName];
        
        if(_.isUndefined(table)) {
            console.log(tableName);
            throw "No such table.";
        }
        
        for(var i in columnNames) {
            if(_.isUndefined(table.columns[columnNames[i]])) {
                console.log(tableName);
                console.log(columnNames[i]);
                throw "No such column.";
            }
        }
        
        sql = "INSERT INTO " + tableName + " (";
        
        var first = true;
        for(var i in columnNames) {
            if(!first) sql += ", ";
            
            sql += columnNames[i];
            
            first = false;
        }
        
        sql += ") VALUES ";
        
        var firstRow = true;
        for(var i in values) {
            var rowValues = values[i];
            
            if(!firstRow) sql += ", ";
            sql += "(";
            
            var firstColumn = true;
            for(var j in rowValues) {
                var value = rowValues[j];
                var column = table.columns[columnNames[j]];
                
                if(!firstColumn) sql += ", ";
                
                validateExpression(column.type, value);
                sql += schema.getExpressionSQL(column.type, value);
                
                firstColumn = false;
            }
            
            sql += ")";
            
            firstRow = false;
        }
        
        sql += ";";
        return sql;
    },
    
    getExpressionSQL: function(type, expression) {
        if(_.isArray(expression)) {
            throw "Unimplemented.";
        } else {
            var head;
            if(_.isArray(type)) head = type[0];
            else head = type;
            
            if(head == "uuid") {
                return "x'" + expression.replace(/-/g, "") + "'";
            } else {
                throw "Unimplemented.";
            }
        }
    },
};

module.exports = schema;
