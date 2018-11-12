define(['incTower/core', 'lib/knockout', 'lib/bignumber', 'lib/phaser', 'incTower/path', 'lib/lodash', 'incTower/cursor', 'incTower/util'], function (incTower, ko, BigNumber, Phaser, path, _, Cursor) {
    'use strict';
    BigNumber.config({
        ERRORS: false,
        POW_PRECISION: 100
    });
    var tileSquare = 32;
    var incrementObservable = incTower.incrementObservable;
    incTower.availableTowers = ko.observableArray(['kinetic']);
    incTower.numTowers = ko.pureComputed(function () {
        return incTower.towers().length || 0;
    });
    incTower.towerMaxDamage = {};
    incTower.towers = ko.observableArray([]);
    incTower.towerBlueprints = {};
    incTower.sellTowerPer = ko.pureComputed(function () {
        return 0.5 + (0.05 * incTower.getEffectiveSkillLevel('scrapping'));
    });

    incTower.buyTower = function (type) {
        if (type === undefined) {
            type = 'kinetic';
        }
        var cost = incTower.towerCost(type);
        if (incTower.gold().gt(cost)) {
            console.log("Setting cursor to " + type);
            var curCursor = incTower.cursor();
            //If our cursor already holds this spell then cancel it.
            if (curCursor !== false && curCursor.type === 'buy' && curCursor.param === type) {
                incTower.clearCursor();
                return;
            }
            incTower.cursor(new Cursor('buy', type, function (pointer) {
                var tileX = Math.floor(pointer.worldX / tileSquare);
                var tileY = Math.floor(pointer.worldY / tileSquare);
                console.log(tileX + ', ' + tileY);
                if (tileX > 24 || tileY > 18) {
                    return;
                }
                var towerType = incTower.cursor().param;
                var cost = incTower.towerCost(towerType);
                var tileIndex = incTower.core.map.layers[0].data[tileY][tileX].index;
                if (!path.tileForbidden[tileX][tileY] && incTower.gold().gte(cost) && tileIndex >= 1 && tileIndex <= 4) {
                    var opt = {};
                    opt.towerType = towerType;
                    opt.cost = cost;
                    Tower.prototype.posit(pointer, opt);
                    incrementObservable(incTower.gold, -cost);
                }
            }, function (x, y) {
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
                if (valid) {
                    var tileIndex = incTower.core.map.layers[0].data[tileY][tileX].index;
                    if (tileIndex > 4) {
                        valid = false;
                    }
                }
                if (path.tileForbidden[tileX][tileY]) {
                    valid = false;
                }
                if (valid !== this.currentIndicatorStatus || tileX !== this.lastTileX || tileY !== this.lastTileY) {
                    this.indicator.clear();
                    var towerType = incTower.cursor().param;
                    var cost = incTower.towerCost(towerType);

                    if (valid) {
                        //this.indicator.beginFill(0x33FF33, 0.5);
                        this.indicator.beginFill(0x3333FF, 0.5);
                        if (!this.textIndicator) {
                            this.textIndicator = incTower.game.add.text(0, 0, "", {
                                font: "14px Arial",
                                stroke: 'white',
                                strokeThickness: 1,
                                fontWeight: "bold",
                                fill: '#C9960C',
                                align: "center"
                            });
                        }
                        this.textIndicator.alpha = 1;
                        this.textIndicator.text = '-' + incTower.humanizeNumber(cost) + 'g';
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


            }));
        } else {
            incTower.clearCursor();
        }
    };
    incTower.totalTowerDamage = ko.pureComputed(function () {
        var tally = new BigNumber(0);
        var towerLength = incTower.numTowers();
        for (var i = 0; i < towerLength; ++i) {
            var tower = incTower.towers_group.getAt(i);
            tally = tally.plus(tower.totalDamage());
        }
        return tally;
    }).extend({ deferred: true });
    incTower.averageDamage = ko.pureComputed(function () {
        var tally = new BigNumber(0);
        var towerLength = incTower.numTowers();
        for (var i = 0; i < towerLength; ++i) {
            var tower = incTower.towers_group.getAt(i);
            tally = tally.plus(tower.totalDamage());
        }
        return tally.div(incTower.numTowers());
    });
    incTower.cheapestUpgradeCostTower = ko.pureComputed(function () {
        var cheapest = -1;
        var retTower;
        _.forEach(incTower.towers(), function (tower) {
            var cost = tower.upgradeCost();
            if (retTower === undefined || cost.lt(cheapest)) {
                cheapest = cost;
                retTower = tower;
            }
        });
        return retTower;
    });
    incTower.cheapestUpgradeCost = ko.pureComputed(function () {
        var tower = incTower.cheapestUpgradeCostTower();
        if (tower) {
            return tower.upgradeCost();
        }
        return 0;
    });
    incTower.cheapestUpgradeAll = function () {
        'use strict';
        var start = performance.now();

        var gold = incTower.gold();
        var gold_share = gold.div(incTower.numTowers());
        console.log("Gold share: " + incTower.humanizeNumber(gold_share));
        var memoize = {};
        var memoizedUpgradeCost = function (type, level) {
            var key = type + ":" + level;
            if (memoize[key] === undefined) {
                memoize[key] = calculateTowerUpgradeCost(type, level);
            }
            return memoize[key];
        };
        var towerUpgradeCache = {};
        incTower.towers_group.forEach(function (tower) {
            if (towerUpgradeCache[tower.towerType] === undefined) {
                towerUpgradeCache[tower.towerType] = {}
            }
            var byLevel = 1;
            var cost = tower.remainingUpgradeCost();
            var prosLevel = tower.level() + 1;
            if (towerUpgradeCache[tower.towerType][prosLevel] !== undefined) {
                byLevel = towerUpgradeCache[tower.towerType][prosLevel].byLevel;
                cost = cost.plus(towerUpgradeCache[tower.towerType][prosLevel].cost);
            }
            while (cost.lte(gold_share)) {
                byLevel++;
                cost = cost.plus(memoizedUpgradeCost(tower.towerType, prosLevel + byLevel - 1));
            }
            while (cost.gt(gold_share)) {
                cost = cost.minus(memoizedUpgradeCost(tower.towerType, prosLevel + byLevel - 1));
                byLevel--;
                if (byLevel < 1) {
                    return;
                }
            }
            console.log("Upgrading tower by " + byLevel + " for cost " + incTower.humanizeNumber(cost));

            towerUpgradeCache[tower.towerType][prosLevel] = {'byLevel': byLevel, 'cost': cost};
            tower.payToUpgrade(byLevel, cost);
        });
        incTower.autoUpgrade = true;
        var end = performance.now();
        console.log("Upgrade took " + (end - start) + "ms");
    };


    incTower.createTower = function (opts) {
        new Tower(opts);
    };
    incTower.ammoAttributes = {
        bullet: {
            name: 'Bullet',
            describe: function () {
                return 'These basic bullets have a medium range and inflict kinetic damage.';
            },
            collision: function (tower, bullet, enemy) {
                enemy.assignDamage(bullet.damage, 'kinetic');
            }
        },
        shrapnel: {
            name: 'Shrapnel Rounds',
            describe: function () {
                return 'These rounds explode once they penetrate causing intense internal bleeding. They deal less kinetic damage upfront but always cause a bleed for a significant portion of the damage.';
            },
            icon: 'blood-icon.png',
            damageModifier: 0.5, //Does 50% of normal kinetic damage.
            collision: function (tower, bullet, enemy) {
                var damageAssigned = enemy.assignDamage(bullet.damage, 'kinetic');
                incrementObservable(enemy.statusEffects.bleeding, damageAssigned.times(0.5));
            }
        },
        sniper: {
            name: 'Sniper',
            describe: function () {
                return 'These long range bullets deal greater at large range but take longer to reload.';
            },
            damageModifier: 1.5, //Does 150% of normal kinetic damage.
            rangeModifier: 1.5,
            reloadModifier: 2,
            collision: function (tower, bullet, enemy) {
                var damageAssigned = enemy.assignDamage(bullet.damage, 'kinetic');
            }
        },
        arcaneOrb: { //TODO: Implement
            name: 'Arcane Orb',
            describe: function () {
                return 'Fires an Arcane Orb which deals arcane damage and grants 1 mana on-hit.';
            },
            icon: 'arcane-element.png',
            bulletSprite: 'arcane-bullet.png',
            collision: function (tower, bullet, enemy) {
                enemy.assignDamage(bullet.damage, 'arcane');
                if (incTower.mana().lt(incTower.maxMana())) {
                    incrementObservable(incTower.mana, 1);
                }
            }
        },
        /*
         if (towerType === 'fire' || towerType === 'water' || towerType === 'air' || towerType === 'earth') {
         }
*/
        airOrb: {
            name: 'Air Orb',
            describe: function () {
                return "Fires a air orb which deals earth damage and has a chance to attach a air rune to an enemy.";
            },
            icon: 'air-element.png',
            collision: function (tower, bullet, enemy) {
                enemy.assignDamage(bullet.damage, 'air');
                var chance = 0.10; //10% base chance of applying a rune
                chance += (0.05 * incTower.getEffectiveSkillLevel('airRuneApplication')); //increases by 5% per rank in the relevant skill
                var runesAdded = enemy.addElementalRunesDiminishing('air', chance);
                if (runesAdded > 0) {
                    enemy.addElementalRunesDiminishing('air',0.05 * incTower.getEffectiveSkillLevel('airAdvancedRuneApplication'));
                }

            }
        },

        earthOrb: {
            name: 'Earth Orb',
            describe: function () {
                return "Fires a fire orb which deals earth damage and has a chance to attach a earth rune to an enemy.";
            },
            icon: 'earth-element.png',
            collision: function (tower, bullet, enemy) {
                enemy.assignDamage(bullet.damage, 'earth');
                var chance = 0.10; //10% base chance of applying a rune
                chance += (0.05 * incTower.getEffectiveSkillLevel('earthRuneApplication')); //increases by 5% per rank in the relevant skill
                var runesAdded = enemy.addElementalRunesDiminishing('earth', chance);
                if (runesAdded > 0) {
                    enemy.addElementalRunesDiminishing('earth',0.05 * incTower.getEffectiveSkillLevel('earthAdvancedRuneApplication'));
                }
            }

        },
        fireOrb: {
            name: 'Fire Orb',
            describe: function () {
                return "Fires a fire orb which deals fire damage and has a chance to attach a fire rune to an enemy.";
            },
            icon: 'fire-element.png',
            collision: function (tower, bullet, enemy) {
                enemy.assignDamage(bullet.damage, 'fire');
                var chance = 0.10; //10% base chance of applying a rune
                chance += (0.05 * incTower.getEffectiveSkillLevel('fireRuneApplication')); //increases by 5% per rank in the relevant skill
                var runesAdded = enemy.addElementalRunesDiminishing('fire', chance);
                if (runesAdded > 0) {
                    enemy.addElementalRunesDiminishing('fire',0.05 * incTower.getEffectiveSkillLevel('fireAdvancedRuneApplication'));
                }
            }
        },
        waterOrb: {
            name: 'Water Orb',
            describe: function () {
                return "Fires a water orb which deals fire damage and has a chance to attach a water rune to an enemy.";
            },
            icon: 'water-element.png',
            collision: function (tower, bullet, enemy) {
                enemy.assignDamage(bullet.damage, 'water');
                var chance = 0.10; //10% base chance of applying a rune
                chance += (0.05 * incTower.getEffectiveSkillLevel('waterRuneApplication')); //increases by 5% per rank in the relevant skill
                var runesAdded = enemy.addElementalRunesDiminishing('water', chance);
                if (runesAdded > 0) {
                    enemy.addElementalRunesDiminishing('water',0.05 * incTower.getEffectiveSkillLevel('waterAdvancedRuneApplication'));
                }
            }
        },
        airCatalyst: {
            name: 'Air Catalyst',
            describe: function () {
                return "Consumes air runes to knock back enemies in an area.";
            },
            icon: 'air-element.png',
            collision: function (tower, bullet, enemy) {
                var airRunes = enemy.consumeRunes('air');
                var originX = enemy.x;
                var originY = enemy.y;
                var minX = Math.max(0, originX - 32 * airRunes);
                var maxX = Math.min(800, originX + 32 * airRunes);
                var minY = Math.max(0, originY - 32 * airRunes);
                var maxY = Math.min(608, originY + 32 * airRunes);
                var tweenLength = Math.max(500, Math.min(1500, 250 * airRunes - 1));

                var destTileNum = Math.floor(Math.max(0, enemy.curTile - Math.max(1, airRunes)));
                var kbX = enemy.path[destTileNum].x * 32 + 16; //Knock back X and Y
                var kbY = enemy.path[destTileNum].y * 32 + 16;
                var impactedEnemies = [];
                for (var i = 0; i < incTower.enemys.children.length; i++) {
                    if (!incTower.enemys.children[i].alive) {
                        continue;
                    }
                    if (incTower.enemys.children[i].x >= minX && incTower.enemys.children[i].x <= maxX && incTower.enemys.children[i].y >= minY && incTower.enemys.children[i].y <= maxY) {
                        impactedEnemies.push(incTower.enemys.children[i]);
                    }
                }
                var airDamage = bullet.damage.times(Math.pow(1.2, Math.max(0, airRunes - 1)));

                for (var i = 0; i < impactedEnemies.length; i++) {
                    impactedEnemies[i].assignDamage(airDamage, 'air');
                    if (!impactedEnemies[i].heavy && impactedEnemies[i].alive) {
                        impactedEnemies[i].knockback = true;
                        impactedEnemies[i].animations.paused = true;
                        impactedEnemies[i].curTile = destTileNum;
                        impactedEnemies[i].addDiminishingReturns('air', airRunes * 3);
                        var tweenModifier = 1;
                        if (impactedEnemies[i].flying) {
                            tweenModifier = 2;
                        }
                        var tweenTo = {
                            angle: ['+90', '+180', '+270', '+360'],
                            x: [maxX, maxX, minX, minX],
                            y: [minY, maxY, maxY, minY]
                        };
                        //If we are in the air twice as long we spin around twice instead of once.
                        if (tweenModifier === 2) {
                            tweenTo.angle = tweenTo.angle.concat(tweenTo.angle);
                            tweenTo.x = tweenTo.x.concat(tweenTo.x);
                            tweenTo.y = tweenTo.y.concat(tweenTo.y);
                        }
                        tweenTo.angle.push('+450');
                        tweenTo.x.push(kbX + incTower.game.rnd.integerInRange(-16, 16));
                        tweenTo.y.push(kbY + incTower.game.rnd.integerInRange(-16, 16));
                        var knockbackTween = incTower.game.add.tween(impactedEnemies[i]).to(tweenTo, tweenLength * tweenModifier, "Sine.easeInOut", false);
                        knockbackTween.onComplete.add(function () {
                            this.knockback = false;
                            this.nextTile();
                        }, impactedEnemies[i]);
                        knockbackTween.interpolation(Phaser.Math.bezierInterpolation);
                        knockbackTween.start();
                    }
                }

            }
        },
        earthCatalyst: {
            name: 'Earth Catalyst',
            describe: function () {
                return "Consumes earth runes to summon a giant boulder from the sky, crushing enemies in an area and causing them to bleed.";
            },
            icon: 'earth-element.png',
            collision: function (tower, bullet, enemy) {
                var earthRunes = enemy.consumeRunes('earth');
                var boulder = incTower.game.add.sprite(enemy.x, enemy.y, 'incTower', 'rock' + incTower.game.rnd.integerInRange(1, 3) + '.png');
                boulder.anchor.setTo(0.5, 0.5);
                incTower.game.physics.enable(boulder, Phaser.Physics.ARCADE);
                var bigDim = boulder.width;
                if (boulder.height > bigDim) {
                    bigDim = boulder.height;
                }
                var endWidth = Math.max(tileSquare * earthRunes * 0.5, tileSquare);
                var startWidth = endWidth * 4;
                boulder.damageOnImpact = bullet.damage.times(Math.pow(1.2, Math.max(0, earthRunes - 1)));
                boulder.scale.x = startWidth / bigDim;
                boulder.scale.y = startWidth / bigDim;

                var boulderTween = incTower.game.add.tween(boulder.scale).to({
                    x: endWidth / bigDim,
                    y: endWidth / bigDim
                }, 500, Phaser.Easing.Quadratic.In, true);
                boulderTween.onComplete.add(function () {
                    incTower.game.physics.arcade.overlap(this, incTower.enemys, function (boulder, enemy) {
                        enemy.assignDamage(boulder.damageOnImpact, 'earth');
                        enemy.addDiminishingReturns('earth', earthRunes);
                        incTower.incrementObservable(enemy.statusEffects.bleeding, boulder.damageOnImpact);
                    }, null, this);
                    this.destroy();
                }, boulder);


            }
        },
        fireCatalyst: {
            name: 'Fire Catalyst',
            describe: function () {
                return "Consumes fire runes to lighting enemies on fire and increasing the damage that they take from all sources.";
            },
            icon: 'fire-element.png',
            collision: function (tower, bullet, enemy) {
                var fireRunes = enemy.consumeRunes('fire');
                incrementObservable(enemy.statusEffects.sensitivity, 20 * fireRunes);
                incrementObservable(enemy.statusEffects.burning, bullet.damage.times(Math.pow(1.2, Math.max(0, fireRunes - 1))));
            }
        },
        waterCatalyst: {
            name: 'Water Catalyst',
            describe: function () {
                return "Consumes water runes to chilling enemies, slowing their movement speed.";
            },
            icon: 'water-element.png',
            collision: function (tower, bullet, enemy) {
                var waterRunes = enemy.consumeRunes('water');
                incrementObservable(enemy.statusEffects.chilled, 50 * waterRunes);
                if (enemy.statusEffects.chilled().gte(100)) {
                    incTower.createFloatingText({
                        'color': '#0000CC',
                        'duration': 2000,
                        'around': enemy,
                        'text': 'Frozen!',
                        'type': 'frozen'
                    });
                    enemy.addDiminishingReturns('water', waterRunes * 3);
                }
                enemy.assignDamage(bullet.damage.times(Math.pow(1.2, Math.max(0, waterRunes - 1))), 'water');
            }
        },

        //Support ammos
        generator: {
            name: 'Generator',
            describe: function (tower) {
                var rate = incTower.humanizeNumber(tower.fireTime() / 1000);
                var damage = incTower.humanizeNumber(tower.totalDamage());
                var duration = incTower.supportTowerDuration();
                return 'Every ' + rate + "s this tower will grant back-up power, allowing a tower to fire through disabling effects such as Null-Zone, and granting a " + damage + " damage buff to a non-support tower that is adjacent to it. The buff lasts " + (duration / 1000).toFixed(2) + " seconds. This tower is immune to tower disabling effects such as Null-Zone.";

            },
            icon: 'power-lightning.png',
            support: function (supportTower, targetTower) {
                var duration = incTower.supportTowerDuration();
                incTower.createFloatingText({
                    'color': 'blue',
                    'duration': duration,
                    'around': targetTower,
                    'text': 'Energized!',
                    'type': 'buff'
                });
                targetTower.addBuff('energized', supportTower, duration, 1);
                targetTower.addBuff('damage', supportTower, duration, supportTower.totalDamage());
            }
        },
        sensor: {
            name: 'Sensor Array',
            describe: function (tower) {
                var rate = incTower.humanizeNumber(tower.fireTime() / 1000);
                var damage = incTower.humanizeNumber(tower.totalDamage());
                var duration = incTower.supportTowerDuration();
                return 'Every ' + rate + "s this tower will grant a 15% range buff and a " + damage + " damage buff to a non-support tower that is adjacent to it. The buff lasts " + (duration / 1000).toFixed(2) + " seconds.";
            },
            icon: 'radar-sweep.png',

            support: function (supportTower, targetTower) {
                var duration = incTower.supportTowerDuration();
                incTower.createFloatingText({
                    'color': 'purple',
                    'duration': duration,
                    'around': targetTower,
                    'text': 'Range Buff!',
                    'type': 'buff'
                });
                targetTower.addBuff('range', supportTower, duration, 0.15);
                targetTower.addBuff('damage', supportTower, duration, supportTower.totalDamage());

            }
        }
    };
    incTower.supportTowerDuration = function () {
      return 2000 * (1 + 0.1 * incTower.getEffectiveSkillLevel('batteryLongevity'));
    };
    incTower.describeAmmo = function (tower) {
        return incTower.ammoAttributes[tower.ammoType()].describe(tower);
    };
    incTower.describeTower = function (tower) {
        var attribs = incTower.towerAttributes[tower.towerType];
        var ret = '<p><b>Tower:</b> ' + attribs.describe() + '</p>';
        if (attribs.ammoTypes !== undefined) {
            ret += '<p><b>Ammo:</b> ' + incTower.describeAmmo(tower) + '</p>';
        }
        return ret;
    };
    incTower.towerAttributes = {
        kinetic: {
            name: 'Kinetic',
            baseCost: 25,
            startingFireRate: 1500,
            startingRange: 120,
            damagePerLevel: 1,
            describe: function () {
                return 'Kinetic towers are cheap to build and reliable. Their simpler parts make them cheaper to upgrade as well.';
            },
            ammoTypes: ko.observableArray(['bullet'])
        },
        elemental: {
            name: 'Elemental',
            baseCost: 50,
            damagePerLevel: 1,
            startingRange: 100,
            startingFireRate: 2500,
            describe: function () {
                return 'Elemental towers deal damage and also unlock mystical elemental effects, depending on the ammo chosen.';
            },
            ammoTypes: ko.observableArray(['arcaneOrb'])
        },
        support: {
            name: 'Support',
            baseCost: 66,
            damagePerLevel: 1,
            startingRange: 32,
            startingFireRate: 10000,
            describe: function () {
                return 'Support towers grant effects to the towers around them, and usually a damage boost based on the damage of the support tower.';
            },
            ammoTypes: ko.observableArray(['generator'])
        }
    };
    _.forEach(_.keys(incTower.towerAttributes), function (towerType) {
        incTower.towerAttributes[towerType].blueprintPoints = ko.computed(function () {
            if (!_.has(incTower.towerBlueprints, towerType)) {
                incTower.towerBlueprints[towerType] = ko.observable(new BigNumber(0));
            }
            return incTower.towerBlueprints[towerType]();
        });
    });
    incTower.towerCost = function (type) {
        var base = BigNumber(incTower.towerAttributes[type].baseCost);
        base = base.plus(incTower.towerAttributes[type].blueprintPoints().times(5));
        var amount = incTower.costCalc(base, incTower.numTowers(), 1.4);
        amount = amount.times(1 - (incTower.getEffectiveSkillLevel('construction') * 0.01));
        return amount;
    };
    function TowerInputOver(sprite, pointer) {
        if (incTower.rangeIndicator !== undefined) {
            return;
        }
        if (incTower.cursor()) {
            return;
        }
        incTower.rangeIndicator = incTower.game.add.graphics(0, 0);
        incTower.rangeIndicator.x = sprite.x; //+ (tileSquare / 2);
        incTower.rangeIndicator.y = sprite.y; //+ (tileSquare / 2);

        incTower.rangeIndicator.beginFill(0xFF0000, 0.3);
        incTower.rangeIndicator.lineStyle(1, 0x000000, 2);
        incTower.rangeIndicator.drawCircle(0, 0, (sprite.trueRange() * 2) - 32);


    }

    function TowerInputOut(sprite, pointer) {
        if (incTower.rangeIndicator !== undefined) {
            incTower.rangeIndicator.destroy();
            incTower.rangeIndicator = undefined;

        }

    }

    function UpgradeTower(tower) {
        tower.upgrade();
    }

    function DestroyTower(tower, updateArray) {
        if (updateArray === undefined) {
            updateArray = true;
        }
        if (updateArray) {
            var index = incTower.towers.indexOf(tower);
            if (index >= 0) {
                incTower.towers.splice(index, 1);
            }
        }

        path.tileForbidden[tower.tileX][tower.tileY] = false;
        if (tower.icon) {
            tower.icon.destroy();
        }
        if (tower.levelIndicator) {
            tower.levelIndicator.destroy();
        }
        tower.destroy();

        incTower.currentlySelected(null);
    }

    incTower.destroyTower = DestroyTower;

    function TowerInputDown(sprite, pointer) {
        console.log(pointer);
        if (incTower.cursor() !== false) {
            return false;
        }
        incTower.currentlySelected(sprite);
    }

    function calculateTowerUpgradeCost(towerType, level) {
        var amount = incTower.costCalc(incTower.towerAttributes[towerType].baseCost, level, 1.2);
        amount = amount.times(1 - (incTower.getEffectiveSkillLevel('construction') * 0.01));
        amount = amount.times(1 - (incTower.getEffectiveSkillLevel('modularConstruction') * 0.05));
        return amount;
    }

    incTower.calculateTowerUpgradeCost = calculateTowerUpgradeCost;
    function Tower(opt) {
        if (opt === undefined) {
            opt = {};
        }
        var worldX = opt.worldX;
        var worldY = opt.worldY;
        var tileX = opt.tileX;
        var tileY = opt.tileY;
        var tile = opt.tile;

        if (!path.tileForbidden[tileX][tileY]) {
            Phaser.Sprite.call(this, incTower.game, worldX + 16, worldY + 16, 'incTower', 'Tower-32.png');

            //this.tower = game.add.sprite(worldX+tileSquare/2, worldY+tileSquare/2, 'incTower', 'Tower-32.png');
            this.towerType = opt.towerType;
            if (incTower.towerMaxDamage[this.towerType] === undefined) {
                incTower.towerMaxDamage[this.towerType] = ko.observable(new BigNumber(0));
            }
            this.ammoType = ko.observable(false);
            if ('ammoTypes' in incTower.towerAttributes[this.towerType]) {
                if ('ammoType' in opt && incTower.towerAttributes[this.towerType].ammoTypes.indexOf(opt.ammoType) > 0) {
                    this.ammoType(opt.ammoType);
                } else {
                    this.ammoType(incTower.towerAttributes[this.towerType].ammoTypes()[0]);
                }
            }
            this.ammoType.subscribe(function () { this.updateIcon(); }, this);
            this.goldSpent = ko.observable(new BigNumber(opt.goldSpent || opt.cost || 0));
            this.worldX = worldX;
            this.worldY = worldY;
            this.tileX = tileX;
            this.tileY = tileY;
            this.tower = true;
            this.support = 'support' in incTower.towerAttributes[this.towerType] && incTower.towerAttributes[this.towerType].support;
            this.disabledFrames = ko.observable(0); //If this is non-zero the tower is disabled.


            this.anchor.setTo(0.5, 0.5);
            this.tile = tile;
            if (opt.damage) {
                this.damage = ko.observable(new BigNumber(opt.damage));
            } else {
                var defaultDamage = incTower.towerAttributes[this.towerType].blueprintPoints().plus(5);
                defaultDamage = defaultDamage.times(1 + 0.05 * incTower.getEffectiveSkillLevel('initialEngineering'));
                this.damage = ko.observable(defaultDamage);

            }
            this.buffs = ko.observableArray([]);
            this.totalDamage = ko.pureComputed(function () {
                var ret = this.damage();
                if (this.towerType === 'kinetic') {
                    ret = ret.times(1 + 0.05 * incTower.getEffectiveSkillLevel('kineticTowers'));
                    ret = ret.times(1 + 0.05 * incTower.getEffectiveSkillLevel('kineticAmmo'));
                }
                if (this.ammoType() !== false && incTower.ammoAttributes[this.ammoType()].damageModifier) {
                    ret = ret.times(incTower.ammoAttributes[this.ammoType()].damageModifier);
                }
                var damageBuffs = this.getBuffAmountByType('damage');
                if (damageBuffs) {
                    ret = ret.plus(damageBuffs);
                }
                return ret;
            }, this);
            var damageSubscription = function (newDamage) {
                if (newDamage === undefined) { return; }
                if (newDamage.gt(incTower.towerMaxDamage[this.towerType]())) {
                    incTower.towerMaxDamage[this.towerType](newDamage);
                }
            };
            this.damage.subscribe(damageSubscription, this);


            this.relativeTowerPower = ko.computed(function () {
                if (this.damage() === undefined) {
                    return;
                }
                var per = this.damage().div(incTower.towerMaxDamage[this.towerType]()) * 1.0;
                return per;
            }, this);

            damageSubscription.call(this, this.damage());

            this.level = ko.observable(opt.level || 1);
            this.levelIndicator = incTower.game.add.text(0, 0, "", {
                font: "14px Arial",
                stroke: 'black',
                strokeThickness: 1,
                fontWeight: "bold",
                fill: '#eee',
                boundsAlignH: "center"
            });
            this.level.subscribe(function (newLevel) { this.updateLevelIndicator(); }, this);
            this.levelIndicator.setTextBounds(this.worldX, this.worldY - 2, tileSquare, tileSquare);
            this.updateLevelIndicator();
            //this.fireTime = Math.min(opt.fireTime || defaultFireRate, defaultFireRate); //opt.fireTime ||
            this.fireTime = ko.pureComputed(function () {
                var fireRate = 2000;
                if ('startingFireRate' in incTower.towerAttributes[this.towerType]) {
                    fireRate = incTower.towerAttributes[this.towerType].startingFireRate;
                }
                fireRate *= 1 - 0.05 * incTower.getEffectiveSkillLevel('initialEngineering');

                if (this.ammoType() !== false && incTower.ammoAttributes[this.ammoType()].reloadModifier) {
                    fireRate *= incTower.ammoAttributes[this.ammoType()].reloadModifier;
                }
                return fireRate;
            }, this);
            var defaultRange = 150;
            if ('startingRange' in incTower.towerAttributes[this.towerType]) {
                defaultRange = incTower.towerAttributes[this.towerType].startingRange;
            }
            defaultRange *= 1 + 0.05 * incTower.getEffectiveSkillLevel('initialEngineering');

            this.range = ko.observable(Math.min(opt.range || defaultRange, defaultRange)); // opt.range ||
            this.trueRange = ko.pureComputed(function () {
                //var ret = this.range;
                if (this.towerType === 'support') {
                    return 64;
                }
                var range = this.range();
                range *= (1 + 0.05 * incTower.getEffectiveSkillLevel('sensors'));
                var rangeBuffs = this.getBuffAmountByType('range');
                if (rangeBuffs > 0) {
                    range *= (1 + rangeBuffs);
                }
                if (this.ammoType() !== false && incTower.ammoAttributes[this.ammoType()].rangeModifier) {
                    range *= incTower.ammoAttributes[this.ammoType()].rangeModifier;
                }
                return range;
            }, this);


            this.inputEnabled = true;
            this.events.onInputOver.add(TowerInputOver, this);
            this.events.onInputOut.add(TowerInputOut, this);
            this.events.onInputDown.add(TowerInputDown, this);
            this.powerBar = incTower.game.add.sprite(this.worldX, this.worldY, 'incTower', 'white.png');
            this.powerBar.tint = '0xFF0000';
            //this.powerBar.alignIn(this, Phaser.BOTTOM_LEFT);
            //this.addChild(this.powerBar); //If this isn't selected then the power bar going off the screen will cause weird overflows causing towers to be selected on any click on the canvas
            var relativeTowerPowerSubscription = function (per) {
                if (per === undefined) {
                    return;
                }
                var height = 32 * per;
                this.powerBar.scale.setTo(3, height);
                this.powerBar.y = this.worldY + (32 - height);

                incTower.game.world.bringToTop(this.powerBar);
            };
            this.relativeTowerPower.subscribe(relativeTowerPowerSubscription, this);

            relativeTowerPowerSubscription.call(this, this.relativeTowerPower());


            this.fireLastTime = incTower.game.time.now + this.fireTime();
            var upgradeCost = opt.remainingUpgradeCost;
            if (upgradeCost === undefined || isNaN(upgradeCost)) {
                upgradeCost = incTower.calculateTowerUpgradeCost(this.towerType, this.level());
            } else {
                upgradeCost = new BigNumber(upgradeCost);
            }
            this.sellValue = function () {
                return this.goldSpent().times(incTower.sellTowerPer());
            };
            this.buffCounts = ko.pureComputed(function () {
                var totals = {};
                _.forEach(this.buffs(), function (buff) {
                    if (totals[buff.type] === undefined) {
                        totals[buff.type] = buff.amount;
                    } else {
                        if (_.isNumber(buff.amount)) {
                            totals[buff.type] += buff.amount;
                        } else {
                            totals[buff.type] = totals[buff.type].plus(buff.amount);
                        }
                    }
                });
                var results = [];
                _.forIn(totals, function (value, key) {
                    if (key === 'range') {
                        value = (value * 100) + '%';
                    } else {
                        value = incTower.humanizeNumber(value);
                    }
                    results.push({
                        type: _.capitalize(key),
                        amount: value
                    });

                });
                return results;
            }, this);
            this.remainingUpgradeCost = ko.observable(upgradeCost);
            this.remainingUpgradeCost.subscribe(function (newVal) {
                if (newVal.lte(0)) {
                    this.upgrade();
                }
            }, this);
            incTower.towers_group.add(this);
            incTower.towers.push(this);
            //Store a reference to ourselves in the tileForbidden array so we can find neighbors.
            path.tileForbidden[tileX][tileY] = this;
            this.events.onDestroy.add(this.cleanup, this);
            this.events.onKilled.add(this.cleanup, this);
            this.updateIcon();

        }
    }

    Tower.prototype = Object.create(Phaser.Sprite.prototype);
    Tower.prototype.constructor = Tower;
    Tower.prototype.cleanup = function () {
        this.levelIndicator.destroy();
        this.powerBar.destroy();
    };
    Tower.prototype.updateLevelIndicator = function () {
        this.levelIndicator.text = this.level();
    };
    Tower.prototype.add = function (pointer) {
        incTower.game.input.onDown.add(Tower.prototype.posit, this);
    };
    Tower.prototype.updateIcon = function () {
        var newIcon = false;
        if ('icon' in incTower.towerAttributes[this.towerType]) {
            newIcon = incTower.towerAttributes[this.towerType].icon;
        }
        if (!newIcon && this.ammoType()) {
            var ammoProps = incTower.ammoAttributes[this.ammoType()];
            if ('icon' in ammoProps) {
                newIcon = ammoProps.icon;
            }
        }
        if (this.icon) {
            this.icon.destroy();
        }
        if (newIcon) {
            this.icon = incTower.game.add.sprite(this.worldX + tileSquare / 2, this.worldY + tileSquare / 2, 'incTower', newIcon);
        }
    };
    Tower.prototype.updateAllAmmo = function () {
        var ourTowerType = this.towerType;
        var ammoType = this.ammoType();
        if (!ammoType) { return; }
        _.forEach(incTower.towers(), function (tower) {
            if (tower.towerType === ourTowerType) {
                tower.ammoType(ammoType);
            }
        });
    };
    Tower.prototype.upgradeCost = function (byLevel) {

        if (this.remainingUpgradeCost === undefined) {
            return new BigNumber(0);
        }
        byLevel = byLevel || 1;
        var cost = this.remainingUpgradeCost();
        byLevel--;
        var prosLevel = this.level() + 1;
        while (byLevel > 0) {
            prosLevel++;
            byLevel--;
            cost = cost.plus(calculateTowerUpgradeCost(this.towerType, prosLevel));
        }
        return cost;


    };

    Tower.prototype.posit = function (pointer, opt) {
        opt.worldX = pointer.worldX - (pointer.worldX % tileSquare);
        opt.worldY = pointer.worldY - (pointer.worldY % tileSquare);
        opt.tileX = Math.floor(pointer.worldX / tileSquare);
        opt.tileY = Math.floor(pointer.worldY / tileSquare);
        opt.tile = 'tower';
        //towers.add();
        new Tower(opt);
    };
    Tower.prototype.update = function () {
        if (incTower.paused()) {
            return;
        }
        if (this.disabledFrames() > 0 && !this.getBuffAmountByType('energized')) {
            if (this.ammoType() === 'generator') {
                this.disabledFrames(0);
            } else {
                incTower.incrementObservable(this.disabledFrames, -1);
                this.alpha = 0.2;
                return;
            }
        }
        this.alpha = 1;
        this.checkBuffs();
        this.fire();
    };
    Tower.prototype.checkBuffs = function () {
        //Removes expired buffs
        this.buffs(_.reject(this.buffs(), function (buff) {
            return incTower.game.time.now > buff.expiration;
        }));
    };
    Tower.prototype.addBuff = function (type, source, duration, amount) {
        this.checkBuffs();
        var expiration = incTower.game.time.now + duration;
        var previousBuff = _.find(this.buffs(), function (buff) {
            return buff.source === source && buff.type === type;
        });
        if (previousBuff) { //If we already have a buff by this source we increase the expiration time
            previousBuff.expiration = expiration;
            if (amount > previousBuff.amount) {
                previousBuff.amount = amount;
            }
        } else {
            this.buffs.push({
                source: source,
                type: type,
                expiration: expiration,
                amount: amount
            });
        }
    };
    Tower.prototype.getBuffsByType = function (type) {
        return _.filter(this.buffs(), function (buff) {
            return buff.type === type;
        });
    };
    Tower.prototype.getBuffAmountByType = function (type) {
        return _.reduce(_.map(this.getBuffsByType(type), function (buff) {
            return buff.amount;
        }), function (total, buffAmount) { // Code below is so we can sum both big numbers and primatives.
            if (_.isNumber(total)) {
                return total + buffAmount;
            } else {
                return total.plus(buffAmount);
            }
        });
    };

    Tower.prototype.fire = function () {
        if (incTower.game.time.now < this.fireLastTime) { return; }

        //console.log("Now: " + game.time.now + " Last Fired:" + this.fireLastTime);
        if (this.towerType === 'support') {
            var tileX = this.tileX;
            var tileY = this.tileY;
            var candidates = [];
            _.forEach(_.range(-1, 2), function (xMod) {
                _.forEach(_.range(-1, 2), function (yMod) {
                    if (xMod === 0 && yMod === 0) {
                        return;
                    }
                    var newTileX = tileX + xMod;
                    var newTileY = tileY + yMod;
                    if (newTileX < 0 || newTileY < 0 || newTileX > 24 || newTileY > 18) {
                        return;
                    }
                    if (!path.tileForbidden[tileX + xMod][tileY + yMod] || path.tileForbidden[tileX + xMod][tileY + yMod].towerType === 'support') {
                        return;
                    }
                    candidates.push(path.tileForbidden[tileX + xMod][tileY + yMod]);
                });
            });
            if (candidates.length > 0) {
                var targetTower = incTower.game.rnd.pick(candidates);
                incTower.ammoAttributes[this.ammoType()].support(this, targetTower);
            }
            this.fireLastTime = incTower.game.time.now + this.fireTime();

        } else {
            var range = this.trueRange();
            var shortestDistance = -1;
            if (!this.lastTarget || !this.lastTarget.alive || incTower.game.physics.arcade.distanceBetween(this.lastTarget, this) > range) {
                this.lastTarget = false;
                for (var i = 0; i < incTower.enemys.children.length; i++) {
                    if (!incTower.enemys.children[i].alive) {
                        continue;
                    }
                    if (incTower.enemys.children[i].x < 0 || incTower.enemys.children[i].y < 0) {
                        continue;
                    }
                    var distance = incTower.game.physics.arcade.distanceBetween(incTower.enemys.children[i], this);
                    if (distance <= range) {
                        this.lastTarget = incTower.enemys.children[i];
                        break;
                    }
                    if (shortestDistance < 0 || distance < shortestDistance) {
                        shortestDistance = distance;
                    }
                }
            }
            if (this.lastTarget && this.lastTarget.alive && incTower.game.physics.arcade.distanceBetween(this.lastTarget, this) <= range) {

                var sprite = 'bullet.png';
                if (this.ammoType() !== false && incTower.ammoAttributes[this.ammoType()].bulletSprite) {
                    sprite = incTower.ammoAttributes[this.ammoType()].bulletSprite;
                }

                if (!(sprite in incTower.deadBullets)) {
                    incTower.deadBullets[sprite] = [];
                }
                var bullet = incTower.deadBullets[sprite].pop();
                if (bullet !== undefined) {
                    bullet.revive();
                    bullet.reset(this.x, this.y);
                } else {
                    bullet = incTower.bullets.create(this.x, this.y, 'incTower', sprite, true);
                    incTower.game.physics.enable(bullet, Phaser.Physics.ARCADE);
                }
                bullet.damage = this.totalDamage();
                bullet.tower = this;
                bullet.target = this.lastTarget;
                this.fireLastTime = incTower.game.time.now + this.fireTime();
                incTower.game.physics.arcade.moveToObject(bullet, this.lastTarget, 300);
                bullet.fired = incTower.game.time.now;
                bullet.ammoType = this.ammoType();
            } else { //If no one was in range delay the next check based on the shortest distance to an enemy
                shortestDistance -= range;
                //console.log("Shortest distance" + shortestDistance);
                this.fireLastTime = incTower.game.time.now + (shortestDistance * 10);
            }
        }

    };
    Tower.prototype.sell = function () {
        incrementObservable(incTower.gold, this.sellValue());
        DestroyTower(this);
    };
    Tower.prototype.upgrade = function (byLevel) {
        if (byLevel === undefined) {
            byLevel = 1;
        }
        var curLevel = this.level();
        var goalLevel = curLevel + byLevel;
        var damage = this.damage();
        var damagePerLevel = incTower.towerAttributes[this.towerType].damagePerLevel;
        while (curLevel < goalLevel) {
            curLevel++;
            if (curLevel % 10 === 0) {
                damage = damage.times(2);
            } else {
                damage = damage.plus(damagePerLevel);
            }
        }
        this.level(curLevel);
        this.damage(damage);
        incTower.checkHelp('towerUpgrades');
        this.remainingUpgradeCost(calculateTowerUpgradeCost(this.towerType, curLevel));
    };
    Tower.prototype.payToUpgrade = function (byLevel, cost) {
        if (byLevel === undefined) {
            byLevel = 1;
        }
        if (cost === undefined) {
            cost = this.upgradeCost(byLevel);
        }
        //console.log("Cost to upgrade " + byLevel + " is " + humanizeNumber(cost));
        if (incTower.gold().gte(cost)) {
            incrementObservable(this.goldSpent, cost);
            incrementObservable(incTower.gold, cost.neg());
            this.upgrade(byLevel);
        }
    };
});
