# Mongoose-Children-Plugin
Automatically resolves children of mongoose models.

Installation
--------------

```
npm install mongoose-children-plugin
```

Usage
------------

Assume you have two models: project and file.

```
var ProjectSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'user',
        required: true
    }
});
var FileSchema = mongoose.Schema({
    basename: {
        required: true,
        type: String
    },
    project: {
        required: true,
        type: mongoose.Schema.ObjectId,
        ref: 'project'
    }
});
```

A file does belong to a project; is a child of a project. The plugin must be configured in the parent object:

```
ProjectSchema.plugin(require('mongoose-children-plugin'), [
    {model: 'file', conditions: {project: "this.id"}}
]);
```

The plugin expects an array of model definitions. Each definition must specify the name of the model and conditions on how
to query for children.
When configured this way, calling getChildren on a project instance would resolve to an array of file instances which project attribute
equals the id of the parent project.

This can be done recursively, so if file would define children of its own, those children would be resolved, too, when calling getChildren on a project instance.

Code-Quality
--------------

Code-coverage can be calculated by running "npm run cover" and npm test runs all mocha tests. 