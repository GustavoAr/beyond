function Behavior(module, specs) {
    "use strict";

    if (typeof specs !== 'object') {
        console.error('Invalid specification', specs);
        throw new Error('Invalid control specifications');
    }
    if (typeof specs.react !== 'string' && (
        typeof specs.react !== 'object' ||
        (typeof specs.react.control !== 'string' && typeof specs.react.control !== 'function'))) {
        console.error('Invalid react specification', specs);
        throw new Error('Invalid react specification');
    }
    if (typeof specs.sna !== 'function') {
        console.error('Invalid sna specification', specs);
        throw new Error('Invalid sna specification');
    }

    var ready;
    // Do not use ready as this.ready is reserved to polymer
    Object.defineProperty(this, 'isReady', {
        'get': function () {
            return !!ready;
        }
    });

    function onDependenciesReady() {

        var dependencies = module.dependencies.modules;

        var sna = specs.sna(dependencies);

        // Check for already set properties
        for (var name in specs.properties) {
            var spec = specs.properties[name];
            if (spec.observer && this[name]) {

                if (!sna[spec.observer]) {
                    console.error('sna must implement observer function "' + spec.observer +
                        '" as is declared in the property "' + name + '"');
                    continue;
                }
                sna[spec.observer](this[name]);

            }
        }

        this._setSNA(sna);

        var react = {};
        if (typeof specs.react === 'string') {
            react.item = module.react.items[specs.react];
            react.properties = {'sna': sna};
        }
        else {

            if (typeof specs.react.control === 'string') {
                react.item = module.react.items[specs.react.control];
            }
            else {
                react.item = specs.react.control;
            }

            if (typeof specs.react.properties === 'object') {
                react.properties = specs.react.properties;
            }
            else if (typeof specs.react.properties === 'function') {
                react.properties = specs.react.properties();
            }

            if (typeof react.properties !== 'object') {
                react.properties = {};
            }

            react.properties.sna = sna;

        }

        if (!react.item) {
            console.error('Invalid react item, check specification', specs);
            throw new Error('Invalid react item');
        }

        var ReactDOM = dependencies.ReactDOM;

        react.element = module.React.createElement(react.item, react.properties);
        ReactDOM.render(react.element, this);

        ready = true;
        for (var i in callbacks) {
            callbacks[i]();
        }
        callbacks = undefined;
        this.fire('ready');

    }

    var callbacks = [];
    this.done = function (callback) {

        if (ready) {
            callback();
            return;
        }

        callbacks.push(callback);

    };

    /**
     * Polymer method executed when properties are set and local DOM is initialized.
     */
    this.ready = function () {

        var coordinate = new Coordinate(
            'dependencies',
            'react',
            Delegate(this, onDependenciesReady));

        module.dependencies.done(coordinate.dependencies);
        module.react.done(coordinate.react);

    };

    this._onSNAChanged = function () {

        var sna = this._sna;
        if (!sna.state) {
            return;
        }

        for (var name in specs.properties) {

            var spec = specs.properties[name];
            if (spec.stateSource) {

                var value = sna.state[spec.stateSource];

                if (value === this[name]) {
                    continue;
                }

                if (spec.readOnly) {

                    var method = '_set' +
                        name.substr(0, 1).toUpperCase() +
                        name.substr(1);

                    this[method](value);

                }
                else {
                    this[name] = value;
                }

            }

        }

    };

    this._setSNA = function (value) {

        if (this._sna) {
            throw new Error('sna is already defined');
        }
        this._sna = value;

        this._sna.bind('change', Delegate(this, this._onSNAChanged));
        this._onSNAChanged();

    };

    var setObserver = Delegate(this, function (name, property, observer) {

        var method = '_set' + name.substr(0, 1).toUpperCase() + name.substr(1) + 'Changed';
        property.observer = method;

        // Executed when property changed
        this[method] = function (value) {

            if (!this._sna) {
                return;
            }

            if (typeof this._sna[observer] !== 'function') {
                console.error('sna must implement observer function "' + observer +
                    '" as is declared in the property "' + name + '"');
                return;
            }

            this._sna[observer](value);

        };

    });

    this.properties = {};
    for (var name in specs.properties) {

        var spec = specs.properties[name];
        var property = {};

        if (!spec.stateSource) {
            console.error('Property "' + name + '" does not specify the stateSource attribute');
            continue;
        }

        if (spec.type) {
            property.type = spec.type;
        }

        if (spec.observer) {
            setObserver(name, property, spec.observer);
        }

        spec.readOnly = !spec.observer;
        property.readOnly = spec.readOnly;

        property.notify = !!spec.notify;

        this.properties[name] = property;

    }

    function onMethodExecuted(name) {

        if (!this._sna) {
            throw new Error('sna not set, wait for control to be ready');
        }

        if (typeof this._sna[name] !== 'function') {
            throw new Error('sna must implement method "' + name + '"');
        }

        var args = [].slice.call(arguments);
        args.shift();

        return this._sna[name].apply(this._sna, args);

    }

    for (var index in specs.methods) {

        var method = specs.methods[index];
        (function (behavior, method) {

            behavior[method] = function () {

                var args = [].slice.call(arguments);
                args.unshift(method);
                return onMethodExecuted.apply(this, args);

            };

        })(this, method);

    }

}
