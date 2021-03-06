require('colors');

module.exports = require('async')(function *(resolve, reject, modules, specs, path, runtime) {
    "use strict";

    if (typeof specs !== 'object') {
        console.log('Invalid applications build configuration'.red);
        resolve();
        return;
    }

    let applications = modules.applications;

    for (let name in specs) {

        console.log('building application "'.green + (name).bold.green + '"');

        let application = applications.items[name];
        if (!application) {
            console.log('\tApplication "'.red + (name).red.bold + '" is not registered'.red);
            continue;
        }

        let success = yield require('./application')(application, specs[name], runtime);
        if (!success) {
            continue;
        }

    }

    // write an empty line in the console
    console.log('');

    resolve();

});
