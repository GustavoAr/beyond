function Page($container, parameter, dependencies) {
    "use strict";

    this.preview = function () {

        $container.attr('id', 'pulldown-page');
        $container.html(module.render('index', module.texts));

        var control = $container.find('beyond-pulldown-control').get(0);
        control.parentScroller = null;

    };

}
