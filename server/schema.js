var directSchema = require('direct-schema');
var fs = require('fs');
var _ = require('underscore');


var schema = {
    initialized: false,
    
    initialize: function() {
        if(schema.initialized) return;
        schema.initialized = true;
        
        schema.metaschema =
            JSON.parse(fs.readFileSync("./schemas/schema.json", "utf8"));
        schema.validator = directSchema(schema.metaschema);
    },
    
    load: function(filename) {
        schema.initialize();
        
        var specification = JSON.parse(fs.readFileSync(filename, "utf8"));
        schema.validator(specification,
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
        //validateSelect(select);
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
