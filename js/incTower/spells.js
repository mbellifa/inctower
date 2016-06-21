define(['incTower/core', 'lib/knockout', 'lib/bignumber', 'incTower/cursor', 'incTower/skills'], function (incTower, ko, BigNumber, Cursor) {
    'use strict';
    function Spell(opts) {
        this.fullName = opts.fullName;
        this.manaCost = opts.manaCost;
        this.trueManaCost = ko.pureComputed(function () {
            if (incTower === undefined) {
                return 0;
            }
            var base_mana_cost = new BigNumber(this.manaCost);
            return base_mana_cost.plus(base_mana_cost.times(0.5 * incTower.spellLevel()));
        }, this);
        this.raw_describe = opts.describe;

        this.damageType = opts.damageType;
        this.diameter = opts.diameter;
        this.perform = opts.perform;
        this.describe = ko.pureComputed(function () {
            return this.fullName + ' (' + _.capitalize(this.damageType) + ')<br><br>' + this.raw_describe();
        }, this);
    }

    incTower.maxMana = ko.pureComputed(function () {
        return this.rawMaxMana().times(1 + 0.05 * incTower.getEffectiveSkillLevel('arcaneKnowledge'));
    }, incTower);
    incTower.rawMaxMana = ko.observable(new BigNumber(0));
    incTower.percentageMaxMana = ko.computed(function () {
        'use strict';
        if (this.maxMana().eq(0)) {
            return 0;
        }
        return this.mana().div(this.maxMana()).times(100);
    }, incTower);

    incTower.mana = ko.observable(new BigNumber(0));
    incTower.describeManaRegeneration = ko.pureComputed(function () {
        return 'Regenerating ' + incTower.manaRegeneration() + ' mana per second.';
    });
    incTower.manaRegeneration = ko.pureComputed(function () {
        return (1 + incTower.getEffectiveSkillLevel('manaRegeneration')) * (1 + 0.05 * incTower.getEffectiveSkillLevel('manaRegenerationAdvanced'));
    });
    incTower.spellLevel = ko.observable(new BigNumber(0));
    incTower.spellLevelDamageFactor = ko.pureComputed(function () {
        return Math.pow(2, incTower.spellLevel());
    });
    incTower.availableSpells = ko.observableArray([]);
    incTower.castSpell = function (spell) {
        'use strict';
        var manaCost = incTower.spellAttributes[spell].trueManaCost();
        if (incTower.mana().lt(manaCost)) {
            return;
        }
        var cur_cursor = incTower.cursor();
        //If our cursor already holds this spell then cancel it.
        if (cur_cursor !== false && cur_cursor.type === 'spell' && cur_cursor.param === spell) {
            incTower.clearCursor();
            return;
        }
        incTower.cursor(new Cursor('spell', spell, function (pointer) {
            if (incTower.mana().lt(manaCost)) {
                incTower.clearCursor();
                return;
            }
            incTower.spellAttributes[spell].perform(pointer, spell);
            incTower.incrementObservable(incTower.mana, manaCost.neg());
        }));
    };
    incTower.describeSpellLevel = ko.pureComputed(function () {
        'use strict';
        return "Increases the damage of all spells by " + incTower.spellLevelDamageFactor() + "X and increases their mana costs by " + (incTower.spellLevel() * 50) + "%.";
    });
    incTower.spellAttributes = {
        manaBurst: new Spell({
            fullName: 'Mana Burst',
            damageType: 'arcane',
            manaCost: 100,
            diameter: 200,
            describe: function () {
                var damage = incTower.totalTowerDamage().times(incTower.spellLevelDamageFactor());
                var fullManaDamage = damage.times(10);

                return 'Deals ' + incTower.humanizeNumber(damage) + ' arcane damage in an area. When cast at over 90% of max mana, it will deal ' + incTower.humanizeNumber(fullManaDamage) + ' instead.<br><br>When cast at less than one-third mana there is a chance that you will increase your maximum mana pool by ' + incTower.humanizeNumber(0.25 * this.trueManaCost()) + '. This chance starts at 5% and increases to 100% depending on how low your mana pool is.'
            },
            perform: function (pointer, spellName) {
                var cursor = incTower.cursor();
                var diameter = incTower.spellAttributes[spellName].diameter;
                var area = new Phaser.Circle(pointer.worldX, pointer.worldY, diameter);
                var damage = incTower.totalTowerDamage().times(incTower.spellLevelDamageFactor());
                if (incTower.mana().div(incTower.maxMana()).gte(0.9)) {
                    damage = damage.times(10);
                }

                incTower.enemys.forEachAlive(function (enemy) {
                    if (area.contains(enemy.x, enemy.y)) {
                        enemy.assignDamage(damage, 'arcane');
                    }
                });
                var perMana = incTower.mana().div(incTower.maxMana()).toNumber();

                if (perMana < 0.3334 && incTower.game.rnd.frac() < 1.05 - (perMana / 0.3334)) {
                    incTower.incrementObservable(incTower.rawMaxMana, 0.25 * this.trueManaCost());
                }

            }

        }),
        arcaneSacrifice: new Spell({
            fullName: 'Arcane Sacrifice',
            damageType: 'arcane',
            manaCost: 1000,
            diameter: 64,
            describe: function () {
                var damage = incTower.totalTowerDamage().times(100).times(incTower.spellLevelDamageFactor());
                return 'Deals ' + incTower.humanizeNumber(damage) + ' arcane damage in a small area. If an enemy is killed they will be sacrificed, increasing the damage of all spells by 100% and increasing the mana cost of all spells by 50%.'
            },
            perform: function (pointer, spellName) {
                var cursor = incTower.cursor();
                var diameter = incTower.spellAttributes[spellName].diameter;
                var area = new Phaser.Circle(pointer.worldX, pointer.worldY, diameter);
                var damage = incTower.totalTowerDamage().times(100).times(incTower.spellLevelDamageFactor());
                var livingBefore = incTower.enemys.countLiving();
                incTower.enemys.forEachAlive(function (enemy) {
                    if (area.contains(enemy.x, enemy.y)) {
                        enemy.assignDamage(damage, 'arcane');
                    }
                });
                if (incTower.enemys.countLiving() < livingBefore) {
                    //Someone died!
                    incTower.incrementObservable(incTower.spellLevel);
                }


            }

        }),

        frostShatter: new Spell({
            fullName: 'Frost Shatter',
            damageType: 'water',
            manaCost: 200,
            diameter: 150,
            describe: function () {
                var damage = incTower.totalTowerDamage().div(2).times(incTower.spellLevelDamageFactor());
                var frozenDamage = damage.times(5);
                return 'Deals ' + incTower.humanizeNumber(damage) + ' water damage in an area, adding up to three water runes to each enemy that is not already frozen. If an enemy is frozen it takes ' + incTower.humanizeNumber(frozenDamage) + ' damage and gains up to one water rune instead.<br><br>If all enemies in the area are frozen 50% of the mana cost is refunded.';
            },
            perform: function (pointer, spellName) {
                var cursor = incTower.cursor();
                var diameter = incTower.spellAttributes[spellName].diameter;
                var area = new Phaser.Circle(pointer.worldX, pointer.worldY, diameter);
                var damage = incTower.totalTowerDamage().div(2).times(incTower.spellLevelDamageFactor());
                var frozenDamage = damage.times(5);
                var allFrozen = true;

                incTower.enemys.forEachAlive(function (enemy) {
                    if (area.contains(enemy.x, enemy.y)) {
                        if (enemy.statusEffects.chilled().gte(100)) {
                            enemy.addElementalRunesDiminishing('water', 1);
                            enemy.assignDamage(frozenDamage, 'water');
                        } else {
                            enemy.assignDamage(damage, 'water');
                            enemy.addElementalRunesDiminishing('water', 1, 3);
                            allFrozen = false;
                        }
                    }
                });
                if (allFrozen) {
                    incTower.incrementObservable(incTower.mana, 0.5 * this.trueManaCost());
                }
            }
        }),
        smolder: new Spell({
            fullName: 'Smolder',
            damageType: 'fire',
            manaCost: 200,
            diameter: 150,
            describe: function () {
                var damage = incTower.totalTowerDamage().div(2);
                var burnDamage = damage.times(4);
                return 'Deals ' + incTower.humanizeNumber(damage) + ' fire damage in an area, adding up to three fire runes to each enemy that is not already burning. If an enemy is burning its burn amount is increased by ' + incTower.humanizeNumber(burnDamage) + ' damage and gains up to one fire rune instead.<br><br>Each already burning enemy hit will restore ' + incTower.humanizeNumber(0.15 * this.trueManaCost()) + ' mana.';
            },
            perform: function (pointer, spellName) {
                var diameter = incTower.spellAttributes[spellName].diameter;
                var area = new Phaser.Circle(pointer.worldX, pointer.worldY, diameter);
                var damage = incTower.totalTowerDamage().div(2).times(incTower.spellLevelDamageFactor());
                var burnDamage = damage.times(4);
                var alreadyBurning = 0;

                incTower.enemys.forEachAlive(function (enemy) {
                    if (area.contains(enemy.x, enemy.y)) {
                        if (enemy.statusEffects.burning().gte(1)) {
                            enemy.addElementalRunesDiminishing('fire', 1);
                            incTower.incrementObservable(enemy.statusEffects.burning, burnDamage);
                            alreadyBurning++;
                        } else {
                            enemy.assignDamage(damage, 'fire');
                            enemy.addElementalRunesDiminishing('fire', 1, 3);
                        }
                    }
                });

                if (alreadyBurning > 0) {
                    incTower.incrementObservable(incTower.mana, incTower.maxMana().minus(incTower.mana()).times(0.05 * alreadyBurning));
                }
            }
        }),
        eyeOfTheStorm: new Spell({
            fullName: 'Eye of the Storm',
            damageType: 'air',
            manaCost: 200,
            diameter: 50,
            describe: function () {
                var damage = incTower.totalTowerDamage().div(3).times(incTower.spellLevelDamageFactor());
                var soloDamage = damage.times(7);
                return 'Deals ' + incTower.humanizeNumber(damage) + ' air damage in a focused area, adding up to three air runes to each enemy. If only one enemy is is under this spells effect it deals ' + incTower.humanizeNumber(soloDamage) + ' damage and gains six air runes instead.<br><br>Gain 20 mana for each air rune that was already attached to affected enemies.';
            },
            perform: function (pointer, spellName) {
                var diameter = incTower.spellAttributes[spellName].diameter;
                var area = new Phaser.Circle(pointer.worldX, pointer.worldY, diameter);
                var damage = incTower.totalTowerDamage().div(3).times(incTower.spellLevelDamageFactor());
                var soloDamage = damage.times(7);
                var airRunes = 0;
                var impactedEnemies = [];

                incTower.enemys.forEachAlive(function (enemy) {
                    if (area.contains(enemy.x, enemy.y)) {
                        impactedEnemies.push(enemy);
                    }
                });
                _.forEach(impactedEnemies, function (enemy) {
                    airRunes += enemy.elementalRuneCounts.air || 0;
                    if (impactedEnemies.length === 1) {
                        enemy.addElementalRunesDiminishing('air', 1, 6);
                        enemy.assignDamage(soloDamage, 'air');
                    } else {
                        enemy.addElementalRunesDiminishing('air', 1, 3);
                        enemy.assignDamage(damage, 'air');

                    }
                });

                if (airRunes > 0) {
                    incTower.incrementObservable(incTower.mana, 20 * airRunes);
                }
            }
        }),
        seismicRupture: new Spell({
            fullName: 'Seismic Rupture',
            damageType: 'earth',
            manaCost: 300,
            diameter: 16,
            describe: function () {
                var damage = incTower.totalTowerDamage().times(incTower.spellLevelDamageFactor());
                return 'Ruptures form in the earth at your cursor and stalk your enemies. Each rupture deals ' + incTower.humanizeNumber(damage) + ' which is increased by 3% per tile-width the rupture travels. In addition to damage when a rupture strikes an enemy up to one earth rune will be attached. Ruptures can form smaller ruptures that target the same enemy, these will do less damage but have a higher chance to attach an earth rune.<br><br>If you cast Seismic Rupture while the ground is shaking half of the mana cost is refunded.';
            },
            perform: function (pointer, spellName) {
                var damage = incTower.totalTowerDamage().times(incTower.spellLevelDamageFactor());
                if (incTower.shakeWorld > 0) {
                    incTower.incrementObservable(incTower.mana, 0.5 * this.trueManaCost());
                }
                //This effect was heavily inspired by http://gamemechanicexplorer.com/#lightning-3
                function SeismicEvent(x, y, enemy, branch, damage) {
                    this.seismicGraphic = incTower.game.add.graphics(0, 0);
                    //function(x, y, segments, boltWidth, branch) {
                    // Get the canvas drawing context for the lightningBitmap
                    this.enemy = enemy;
                    this.x = x;
                    this.y = y;
                    this.branch = branch;
                    this.timer = incTower.game.time.events.loop(75, this.run, this);
                    this.damage = damage;
                    this.totalDistance = 0;
                }
                SeismicEvent.prototype.run = function () {
                    if (incTower.shakeWorld < 10) {
                        incTower.shakeWorld = 10;
                    }
                    var target_x = this.enemy.x;
                    var target_y = this.enemy.y;
                    var x_diff = target_x - this.x;
                    var y_diff = target_y - this.y;
                    this.seismicGraphic.beginFill('#000000');
                    this.seismicGraphic.lineStyle(this.branch ? 1 : 3, '#000000', 1);
                    this.seismicGraphic.moveTo(this.x, this.y);


                    // Calculate an x offset from the end of the last line segment and
                    // keep it within the bounds of the bitmap
                    var magnitude = 60; //Magnitude of the random spread
                    if (this.branch) {
                        magnitude = 20;
                    }
                    var last_x = this.x;
                    var last_y = this.y;
                    if (incTower.game.math.distance(this.x, this.y, target_x, target_y) < 50) {
                        this.x = target_x;
                        this.y = target_y;
                    } else {
                        if (x_diff > magnitude * 0.5) {
                            this.x += incTower.game.rnd.integerInRange(0, magnitude);
                        } else if (x_diff < -(magnitude * 0.5)) {
                            this.x += incTower.game.rnd.integerInRange(-magnitude, 0);
                        } else {
                            this.x += incTower.game.rnd.integerInRange(-(magnitude * 0.5), (magnitude * 0.5));
                        }
                        if (y_diff > magnitude * 0.5) {
                            this.y += incTower.game.rnd.integerInRange(0, magnitude);
                        } else if (y_diff < -(magnitude * 0.5)) {
                            this.y += incTower.game.rnd.integerInRange(-magnitude, 0);
                        } else {
                            this.y += incTower.game.rnd.integerInRange(-(magnitude * 0.5), (magnitude * 0.5));
                        }
                    }
                    this.totalDistance += incTower.game.math.distance(this.x,this.y, last_x, last_y);
                    if (this.x === target_x && this.y === target_y) {
                        this.damage = this.damage.times(1 + (0.03 * (this.totalDistance / 32))); //3% additional damage per 32 pixels traveled
                        var runeChance = 0.5;
                        if (this.branch) { //Branches deal less damage
                            this.damage = this.damage.div(2);
                            runeChance = 1;
                        }
                        this.enemy.addElementalRunesDiminishing('earth', runeChance);
                        this.enemy.assignDamage(this.damage, 'earth');
                        var fadeTween = incTower.game.add.tween(this.seismicGraphic).to({alpha: 0}, 1000, "Linear", true);
                        fadeTween.onComplete.add(function () {
                            this.seismicGraphic.destroy();
                        }, this);
                        incTower.game.time.events.remove(this.timer);
                    }
                    // Draw the line segment
                    this.seismicGraphic.lineTo(this.x, this.y);
                    //seismicGraphic.stroke();
                    // Draw a branch 20% of the time off the main bolt only
                    if (!this.branch) {
                        if (incTower.game.rnd.frac() <= 0.2) {
                            // Draws another, thinner, bolt starting from this position
                            new SeismicEvent(this.x, this.y, this.enemy, true, damage);
                            //createSeismic(x, y, enemy, true);
                        }
                    }
                };

                var impactedEnemies = [];

                incTower.enemys.forEachAlive(function (enemy) {
                    new SeismicEvent(pointer.worldX, pointer.worldY, enemy, false, damage);
                });
            }
        })
    }
    ;

})
;
