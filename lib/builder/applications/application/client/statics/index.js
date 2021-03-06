// Compile application static resources
module.exports = require('async')(function *(resolve, reject, application, path, language) {
    "use strict";

    let save = require('../../../../fs/save');
    let copy = require('../../../../fs/copy');

    console.log('\tcopying static files'.green);

    yield application.static.process(language);
    for (let key of application.static.keys) {

        let file = application.static.items[key];
        let target = require('path').join(path, key);

        if (file.type === 'file') {
            yield copy.file(file.file, target);
        }
        else if (file.type === 'content') {
            yield save(target, file.content);
        }

    }

    resolve();

});
