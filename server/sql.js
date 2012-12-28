var DirectSchema = require('direct-schema');
var FS = require('fs');
var _ = require('underscore');

var SQL = {};

SQL.initialized = false;

SQL.load = function(filename) {
    var SQL = this;

    if(!SQL.initialized) {
        SQL.initialized = true;
        var metaschema =
            JSON.parse(FS.readFileSync
                ("./json-schemas/database.json-schema.json", "utf8"));
        SQL.validator = DirectSchema(metaschema);
    }
    
    var specification = JSON.parse(FS.readFileSync(filename, "utf8"));
    SQL.validator(specification,
    function(error) {
        console.log(error);
        throw "Invalid schema.";
    });
    return _.extend({
    specification: specification,
    }, SQL.template);
};

SQL.template = {
    getID: function() {
        var SQL = this;
        return SQL.specification.id;
    },
    
    getTableNames: function() {
        var SQL = this;
        var result = [];
        for(var name in SQL.specification.tables) {
            result.push(name);
        }
        return result;
    },
    
    getCreateTableSQL: function(tableName) {
        var SQL = this;
        var table = SQL.specification.tables[tableName];
        
        var text = "CREATE TABLE " + tableName + " (\n";
        
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
            if(!first) text += ",\n";
            text += "  " + items[i];
            first = false;
        }
        
        text += "\n);";
        return text;
    },
    
    getSelectSQL: function(select) {
        var SQL = this;
        //validateSelect(select);
    },
    
    getInsertValuesSQL: function(tableName, columnNames, values) {
        var SQL = this;
        var table = SQL.specification.tables[tableName];
        
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
        
        text = "INSERT INTO " + tableName + " (";
        
        var first = true;
        for(var i in columnNames) {
            if(!first) text += ", ";
            
            text += columnNames[i];
            
            first = false;
        }
        
        text += ") VALUES ";
        
        var firstRow = true;
        for(var i in values) {
            var rowValues = values[i];
            
            if(!firstRow) text += ", ";
            text += "(";
            
            var firstColumn = true;
            for(var j in rowValues) {
                var value = rowValues[j];
                var column = table.columns[columnNames[j]];
                
                if(!firstColumn) text += ", ";
                
                validateExpression(column.type, value);
                text += SQL.getExpressionSQL(column.type, value);
                
                firstColumn = false;
            }
            
            text += ")";
            
            firstRow = false;
        }
        
        text += ";";
        return text;
    },
    
    getExpressionSQL: function(type, expression) {
        var SQL = this;
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

_.bindAll(SQL);

module.exports = SQL;

