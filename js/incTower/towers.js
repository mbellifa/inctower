define(['incTower/core', 'lib/knockout', 'lib/bignumber', 'lib/phaser', 'incTower/path', 'lib/lodash', 'incTower/cursor'], function (incTower, ko, BigNumber, Phaser, path, _, Cursor) {
    'use strict';
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
                if (!path.tileForbidden[tileX][tileY] && incTower.gold().gte(cost) && tileIndex >= 5 && tileIndex <= 8) {
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
                    if (!(tileIndex > 4 && tileIndex < 9)) {
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
        }
    };
    incTower.totalTowerDamage = ko.pureComputed(function () {
        'use strict';
        var tally = new BigNumber(0);
        var towerLength = incTower.numTowers();
        for (var i = 0; i < towerLength; ++i) {
            var tower = incTower.towers_group.getAt(i);
            tally = tally.plus(tower.totalDamage());
        }
        return tally;
    });
    incTower.averageDamage = ko.pureComputed(function () {
        'use strict';
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
    incTower.towerAttributes = {
        kinetic: {
            name: 'Kinetic',
                baseCost: 25,
                startingFireRate: 1500,
                startingRange: 120,
                damagePerLevel: 1,
                describe: function () {
                return 'Kinetic towers are cheap to build and reliable. Their simpler parts make them cheaper to upgrade as well.';
            }
        },
        earth: {
            name: 'Earth',
                baseCost: 100,
                damagePerLevel: 1,
                startingRange: 100,
                startingFireRate: 2500,
                icon: 'earth-element.png',
                describe: function () {
                return 'Earth towers deal earth damage and have a chance to attach an earth rune to enemies. When an earth reaction happens a giant boulder falls from the sky on the affected enemy.';
            }
        },
        air: {
            name: 'Air',
                baseCost: 100,
                damagePerLevel: 1,
                startingFireRate: 2500,
                startingRange: 100,
                icon: 'air-element.png',
                describe: function () {
                return 'Air towers deal air damage and have a chance to attach an air rune to enemies. When an air reaction happens a group of enemies will be knocked back..';
            }
        },
        fire: {
            name: 'Fire',
                baseCost: 100,
                damagePerLevel: 1,
                startingFireRate: 2500,
                startingRange: 100,
                icon: 'fire-element.png',
                describe: function () {
                return 'Fire towers deal fire damage and have a chance to attach a fire rune to enemies. When a fire reaction happens the affected enemy takes additional damage from all sources and takes burn damage over time.';
            }
        },
        water: {
            name: 'Water',
                baseCost: 100,
                damagePerLevel: 1,
                startingFireRate: 2500,
                startingRange: 100,
                icon: 'water-element.png',
                describe: function () {
                return 'Water towers deal water damage and have a chance to attach a water rune to enemies. When a water reaction occurs the affected enemy becomes either slowed or frozen in place depending on the number of runes.';
            }
        },
        sensor: {
            name: 'Sensor Array',
            baseCost: 1000,
            damagePerLevel: 1,
            startingFireRate: 10000,
            startingRange: 32,
            icon: 'radar-sweep.png',
            describe: function () {
                return 'Sensor arrays periodically increase the range and damage of adjacent towers but do no damage themselves.';
            },
            describeSupport: function (tower) {
                var rate = incTower.humanizeNumber(tower.fireTime / 1000);
                var damage = incTower.humanizeNumber(tower.totalDamage());
                return 'Every ' + rate + "s this tower will grant a 15% range buff and a " + damage + " damage buff to a non-support tower that is adjacent to it. The buff lasts 2 seconds.";
            },
            support: true
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
        'use strict';
        var base = 25;
        base = incTower.towerAttributes[type].baseCost;
        var amount = incTower.costCalc(base, incTower.numTowers(), 1.4);
        amount = amount.plus(incTower.towerAttributes[type].blueprintPoints().times(5));
        amount = amount.times(1 - (incTower.getEffectiveSkillLevel('construction') * 0.01));
        return amount;
    };
    function TowerInputOver(sprite,pointer) {
        'use strict';
        if (incTower.rangeIndicator !== undefined) {
            return;
        }
        if (incTower.cursor()) {
            return;
        }
        incTower.rangeIndicator = incTower.game.add.graphics(0,0);
        incTower.rangeIndicator.x = sprite.x; //+ (tileSquare / 2);
        incTower.rangeIndicator.y = sprite.y; //+ (tileSquare / 2);

        incTower.rangeIndicator.beginFill(0xFF0000,0.3);
        incTower.rangeIndicator.lineStyle(1,0x000000,2);
        incTower.rangeIndicator.drawCircle(0,0,(sprite.trueRange() * 2) - 32);


    }
    function TowerInputOut(sprite,pointer) {
        if (incTower.rangeIndicator !== undefined) {
            incTower.rangeIndicator.destroy();
            incTower.rangeIndicator = undefined;

        }

    }
    function UpgradeTower(tower) {
        tower.upgrade();
    }
    function DestroyTower(tower, updateArray) {
        if (updateArray === undefined) { updateArray = true; }
        if (updateArray) {
            var index = incTower.towers.indexOf(tower);
            if (index >= 0) { incTower.towers.splice(index, 1); }
        }

        path.tileForbidden[tower.tileX][tower.tileY] = false;
        if (tower.icon) {
            tower.icon.destroy();
        }
        tower.destroy();

        incTower.currentlySelected(null);
    }
    incTower.destroyTower = DestroyTower;

    function TowerInputDown(sprite,pointer) {
        if (incTower.cursor() !== false) {
            return false;
        }
        console.log("TOWER CLICKED");
        incTower.currentlySelected(sprite);
    }
    function calculateTowerUpgradeCost(towerType, level) {
        var amount = incTower.costCalc(incTower.towerAttributes[towerType].baseCost,level,1.2);
        amount = amount.times(1 - (incTower.getEffectiveSkillLevel('construction') * 0.01));
        amount = amount.times(1 - (incTower.getEffectiveSkillLevel('modularConstruction') * 0.05));
        return amount;
    }
    incTower.calculateTowerUpgradeCost = calculateTowerUpgradeCost;
    function Tower (opt) {
        if (opt === undefined) {
            opt = {};
        }
        var worldX = opt.worldX;
        var worldY = opt.worldY;
        var tileX = opt.tileX;
        var tileY = opt.tileY;
        var tile = opt.tile;

        if (!path.tileForbidden[tileX][tileY]) {
            Phaser.Sprite.call(this, incTower.game, worldX+16, worldY+16, 'incTower', 'Tower-32.png');

            //this.tower = game.add.sprite(worldX+tileSquare/2, worldY+tileSquare/2, 'incTower', 'Tower-32.png');
            this.towerType = opt.towerType;
            if (incTower.towerMaxDamage[this.towerType] === undefined) {
                incTower.towerMaxDamage[this.towerType] = ko.observable(new BigNumber(0));
            }
            if ('icon' in incTower.towerAttributes[this.towerType]) {
                this.icon = incTower.game.add.sprite(worldX+tileSquare/2, worldY+tileSquare/2, 'incTower', incTower.towerAttributes[this.towerType].icon);
            }
            this.goldSpent = ko.observable(new BigNumber(opt.goldSpent || opt.cost || 0));
            this.worldX = worldX;
            this.worldY = worldY;
            this.tileX = tileX;
            this.tileY = tileY;
            this.tower = true;
            this.support = 'support' in incTower.towerAttributes[this.towerType] && incTower.towerAttributes[this.towerType].support;
            this.powerBar = incTower.game.add.graphics(0,0); //This bar represents relative power
            this.addChild(this.powerBar);
            this.disabledFrames = ko.observable(0); //If this is non-zero the tower is disabled.


            this.anchor.setTo(0.5,0.5);
            this.tile = tile;
            if (opt.damage) {
                this.damage = ko.observable(new BigNumber(opt.damage));
            } else {
                var defaultDamage = incTower.towerAttributes[this.towerType].blueprintPoints().plus(5);
                defaultDamage = defaultDamage.times(1 + 0.05 * incTower.getEffectiveSkillLevel('initialEngineering'));
                this.damage = ko.observable(defaultDamage);

            }
            this.totalDamage = ko.pureComputed(function () {

                var ret = this.damage();
                if (this.towerType === 'kinetic') {
                    ret = ret.times(1 + 0.05 * incTower.getEffectiveSkillLevel('kineticTowers'));
                    ret = ret.times(1 + 0.05 * incTower.getEffectiveSkillLevel('kineticAmmo'));
                }
                return ret;
            },this);
            var totalDamageSubscription = function (newDamage) {
                if (newDamage === undefined) { return; }
                if (newDamage.gt(incTower.towerMaxDamage[this.towerType]())) {
                    incTower.towerMaxDamage[this.towerType](newDamage);
                }
            };
            this.totalDamage.subscribe(totalDamageSubscription, this);


            this.relativeTowerPower = ko.computed(function () {
                if (this.totalDamage() === undefined) { return; }
                var per = this.totalDamage().div(incTower.towerMaxDamage[this.towerType]()) * 1.0;
                return per;
            }, this);
            var relativeTowerPowerSubscription = function (per) {
                if (per === undefined) { return; }
                var colour = '0xFF0000';
                this.powerBar.clear();
                this.powerBar.beginFill(colour);
                this.powerBar.lineStyle(3, colour, 1);
                this.powerBar.moveTo(-16,15);
                this.powerBar.lineTo(-16,-32 * per + 16);
                this.powerBar.endFill();
                incTower.game.world.bringToTop(this.powerBar);
            };
            this.relativeTowerPower.subscribe(relativeTowerPowerSubscription, this);

            totalDamageSubscription.call(this, this.totalDamage());
            relativeTowerPowerSubscription.call(this, this.relativeTowerPower());

            this.level = ko.observable(opt.level || 1);
            var defaultFireRate = 2000;
            if ('startingFireRate' in incTower.towerAttributes[this.towerType]) {
                defaultFireRate = incTower.towerAttributes[this.towerType].startingFireRate;
            }
            defaultFireRate *= 1 - 0.05 * incTower.getEffectiveSkillLevel('initialEngineering');
            this.fireTime = Math.min(opt.fireTime || defaultFireRate, defaultFireRate); //opt.fireTime ||
            var defaultRange = 150;
            if ('startingRange' in incTower.towerAttributes[this.towerType]) {
                defaultRange = incTower.towerAttributes[this.towerType].startingRange;
            }
            defaultRange *= 1 + 0.05 * incTower.getEffectiveSkillLevel('initialEngineering');

            this.range = ko.observable(Math.min(opt.range || defaultRange, defaultRange)); // opt.range ||
            this.trueRange = ko.pureComputed(function () {
                //var ret = this.range;
                if (this.towerType === 'sensor') {
                    return 64;
                }
                var range = this.range();
                range *= (1 + 0.05 * incTower.getEffectiveSkillLevel('sensors'));
                var rangeBuffs = this.getBuffAmountByType('range');
                if (rangeBuffs > 0) {
                    range *= (1 + rangeBuffs);
                }
                return range;
            }, this);

            this.buffs = ko.observableArray([]);
            this.inputEnabled = true;
            this.events.onInputOver.add(TowerInputOver,this);
            this.events.onInputOut.add(TowerInputOut,this);
            this.events.onInputDown.add(TowerInputDown,this);
            this.fireLastTime = incTower.game.time.now + this.fireTime;
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
        }
    }
    Tower.prototype = Object.create(Phaser.Sprite.prototype);
    Tower.prototype.constructor = Tower;
    Tower.prototype.add = function(pointer) {
        incTower.game.input.onDown.add(Tower.prototype.posit, this);
    };
    Tower.prototype.upgradeCost = function (byLevel) {
        'use strict';
        if (this.remainingUpgradeCost === undefined) { return new BigNumber(0); }
        if (byLevel === undefined) {
            byLevel = 1;
        }
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

    Tower.prototype.posit = function(pointer,opt) {
        opt.worldX = pointer.worldX - (pointer.worldX % tileSquare);
        opt.worldY = pointer.worldY - (pointer.worldY % tileSquare);
        opt.tileX = Math.floor(pointer.worldX / tileSquare);
        opt.tileY = Math.floor(pointer.worldY / tileSquare);
        opt.tile = 'tower';
        //towers.add();
        new Tower(opt);
    };
    Tower.prototype.update = function () {
        if (incTower.paused()) { return; }
        if (this.disabledFrames() > 0) {
            incrementObservable(this.disabledFrames, -1);
            this.alpha = 0.2;
            return;
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
        var previousBuff = _.find(this.buffs(), function(buff) {
           return buff.source === source && buff.type === type;
        });
        if (previousBuff) { //If we already have a buff by this source we increase the expiration time
            previousBuff.expiration = expiration;
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
        return _.reduce(_.map(this.getBuffsByType(type), function(buff) {
            return buff.amount;
        }), function (total, buffAmount) { // Code below is so we can sum both big numbers and primatives.
            if (_.isNumber(total)) {
                return total + buffAmount;
            } else {
                return total.plus(buffAmount);
            }
        });
    };

    Tower.prototype.fire = function() {
        if (incTower.game.time.now >= this.fireLastTime) {
            //console.log("Now: " + game.time.now + " Last Fired:" + this.fireLastTime);
            if (this.support) {
                var tileX = this.tileX;
                var tileY = this.tileY;
                var candidates = [];
                _.forEach(_.range(-1,2), function (xMod) {
                    _.forEach(_.range(-1,2), function (yMod) {
                        if (xMod === 0 && yMod === 0) { return; }
                        if (!path.tileForbidden[tileX + xMod][tileY + yMod] || path.tileForbidden[tileX + xMod][tileY + yMod].support) {
                            return;
                        }
                        candidates.push(path.tileForbidden[tileX + xMod][tileY + yMod]);
                    });
                });
                if (candidates.length > 0) {
                    var candidate = incTower.game.rnd.pick(candidates);
                    if (this.towerType === 'sensor') {
                        incTower.createFloatingText({
                            'color': 'purple',
                            'duration': 2000,
                            'around': candidate,
                            'text': 'Range Buff!',
                            'type': 'buff'
                        });
                        candidate.addBuff('range', this, 2000, 0.15);
                        candidate.addBuff('damage', this, 2000, this.totalDamage());

                    }
                }
                this.fireLastTime = incTower.game.time.now + this.fireTime;
                
            } else {
                var enemiesInRange = [];
                for (var i = 0;i < incTower.enemys.children.length;i++) {
                    if (!incTower.enemys.children[i].alive) { continue; }
                    if (incTower.enemys.children[i].x < 0 || incTower.enemys.children[i].y < 0) { continue; }
                    if (incTower.game.physics.arcade.distanceBetween(incTower.enemys.children[i],this) <= this.trueRange()) {
                        enemiesInRange.push(incTower.enemys.children[i]);
                    }
                }
                if (enemiesInRange.length > 0) {
                    var chosenEnemy = enemiesInRange[(Math.random()*enemiesInRange.length) | 0];
                    var sprite = 'bullet.png';
                    if (!(sprite in incTower.deadBullets)) {
                        incTower.deadBullets[sprite] = [];
                    }
                    var bullet = incTower.deadBullets[sprite].shift();
                    if (bullet !== undefined) {
                        bullet.revive();
                        bullet.reset(this.x,this.y);
                    } else {
                        bullet = incTower.bullets.create(this.x, this.y, 'incTower', sprite, true);
                        incTower.game.physics.enable(bullet, Phaser.Physics.ARCADE);
                    }
                    bullet.damage = this.totalDamage();
                    bullet.tower = this;
                    bullet.target = chosenEnemy;
                    this.fireLastTime = incTower.game.time.now + this.fireTime;
                    incTower.game.physics.arcade.moveToObject(bullet, chosenEnemy, 300);
                    bullet.fired = incTower.game.time.now;
                }
            }
                
        }
    };
    Tower.prototype.sell = function () {
        incrementObservable(incTower.gold, this.sellValue());
        DestroyTower(this);
    };
    Tower.prototype.upgrade = function (byLevel) {
        'use strict';
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
