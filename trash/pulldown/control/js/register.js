(function () {
    "use strict";

    function ExampleBehavior() {

        var control;

        this.created = function () {
            control = this;
        };

        this.setCoolAttribute = function (value) {
            console.log('cool attribute is set', value);
        };

        this.properties = {
            'coolAttribute': {
                'type': String,
                'observer': 'setCoolAttribute'
            }
        };

    }

    module.controls.define('PullDown', {
        'create': function () {

            var sna = new SNA();

            var List = react.list;
            return module.React.createElement(List, {'sna': sna});

        },
        'behaviors': [new ExampleBehavior]
    });

})();
