//Contains keybinds and mouse events.
define(['lib/phaser', 'incTower/core', 'incTower/basic-actions'], function (Phaser, incTower) {
    'use strict';
    return {
        setInputHandlers: function (game) {
            game.input.addMoveCallback(function(pointer, x, y) {
                // pointer returns the active pointer, x and y return the position on the canvas
                if (!incTower.cursor()) { return; }
                var cursor = incTower.cursor();
                if (cursor.type === 'buy' || cursor.type === 'sell' || cursor.type === 'action') {
                    cursor.indicator.x = Math.floor(x / 32) * 32;
                    cursor.indicator.y = Math.floor(y / 32) * 32;
                } else {
                    cursor.indicator.x = x;
                    cursor.indicator.y = y;
                }
                if (cursor.onMove !== undefined) {
                    cursor.onMove.call(cursor,x,y);
                }
                if (cursor.textIndicator !== undefined) {
                    cursor.textIndicator.x = cursor.indicator.x;
                    cursor.textIndicator.y = Math.max(0, cursor.indicator.y - 16);
                }
            });
            // Keybinds
            var qKey = game.input.keyboard.addKey(Phaser.Keyboard.Q);
            qKey.onDown.add(incTower.buyBlock, game);
            var towerKeys = [Phaser.Keyboard.W, Phaser.Keyboard.E, Phaser.Keyboard.R, Phaser.Keyboard.T,
                Phaser.Keyboard.Y, Phaser.Keyboard.U];

            _.forEach(towerKeys, function(towerKey, index) {
                var tempKey = game.input.keyboard.addKey(towerKey);
                tempKey.onDown.add(function () {
                    var key = incTower.availableTowers()[index];
                    if (key !== undefined) {
                        incTower.buyTower(key);
                    }
                }, game);
            });
            var spellKeys = [Phaser.Keyboard.ONE, Phaser.Keyboard.TWO, Phaser.Keyboard.THREE, Phaser.Keyboard.FOUR,
                Phaser.Keyboard.FIVE, Phaser.Keyboard.SIX, Phaser.Keyboard.SEVEN, Phaser.Keyboard.EIGHT,
                Phaser.Keyboard.NINE, Phaser.Keyboard.ZERO];

            _.forEach(spellKeys, function(spellKey, index) {
                var tempKey = game.input.keyboard.addKey(spellKey);
                tempKey.onDown.add(function () {
                    var key = incTower.availableSpells()[index];
                    if (key !== undefined) {
                        incTower.castSpell(key);
                    }
                }, game);
            });

            var sKey = game.input.keyboard.addKey(Phaser.Keyboard.S);
            sKey.onDown.add(incTower.sellTool, game);

            var bKey = game.input.keyboard.addKey(Phaser.Keyboard.B);
            bKey.onDown.add(function () {
                if (incTower.availableActions.indexOf('template') >= 0) {
                    incTower.castAction('template');
                }
            }, game);

            var lKey = game.input.keyboard.addKey(Phaser.Keyboard.L);
            lKey.onDown.add(incTower.cheapestUpgrade, game);
            
            var escKey = game.input.keyboard.addKey(Phaser.Keyboard.ESC);
            escKey.onDown.add(function () {
                if (incTower.cursor()) {
                    incTower.clearCursor();
                } else {
                    incTower.currentlySelected(null);
                }
            }, game);


            game.input.onDown.add(function (pointer) {
                if (!incTower.cursor()) { return; }
                incTower.cursor().action(pointer);
            });
            game.input.mouse.mouseOutCallback = function() {
                if (!incTower.cursor()) { return; }
                incTower.cursor().indicator.alpha = 0;
                if (incTower.cursor().textIndicator !== undefined) {
                    incTower.cursor().textIndicator.alpha = 0;
                }
                if (incTower.pathProspectiveGraphic !== undefined) {
                    incTower.pathProspectiveGraphic.clear();
                }

            };
            game.input.mouse.mouseOverCallback = function() {
                if (!incTower.cursor()) { return; }
                incTower.cursor().indicator.alpha = 1;
                if (incTower.cursor().textIndicator !== undefined) {
                    incTower.cursor().textIndicator.alpha = 1;
                }
            };
        }
    };

});
