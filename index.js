var Q = require('q');

module.exports = function(schema, options){

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
     * @param queries Array of promises that resolve to mongoose.Model instances.
     * @param recursive
     * @param cb
     * @returns {*|promise}
     */
    schema.methods.getChildren = function(recursive, cb){
        if(typeof recursive !== "boolean"){
            return Q.reject(new TypeError("first arg must be a boolean"));
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

    schema.pre('remove', function(next){
        if(!this.getChildren){next();}

        this.getChildren(true, function(err, children){
            if(err){
                next(err);
            } else if(!children){
                next();
            } else {
                var promises = [];
                children.forEach(function(child){
                    promises.push(child.remove());
                });
                Q.all(promises).then(next);
            }
        });
    });
};