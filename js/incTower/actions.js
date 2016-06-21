define(['incTower/core', 'lib/knockout', 'lib/bignumber', 'incTower/path', 'incTower/cursor'], function (incTower, ko, BigNumber, pathModule, Cursor) {
    'use strict';
    var tileSquare = 32;
    incTower.availableActions = ko.observableArray([]);
    incTower.actionAttributes = {
        template: {
            describe: function () {
                return 'Spend gold to scrap a tower to gain blueprint points for towers of that type. Blueprint points increase the starting damage for the given tower type by 1 and increase starting gold cost by 5 per point.';
            },
            keybind: 'B',
            perform: function (pointer, action) {
                var tileX = Math.floor(pointer.worldX / tileSquare);
                var tileY = Math.floor(pointer.worldY / tileSquare);
                console.log(tileX);
                if (tileX > 24 || tileY > 18) {
                    return false;
                }
                if (tileX === 0 && tileY === 0) {
                    return false;
                }
                if (!pathModule.tileForbidden[tileX][tileY]) {
                    return false;
                }
                //Don't allow templating at one tower
                if (incTower.numTowers() === 1) {
                    return false;
                }

                _.forEach(incTower.towers_group.children, function (tower) {
                    if (tower.tileX === tileX && tower.tileY === tileY) {
                        var blueprints = tower.totalDamage().sqrt().times(1 + 0.05 * incTower.getEffectiveSkillLevel('refinedBlueprints'));
                        incTower.incrementObservable(incTower.towerBlueprints[tower.towerType], blueprints);
                        incTower.destroyTower(tower);
                        return false;
                    }
                });

            },
            onMove: function (x, y) {
                var tileX = Math.floor(x / tileSquare);
                var tileY = Math.floor(y / tileSquare);
                //console.log([x,y]);
                var valid = true;
                if (valid && (tileX > 24 || tileY > 18)) {
                    valid = false;
                }
                if (tileX === 0 && tileY === 0) {
                    valid = false;
                }
                if (!pathModule.tileForbidden[tileX][tileY]) {
                    valid = false;
                }
                if (valid !== this.currentIndicatorStatus || tileX !== this.lastTileX || tileY !== this.lastTileY) {
                    this.indicator.clear();

                    if (valid) {
                        //this.indicator.beginFill(0x33FF33, 0.5);
                        this.indicator.beginFill(0x3333FF, 0.5);
                        if (!this.textIndicator) {
                            this.textIndicator = incTower.game.add.text(0, 0, "", {
                                font: "14px Arial",
                                stroke: 'white',
                                strokeThickness: 1,
                                fontWeight: "bold",
                                fill: '#0000EE',
                                align: "center"
                            });
                        }
                        this.textIndicator.alpha = 1;
                        var blueprints = 0;
                        var totalBlueprints = 0;
                        _.forEach(incTower.towers_group.children, function (tower) {
                            if (tower.tileX === tileX && tower.tileY === tileY) {
                                blueprints = tower.totalDamage().sqrt().times(1 + 0.05 * incTower.getEffectiveSkillLevel('refinedBlueprints'));
                                totalBlueprints = blueprints.plus(incTower.towerAttributes[tower.towerType].blueprintPoints());
                                return false;
                            }
                        });

                        this.textIndicator.text = '+' + incTower.humanizeNumber(blueprints) + ' (' + incTower.humanizeNumber(totalBlueprints) + ')';

                    } else {
                        if (this.textIndicator !== undefined) {
                            this.textIndicator.alpha = 0;
                        }
                        this.indicator.beginFill(0x760076, 0.5);
                    }
                    this.indicator.drawRect(0, 0, 32, 32);
                    this.currentIndicatorStatus = valid;
                    this.lastTileX = tileX;
                    this.lastTileY = tileY;
                }

            }
        }
    };
    incTower.castAction = function (action) {
        var curCursor = incTower.cursor();
        //If our cursor already holds this spell then cancel it.
        if (curCursor !== false && curCursor.type === 'action' && curCursor.param === action) {
            incTower.clearCursor();
            return;
        }
        
        incTower.cursor(new Cursor('action', action, 
            function (pointer) {
                incTower.actionAttributes[action].perform(pointer, action);
            },
            incTower.actionAttributes[action].onMove
        ));
    };
});
