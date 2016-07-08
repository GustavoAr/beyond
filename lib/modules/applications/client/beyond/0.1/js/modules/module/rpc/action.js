function Action(module, events) {
    "use strict";

    return function (actionPath, params) {

        if (!actionPath || typeof actionPath !== 'string') {
            console.error('Invalid action path:', actionPath);
            return;
        }

        var request = new Request(module, actionPath, params);
        var holder;

        var cache = new Cache();
        this.cache = false;

        var timers = {};
        this.holdersTimeout = 20000;
        this.ackTimeout = 2000;
        this.responseTimeout = 5000;

        var channel;

        var error;
        Object.defineProperty(this, 'error', {
            'get': function () {
                return error;
            }
        });

        var ERROR_CODE = Object.freeze({
            'EXECUTION': 1,
            'TIMEOUT': 2,
            'PRE_EXECUTION': 3
        });
        this.ERROR_CODE = ERROR_CODE;

        var TIMEOUT_REASON = Object.freeze({
            'PRE_EXECUTION': 1,
            'ACKNOWLEDGE': 2,
            'WAITING_RESPONSE': 3
        });

        beyond.ACTION_ERROR_CODE = ERROR_CODE;
        beyond.ACTION_TIMEOUT_REASON = TIMEOUT_REASON;

        var executing;
        Object.defineProperty(this, 'executing', {
            'get': function () {
                return !!executing;
            }
        });

        var executed;
        Object.defineProperty(this, 'executed', {
            'get': function () {
                return !!executed;
            }
        });

        // The acknowledge id received from the server
        var id;

        this.getFromCache = function () {

            if (!request) {
                console.error('Request not correctly specified');
                return;
            }

            var cached = cache.read(request);
            if (cached) {

                var item;
                try {
                    item = JSON.parse(cached);
                }
                catch (exc) {

                    console.error('error parsing cached item:', cached);

                    // remove item to avoid this error on future requests
                    cache.invalidate(request);

                    // consider as if cache has never existed, continue and make the RPC request
                    item = undefined;

                }

                return item.value;

            }

        };

        var execute = Delegate(this, function (holderError) {

            clearTimeout(timers.holders);

            if (holderError) {

                if (!executing) return;
                executing = false;
                error = {
                    'code': ERROR_CODE.PRE_EXECUTION,
                    'data': holderError
                };

                console.error('Holder error', holderError);
                if (typeof this.onError === 'function') this.onError(error);
                return;

            }

            if (typeof this.ackTimeout === 'number') {

                timers.ack = setTimeout(Delegate(this, function () {

                    if (!executing) return;
                    executing = false;
                    error = {
                        'code': ERROR_CODE.TIMEOUT,
                        'reason': TIMEOUT_REASON.ACKNOWLEDGE
                    };

                    console.error('Acknowledge timeout error on action "' + request.action + '"');
                    if (typeof this.onError === 'function') this.onError(error);

                }), this.ackTimeout);

            }

            channel.emit('rpc', request.serialized, Delegate(this, function (acknowledgeID) {

                // Action was timed out before the acknowledge arrived
                clearTimeout(timers.ack);
                if (!executing) return;

                timers.response = setTimeout(Delegate(this, function () {

                    if (!executing) return;
                    executing = false;
                    error = {
                        'code': ERROR_CODE.TIMEOUT,
                        'reason': TIMEOUT_REASON.WAITING_RESPONSE
                    };

                    console.error('Timeout error on action "' + request.action + '"');
                    if (typeof this.onError === 'function') this.onError(error);

                }), this.responseTimeout);

                if (typeof acknowledgeID !== 'string' || !acknowledgeID) {
                    console.error('Invalid acknowledge id.');
                    return;
                }

                id = acknowledgeID;
                if (typeof this.onAcknowledge === 'function') this.onAcknowledge();

            }));

        });

        this.execute = function (callback) {

            if (executing || executed) {
                console.error('Action can only be executed once');
                return;
            }
            executing = true;

            if (!request) {
                console.error('Request not correctly specified');
                return;
            }

            if (this.cache) {
                var cached = this.getFromCache();
                if (cached) {
                    callback(cached)
                    return;
                }
            }

            if (typeof this.holdersTimeout === 'number') {

                timers.holders = setTimeout(Delegate(this, function () {

                    executing = false;
                    error = {
                        'code': ERROR_CODE.TIMEOUT,
                        'reason': TIMEOUT_REASON.PRE_EXECUTION
                    };
                    holder.cancel();

                    // At least one RPC holder did not release the implementation of the action.
                    console.error('Holders timeout error on action "' + request.action + '"');
                    if (typeof this.onError === 'function') this.onError(error);

                }), this.holdersTimeout);

            }

            // holder allows hooks to hold the actions to be executed
            // if for some reason, the interceptor interprets that the channel is not ready
            // the interceptor can use the hooker as follows
            //      holder.push('reason');
            //      holder.done('reason');
            // when there are no reasons to hold the execution, then the callback is call
            // and the action is consequently executed
            holder = new Holder(request, events, execute);
            holder.push('channel');

            module.channel(function (value) {
                channel = value;
                holder.release('channel');
            });

        };

        var onResponse = Delegate(this, function (response) {

            // Check if response refers to this action
            if (response.id !== id) return;
            if (!executing) return;

            executing = false;
            executed = true;

            executed = true;
            clearTimeout(timers.response);

            if (response.error) {

                error = {
                    'code': ERROR_CODE.EXECUTION,
                    'data': response.error
                };

                console.error('Execution error on action "' + request.action + '".', response.error);
                if (typeof this.onError === 'function') this.onError(error);
                return;

            }

            if (this.cache) {
                cache.save(request, response.message);
            }

            if (typeof this.onResponse === 'function') this.onResponse(response.message);

            if (module.library) module.library.unbind('response', onResponse);
            else beyond.unbind('response', onResponse);

        });

        if (module.library) module.library.bind('response', onResponse);
        else beyond.bind('response', onResponse);

    }

}