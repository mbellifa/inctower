define(['incTower/core', 'lib/knockout'], function (incTower, ko) {
    'use strict';
    //This is a cursor object used for keeping track of building locations, spells etc.
    function Cursor(type, param, action, onMove) {
        this.type = type;
        this.param = param;
        var game = incTower.game;
        this.indicator = incTower.game.add.graphics(0,0);
        if (type === 'buy' || type === 'sell' || type === 'action') {
            //incTower.currentlySelectedIndicator.lineStyle(2, 0x66cc00, 3);
            this.indicator.beginFill(0x3333FF, 0.5);
            this.indicator.drawRect(0,0,32,32);
        }
        if (type === 'spell') {
            this.indicator.beginFill(0x760076, 0.5);
            this.indicator.drawCircle(0,0,incTower.spellAttributes[param].diameter);
        }
        this.indicator.x = incTower.game.input.x;
        this.indicator.y = incTower.game.input.y;
        this.action = action;
        this.onMove = onMove;
    }
    incTower.cursor = ko.observable(false);
    incTower.clearCursor = function () {
        if (incTower.cursor() !== false) {
            if (incTower.cursor().indicator) {
                incTower.cursor().indicator.destroy();
            }
            if (incTower.cursor().textIndicator) {
                incTower.cursor().textIndicator.destroy();
            }
        }
        incTower.cursor(false);
    };
    incTower.cursor.subscribe(function (oldValue) {
        if (oldValue !== false && oldValue.indicator) {
            oldValue.indicator.destroy();
        }
        if (oldValue !== false && oldValue.textIndicator) {
            oldValue.textIndicator.destroy();
        }

    }, null, 'beforeChange');


    return Cursor;

});
