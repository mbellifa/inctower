define(["incTower/core", 'lib/jquery', 'lib/jquery.qtip'], function (incTower, $) {
    'use strict';
    var tooltips = {};
    tooltips.init = function () {
        $(document).on('mouseover', '.tooltip', function(event) {
            var tooltip = $(this).qtip({
                overwrite: true,
                content: {
                    attr: 'data-tooltip'
                },
                position: {
                    viewport: $(window)
                },
                style: {
                    classes: 'qtip-dark'
                },
                show: {
                    event: event.type,
                    ready: true
                },
                hidden: function(event, api) {
                    api.destroy(true); // http://stackoverflow.com/a/22092019
                }
            }, event);
            $(document).data('last_tooltip_creator', tooltip);
        });
    };
    incTower.checkTooltips = function () {
        var activeTooltips = $('.qtip:visible .qtip-content');
        //No visible tooltips
        if (activeTooltips.length === 0) { return; }
        var owner = $(document).data('last_tooltip_creator');
        if (owner.attr('data-tooltip') !== activeTooltips.html()) {
            activeTooltips.html(owner.attr('data-tooltip'));
        }
    };
    tooltips.checkTooltips = incTower.checkTooltips;
    return tooltips;

});
