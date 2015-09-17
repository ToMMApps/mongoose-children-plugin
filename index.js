var Q = require('q');

/**
 *
 * @param schema
 * @param options Array of child definitions. For Example: {"model": "project", conditions: {"user": "this.id"}}. These properties
 * will be used to search for the child.
 */
module.exports = function(schema, options){

    /**
     * Generates queries for child elements based on the overhanded options array.
     * @returns {Array}
     */
    function generateQueries(){
        var mongoose = require("mongoose");
        var queries = [];
        var self = this;

        options.forEach(function(option){
            var conditions = {};

            Object.keys(option.conditions).forEach(function(key){

                if(typeof option.conditions[key] === "string"){
                    conditions[key] = evaluateCondition.call(self, option.conditions[key]);
                } else {
                    conditions[key] = option.conditions[key];
                }
            });

            queries.push(mongoose.model(option.model).find(conditions).exec());
        });

        function evaluateCondition(condition){
            var result = condition;
            try{
                result = eval(condition);
            } catch(e){}

            return result;
        }

        return queries;
    }

    /**
     * Executes the overhanded queries and tries to call getChildren on the resolved elements if recursive is set to true.
     * Can be used, for example, to collect all entries that belong to an user.
     * Be aware that this technique does have a bad performance and should therefore not be used quite often.
     * A model that has no children should call this method with an empty queries array.
     * @param recursive
     * @param cb
     * @returns {*|promise}
     */
    schema.methods.getChildren = function(recursive, cb){
        if(typeof recursive !== "boolean"){
            var err = new TypeError("first arg must be a boolean");
            if(cb) cb(err);
            return Q.reject(err);
        }

        var queries = generateQueries.apply(this);

        return Q.all(queries).then(function(queryResults){
            var merged = [];
            merged = merged.concat.apply(merged, queryResults);

            if(!recursive){
                if(cb) cb(null, merged);
                return Q(merged);
            } else {
                var queries = merged.map(function(e){
                    if(!e.getChildren){
                        return Q([]);
                    } else {
                        return e.getChildren(true);
                    }
                });

                return Q.all(queries).then(function(queryResults){
                    merged = merged.concat.apply(merged, queryResults);
                    var cleaned = merged.filter(function(item, pos, self) {
                        return self.indexOf(item) == pos;
                    });
                    if(cb) cb(null, cleaned);
                    return Q(cleaned);
                });
            }
        });
    };

    /**
     * Removes all children on remove.
     */
    schema.pre('remove', function(next){
        if(!this.getChildren){next();}

        this.getChildren(false, function(err, children){
            if(err){
                next(err);
            } else if(!children){
                next();
            } else {
                var promises = [];
                children.forEach(function(child){
                    function remove(){
                        var deferred = Q.defer();
                        child.remove(function (err) {
                            if(err){
                                deferred.reject(err);
                            } else {
                                deferred.resolve();
                            }
                        });

                        return deferred.promise;
                    }

                    promises.push(remove());
                });
                Q.all(promises).then(function () {
                    next();
                }, function (err) {
                    next(err);
                });
            }
        });
    });
};