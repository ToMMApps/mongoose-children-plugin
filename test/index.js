describe("index", function () {
    var mongoose = require('mongoose');
    var mockgoose = require('mockgoose');
    var expect = require('expect.js');
    var Q = require('q');
    var sinon = require('sinon');

    mockgoose(mongoose);

    var plugin = require('../index');

    before(function (done) {
        mongoose.connect('mongodb://localhost/test', function (error) {
            if (error) throw error; // Handle failed connection
            done();
        });
    });

    var sandbox;

    beforeEach(function () {
        sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
        sandbox.restore();
    });

    afterEach(function () {
        mockgoose.reset();

        delete mongoose.connection.models['parent'];
        delete mongoose.connection.models['child'];
        delete mongoose.connection.models['childOfChild'];
    });

    function multipleDone(expectedTimes, done){
        var _expectedTimes = expectedTimes;
        var _counter = 0;

        return function () {
            _counter++;

            if(_counter === _expectedTimes){
                done();
            } else if(_counter > expectedTimes){
                throw new Error("done called too often");
            }
        }
    }
    
    it("should resolve an empty array if the options array is empty", function (done) {
        var ParentSchema = mongoose.Schema({});

        var multiDone = multipleDone(4, done);

        ParentSchema.plugin(plugin, []);

        var ParentModel =  mongoose.model('parent', ParentSchema);

        (new ParentModel({})).save(function (err, instance) {
            instance.getChildren(false, function (err, result) {
                expect(err).to.be(null);
                expect(result).to.have.length(0);
                multiDone();
            });

            instance.getChildren(false).then(function (result) {
                expect(result).to.have.length(0);
                multiDone();
            });

            instance.getChildren(true, function (err, result) {
                expect(err).to.be(null);
                expect(result).to.have.length(0);
                multiDone();
            });

            instance.getChildren(true).then(function (result) {
                expect(result).to.have.length(0);
                multiDone();
            });
        })


    });

    it("should resolve children of children", function (done) {
        var multiDone = multipleDone(2, done);

        var ChildOfChildSchema = mongoose.Schema({
            parent: {
                type: mongoose.Schema.ObjectId,
                ref: 'child',
                required: true
            }
        });
        var ChildSchema = mongoose.Schema({
            parent: {
                type: mongoose.Schema.ObjectId,
                ref: 'parent',
                required: true
            }
        });
        var ParentSchema = mongoose.Schema({});

        ParentSchema.plugin(plugin, [{
            model: 'child', conditions: {parent: "this.id"}
        }]);
        ChildSchema.plugin(plugin, [{
            model: 'childOfChild', conditions: {parent: "this.id"}
        }]);
        ChildOfChildSchema.plugin(plugin, []);

        var ParentModel =  mongoose.model('parent', ParentSchema);
        var ChildModel = mongoose.model('child', ChildSchema);
        var ChildOfChildModel = mongoose.model('childOfChild', ChildOfChildSchema);

        var parent = new ParentModel({});

        parent.save(function (err, savedParent) {
            var child = new ChildModel({parent: savedParent.id});
            child.save(function (err, savedChild) {
                var childOfChild = new ChildOfChildModel({parent: savedChild.id});
                childOfChild.save(function (err, savedChildOfChild) {
                    savedParent.getChildren(false, function (err, result) {
                        expect(err).to.be(null);
                        expect(result).to.have.length(1);
                        expect(result[0].id).to.eql(savedChild.id);
                        multiDone();
                    });

                    savedParent.getChildren(false).then(function (result) {
                        expect(result).to.have.length(1);
                        expect(result[0].id).to.eql(savedChild.id);
                        multiDone();
                    });

                    savedParent.getChildren(true, function (err, result) {
                        expect(result).to.have.length(2);
                        expect(result[0].id).to.eql(savedChild.id);
                        expect(result[1].id).to.eql(savedChildOfChild.id);
                        multiDone();
                    });

                    savedParent.getChildren(true).then(function (result) {
                        expect(result).to.have.length(2);
                        expect(result[0].id).to.eql(savedChild.id);
                        expect(result[1].id).to.eql(savedChildOfChild.id);
                        multiDone();
                    });
                });
            });
        });
    });

    it("should delete children", function (done) {

        var ChildOfChildSchema = mongoose.Schema({
            parent: {
                type: mongoose.Schema.ObjectId,
                ref: 'child',
                required: true
            }
        });
        var ChildSchema = mongoose.Schema({
            parent: {
                type: mongoose.Schema.ObjectId,
                ref: 'parent',
                required: true
            }
        });
        var ParentSchema = mongoose.Schema({});

        ParentSchema.plugin(plugin, [{
            model: 'child', conditions: {parent: "this.id"}
        }]);
        ChildSchema.plugin(plugin, [{
            model: 'childOfChild', conditions: {parent: "this.id"}
        }]);
        ChildOfChildSchema.plugin(plugin, []);

        var ParentModel =  mongoose.model('parent', ParentSchema);
        var ChildModel = mongoose.model('child', ChildSchema);
        var ChildOfChildModel = mongoose.model('childOfChild', ChildOfChildSchema);

        var parent = new ParentModel({});
        
        parent.save(function (err, savedParent) {
            var child = new ChildModel({parent: savedParent.id});
            child.save(function (err, savedChild) {
                var childOfChild = new ChildOfChildModel({parent: savedChild.id});
                childOfChild.save(function (err, savedChildOfChild) {
                    savedParent.remove(function () {
                        
                        Q.all([
                            ParentModel.find().exec(),
                            ChildModel.find().exec(),
                            ChildOfChildModel.find().exec()
                        ]).then(function (results) {
                            expect(results[0]).to.have.length(0);
                            expect(results[1]).to.have.length(0);
                            expect(results[2]).to.have.length(0);
                            done();
                        }).catch(console.error);
                    });
                });
            });
        });
    });
});