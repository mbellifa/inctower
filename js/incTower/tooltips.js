define(["incTower/core", 'lib/lodash'], function (incTower, _) {
    'use strict';
    var tooltips = {};
    tooltips.hoverOffTimeFunc = _.debounce(function () {
        if (tooltips.activeTooltip.style.display === 'block') {
            tooltips.activeTooltip.style.display = 'none';
        }
    }, 150);
    tooltips.describedElement = undefined; // Current element having a tooltip displayed on it
    tooltips.init = function () {
        tooltips.activeTooltip = document.createElement('div');
        tooltips.activeTooltip.className = 'active-tooltip';
        tooltips.activeTooltip.style.display = 'none';
        tooltips.activeTooltip.style.position = 'absolute';

        document.body.appendChild(tooltips.activeTooltip);
        document.addEventListener('mouseover', _.debounce(function (e) {
            var element = e.target;
            while (true) {
                if (element === null) { break; }
                if (element.className.indexOf('tooltip') > -1) {
                    tooltips.describedElement = element;
                    tooltips.hoverOffTimeFunc.cancel();
                    tooltips.activeTooltip.innerHTML = element.getAttribute('data-tooltip');
                    if (tooltips.activeTooltip.style.display !== 'block') {
                        tooltips.activeTooltip.style.display = 'block';
                    }
                    var buffer = 15;
                    var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
                    var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
                    var scrollTop = (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop;
                    var left = Math.min(e.pageX + buffer, w - 280);
                    if (e.pageX + buffer > w - 280) {
                        left = e.pageX - (300 + buffer);
                    }

                    left = Math.max(left, 0);
                    var tooltipHeight = getComputedStyle(tooltips.activeTooltip).height;
                    tooltipHeight = parseInt(tooltipHeight.replace('px',''));
                    var top = Math.min(e.pageY + buffer, h + scrollTop - (tooltipHeight + 15));
                    top = Math.max(top, 0);
                    tooltips.activeTooltip.style.top = top + 'px';
                    tooltips.activeTooltip.style.left = left + 'px';
                    break;
                }
                element = element.parentElement;
            }
        }, 25), false);
        document.addEventListener('mouseout', function (e) {
            var element = e.target;
            while (true) {
                if (element === null) { break; }
                if (element === tooltips.activeTooltip) {
                    tooltips.hoverOffTimeFunc();
                    break;
                }
                if (element.className.indexOf('tooltip') > -1) {
                    tooltips.hoverOffTimeFunc();
                    break;
                }
                element = element.parentElement;
            }

        });
    };
    incTower.checkTooltips = function () {
        _.delay(function () {
            if (tooltips.activeTooltip.style.display !== 'block') {
                return;
            }
            if (tooltips.describedElement.offsetParent === null) {
                tooltips.activeTooltip.style.display = 'none';
                tooltips.describedElement = undefined;
            } else {
                tooltips.activeTooltip.innerHTML = tooltips.describedElement.getAttribute('data-tooltip');
            }
        }, 50);
    };
    tooltips.checkTooltips = incTower.checkTooltips;
    return tooltips;

});
