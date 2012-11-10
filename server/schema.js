var fs = require('fs');
var _ = require('underscore');
var types = require('./types.js');


function validateSpecification(specification) {
    if(!_.isObject(specification)) {
        console.log(specification);
        throw "Schema specification not an object.";
    }
    
    validateUUID(specification.id);
    for(var tableName in specification.tables) {
        validateTableName(tableName);
        validateTable(specification, tableName, specification.tables[tableName]);
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
        validateColumn(specification, tableName, table, columnName, table.columns[columnName]);
    }
    
    if(!_.isArray(table.constraints)) {
        console.log(tableName);
        console.log(table.constraints);
        throw "Table specification constraints field not an array.";
    }
    
    for(var i in table.constraints) {
        validateTableConstraint(specification, tableName, table, table.constraints[i]);
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
            validateColumnConstraint(specification, tableName, table, columnName, column, column.constraints[i]);
        }
    }
    
    var unknownKeys = _.difference(_.keys(column), ['type', 'constraints', 'read_only']);
    if(unknownKeys.length > 0) {
        console.log(tableName);
        console.log(columnName);
        console.log(unknownKeys);
        throw "Unexpected keys in column specification.";
    }
}


function validateColumnConstraint(specification, tableName, table, columnName, column, constraint) {
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
            throw "Unexpected keys in primary-key column-constraint specification.";
        }
    } else if(constraint.type == "foreign_key") {
        validateTableName(constraint.foreign_table);
        
        if(tableName == constraint.foreign_table) {
            console.log(tableName);
            console.log(columnName);
            console.log(constraint.foreign_table);
            throw "Foreign-key constraint references the table it belongs to.";
        }
        
        var unknownKeys = _.difference(_.keys(constraint),
                                       ['type', 'foreign_table', 'foreign_columns']);
        if(unknownKeys.length > 0) {
            console.log(tableName);
            console.log(columnName);
            console.log(unknownKeys);
            throw "Unexpected keys in foreign-key column-constraint specification.";
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
    } else if(constraint.type == "foreign_key") {
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


var schema = {
  load: function(filename) {
      var specification = JSON.parse(fs.readFileSync(filename, "utf8"));
      validateSpecification(specification);
      schema.specification = specification;
  },
  
  getID: function() {
      return schema.id;
  },
  
  getTableNames: function() {
      var result = [];
      for(var name in schema.specification.tables) {
          result.push(name);
      }
      return result;
  },
};

module.exports = schema;
