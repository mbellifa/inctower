define(['incTower/core', 'lib/knockout', 'lib/lodash', 'lib/bignumber', 'lib/phaser', 'incTower/path'], function (incTower, ko, _, BigNumber, Phaser, path) {
    'use strict';
    var tileSquare = 32;

    incTower.generatingEnemies = false;
    incTower.nukeEnemies = function () {
        incTower.game.tweens.removeFrom(incTower.enemys);
        incTower.enemys.removeAll(true);
    };

    incTower.bossPowers = {
        swarm: {
            name: 'Swarm',
            describe: function () {
                return "This unit is part of a swarm which causes it to spawn several copies with less health.";
            },
            maxLevel: 2
        },
        regenerating: {
            name: 'Regenerating',
            describe: function (mult) {
                return "Regenerates " + (0.5 * mult) + "% of its max health a second.";
            }
        },
        healthy: {
            name: 'Healthy',
            describe: function (mult) {
                return "Has " + (10 * mult) + "% bonus health.";
            }
        },
        fast: {
            name: 'Fast',
            describe: function (mult) {
                return "Moves " + (10 * mult) + "% faster.";
            },
            requirements: function (entry) {
                //Don't allow heavy and fast to mix.
                if (entry.heavy) { return false; }
                return true;
            }

        },
        teleport: {
            name: 'Teleport',
            describe: function (mult) {
                return "Has a 10% chance each second to teleport " + mult + " space(s), this power will only activate if this unit has another unit closer to the end zone to teleport to.";
            }
        },
        shielding: {
            name: 'Shielding',
            describe: function (mult) {
                return "This unit gets a shield that stops the next source of damage every " + incTower.humanizeNumber(4 / mult) + " seconds.";
            }
        },
        'fire-resistant': {
            name: 'Fire-Resistant',
            describe: function (mult) {
                return "Reduces fire damage taken and fire rune attachment chance by " + incTower.humanizeNumber(20 * mult) + "%.";
            },
            maxLevel: 5,
            requirements: function () {
                return incTower.getSkillLevel('fireAffinity') > 0;
            }
        },
        'water-resistant': {
            name: 'Water-Resistant',
            describe: function (mult) {
                return "Reduces water damage taken and water rune attachment chance by " + incTower.humanizeNumber(20 * mult) + "%.";
            },
            maxLevel: 5,
            requirements: function () {
                return incTower.getSkillLevel('waterAffinity') > 0;
            }
        },
        'air-resistant': {
            name: 'Air-Resistant',
            describe: function (mult) {
                return "Reduces air damage taken and air rune attachment chance by " + incTower.humanizeNumber(20 * mult) + "%.";
            },
            maxLevel: 5,
            requirements: function () {
                return incTower.getSkillLevel('airAffinity') > 0;
            }

        },
        'earth-resistant': {
            name: 'Earth-Resistant',
            describe: function (mult) {
                return "Reduces earth damage taken and earth rune attachment chance by " + incTower.humanizeNumber(20 * mult) + "%.";
            },
            maxLevel: 5,
            requirements: function () {
                return incTower.getSkillLevel('earthAffinity') > 0;
            }
        },
        'arcane-resistant': {
            name: 'Arcane-Resistant',
            describe: function (mult) {
                return "Reduces arcane damage taken and arcane rune attachment chance by " + incTower.humanizeNumber(20 * mult) + "%.";
            },
            maxLevel: 5,
            requirements: function () {
                return incTower.getSkillLevel('magicalAffinity') > 0;
            }
        },
        nullzone: {
            name: 'Null-Zone',
            describe: function (mult) {
                return "Towers within " + mult + "space(s) of this unit cannot fire.";
            },
            maxLevel: 10
        },
        armored: {
            name: 'Armored',
            describe: function (mult) {
                if (mult < 5) {
                    return "Takes " + (mult * 20) + "% less kinetic damage.";
                }
                return "Immune to kinetic damage.";
            },
            maxLevel: 5
        },
        heavy: {
            name: 'Heavy',
            describe: function () {
                return "Significantly lower base movement speed but immune to movement altering such as slows and knockbacks. (Freezing works as normal.)";
            },
            maxLevel: 1,
            requirements: function (entry) {
                //Don't allow heavy and flying to mix.
                if (entry.flying) { return false; }
                //Or fast
                if (entry.fast) { return false; }
                return true;
            }
        },
        flying: {
            name: 'Flying',
            describe: function () {
                return "Can move over blocks and towers, but with reduced health. Flying enemies knocked airborn stay in the air for longer.";
            },
            maxLevel: 1,
            requirements: function (entry) {
                //Don't allow heavy and flying to mix.
                if (entry.heavy) { return false; }
                if (entry.preferredPower !== 'flying') { return false; }
                return true;
            }
        }
    };
    incTower.seenPowers = {};
    incTower.generateBasePack = function (normal, numPowers, startCount) {
        var bossPowers = _.keys(incTower.bossPowers);
        var possAnimations = _.keys(incTower.enemyTypes);
        var baseEntry = {
            name: incTower.game.rnd.pick(possAnimations),
            count: 1,
            bonusHealthPercentage: 0,
            regenerating: 0,
            speed: 1,
            scale: 1.3,
            teleport: 0,
            powers: {}
        };
        if (normal) {
            baseEntry.scale = 1;
        }
        if (startCount !== undefined) {
            baseEntry.count = startCount;
        }
        var preferredPower = incTower.enemyTypes[baseEntry.name].power;
        baseEntry.preferredPower = preferredPower;
        if (incTower.bossPowers[preferredPower].requirements && !incTower.bossPowers[preferredPower].requirements(baseEntry)) {
            //If the preferred power of this sprite doesn't meet the requirements, select a new one.
            return incTower.generateBasePack(normal, numPowers);
        }

        baseEntry.length = incTower.enemyTypes[baseEntry.name].animation.length;

        var eligiblePowers = _.clone(bossPowers);

        var randomizeChance = .5;
        console.log("Preferred Power: " + preferredPower);
        var find_power_seen_before = function (power) {
            console.log(power);
            var seenBefore = (incTower.seenPowers[power] || 0) + 1;
            var currentPowerLevel = baseEntry.powers[power] || 0;
            if (currentPowerLevel >= incTower.bossPowers[power].maxLevel) {
                return false;
            }
            if (incTower.bossPowers[power].requirements && !incTower.bossPowers[power].requirements(baseEntry)) {
                return false;
            }
            if (currentPowerLevel > seenBefore) {
                return false;
            }
            return true;
        };
        var find_power_not_seen = function (power) {
            var currentPowerLevel = baseEntry.powers[power] || 0;
            if (currentPowerLevel >= incTower.bossPowers[power].maxLevel) {
                return false;
            }
            if (incTower.bossPowers[power].requirements && !incTower.bossPowers[power].requirements(baseEntry)) {
                return false;
            }
            return true;
        };
        for (var i = 0; i < numPowers; ++i) {

            var currentPreferredLevel = baseEntry.powers[preferredPower] || 0;
            var maximumPowerLevel = Math.max(_.max(_.values(baseEntry.powers)) || 0, 0);
            console.log("Preferred Power: " + preferredPower + " : " + currentPreferredLevel + " <= " + maximumPowerLevel);
            if (currentPreferredLevel < maximumPowerLevel || maximumPowerLevel === 0) {

                _.pull(eligiblePowers, preferredPower);
                if (incTower.game.rnd.frac() < randomizeChance) {
                    incTower.shuffle(eligiblePowers);
                }
                eligiblePowers.unshift(preferredPower);
            } else {
                if (incTower.game.rnd.frac() < randomizeChance) {
                    incTower.shuffle(eligiblePowers);
                }
            }
            console.log(eligiblePowers);
            var power = undefined;
            if (power === undefined) {
                power = _.find(eligiblePowers, find_power_seen_before);
            }
            if (power === undefined) {
                power = _.find(eligiblePowers, find_power_not_seen);
            }

            if (power === 'swarm') {
                baseEntry.swarm = true;
                baseEntry.count += incTower.game.rnd.integerInRange(3, 7);
                if (baseEntry.scale > 0.7) {
                    baseEntry.scale *= 0.8;
                }
            } else if (power === 'teleport') {
                if (baseEntry.count < 2) {
                    baseEntry.count = 2;
                }
                baseEntry[power] = (baseEntry[power] || 0) + 1;

            } else if (power === 'regenerating') {
                baseEntry.regenerating += 0.5;
            } else if (power === 'fast') {
                baseEntry.speed += 0.1;
            } else if (power === 'healthy') {
                baseEntry.bonusHealthPercentage += 10;
            } else if (power === 'flying') {
                baseEntry.flying = 1;
                baseEntry.bonusHealthPercentage -= 40;
            } else {
                baseEntry[power] = (baseEntry[power] || 0) + 1;
            }
            if (power in baseEntry.powers) {
                baseEntry.powers[power]++;
            } else {
                baseEntry.powers[power] = 1;
            }
        }
        _.mapValues(baseEntry.powers, function (level, power) {
            var prevSeen = incTower.seenPowers[power] || 0;
            if (level > prevSeen) {
                incTower.seenPowers[power] = level;
            }
        });
        return baseEntry;

    };

    incTower.generatePack = function (normal) {

        var totalPowers = Math.floor((incTower.wave() / 25) + 1);
        if (normal) { totalPowers = Math.floor(totalPowers / 2); }

        var ret = [];
        if (!normal) {
            while (totalPowers >= 1) {
                var thisPowers = incTower.game.rnd.integerInRange(Math.min(5, totalPowers), totalPowers);
                var baseEntry = incTower.generateBasePack(normal, thisPowers, 1);
                totalPowers -= thisPowers;

                ret.push(baseEntry);
            }
        } else {
            ret.push(incTower.generateBasePack(normal, totalPowers, incTower.game.rnd.integerInRange(3,7)));
        }
        console.log(ret);
        return ret;
    };

    incTower.selectedBossPack = false; //This holds our next boss, it's randomly generated and then remembered until beaten

    incTower.enemyTypes = {
        duck: {
            animation: [
                'duck01.png',
                'duck02.png',
                'duck03.png',
                'duck04.png',
                'duck05.png',
                'duck06.png',
                'duck07.png',
                'duck08.png'
            ],
            power: 'swarm'
        },
        panda: {
            animation: [
                'panda01.png',
                'panda02.png',
                'panda03.png'
            ],
            power: 'shielding'

        },
        dog: {
            animation: [
                'dog01.png',
                'dog02.png',
                'dog03.png',
                'dog04.png',
                'dog05.png',
                'dog06.png'
            ],
            power: 'fast'
        },
        penguin: {
            animation: [
                'penguin01.png',
                'penguin02.png',
                'penguin03.png',
                'penguin04.png'
            ],
            power: 'healthy'
        },
        goblin: {
            animation: [
                'goblin01.png',
                'goblin02.png',
                'goblin03.png'
            ],
            power: 'regenerating'
        },
        skeleton: {
            animation: [
                'skeleton01.png',
                'skeleton02.png',
                'skeleton03.png'
            ],
            //power: 'bleed-resist'
            power: 'teleport'
        },
        zombie: {
            animation: [
                'zombie01.png',
                'zombie02.png',
                'zombie03.png'
            ],
            power: 'teleport'
        },
        icebeetle: {
            animation: [
                'icebeetle-01.png',
                'icebeetle-02.png',
                'icebeetle-03.png',
                'icebeetle-04.png',
                'icebeetle-05.png',
            ],
            power: 'water-resistant'
        },
        firebeetle: {
            animation: [
                'firebeetle-01.png',
                'firebeetle-02.png',
                'firebeetle-03.png',
                'firebeetle-04.png',
                'firebeetle-05.png'
            ],
            power: 'fire-resistant'
        },
        blackbeetle: {
            animation: [
                'blackbeetle-01.png',
                'blackbeetle-02.png',
                'blackbeetle-03.png',
                'blackbeetle-04.png',
                'blackbeetle-05.png'
            ],
            power: 'armored'
        },
        greenbeetle: {
            animation: [
                'greenbeetle-01.png',
                'greenbeetle-02.png',
                'greenbeetle-03.png',
                'greenbeetle-04.png',
                'greenbeetle-05.png'
            ],
            power: 'regenerating'
        },
        chicken: {
            animation: [
                'chicken-01.png',
                'chicken-02.png',
                'chicken-03.png',
                'chicken-04.png'
            ],
            power: 'regenerating'
        },
        cow: {
            animation: [
                'cow-01.png',
                'cow-02.png',
                'cow-03.png',
                'cow-04.png'
            ],
            power: 'heavy'
        },
        llama: {
            animation: [
                'llama-01.png',
                'llama-02.png',
                'llama-03.png',
                'llama-04.png'
            ],
            power: 'teleport'
        },
        pig: {
            animation: [
                'pig-01.png',
                'pig-02.png',
                'pig-03.png',
                'pig-04.png'
            ],
            power: 'teleport'
        },
        sheep: {
            animation: [
                'sheep-01.png',
                'sheep-02.png',
                'sheep-03.png',
                'sheep-04.png'
            ],
            power: 'teleport'
        },
        redfairy: {
            animation: [
                'redfairy-01.png',
                'redfairy-02.png',
                'redfairy-03.png',
                'redfairy-04.png',
                'redfairy-05.png',
                'redfairy-06.png'
            ],
            power: 'flying'
        },
        greenfairy: {
            animation: [
                'greenfairy-01.png',
                'greenfairy-02.png',
                'greenfairy-03.png',
                'greenfairy-04.png',
                'greenfairy-05.png',
                'greenfairy-06.png'
            ],
            power: 'flying'
        },
    };

    incTower.generateEnemy = function (difficulty) {
        //var i = 0;
        incTower.generatingEnemies = true;
        var totalWaveGold = incTower.goldPerWave(incTower.wave());
        //Get our random pack type
        var basePack;
        if (incTower.wave() % 5 === 1) {
            incTower.selectedBossPack = false;
        }
        if (incTower.wave() % 5 > 0) {
            //basePack = incTower.normalEnemyPacks[(Math.random() * incTower.normalEnemyPacks.length) | 0];
            basePack = incTower.generatePack(true);
        } else {
            if (!incTower.selectedBossPack) {
                incTower.selectedBossPack = incTower.generatePack(false);
                /*incTower.bossEnemyPacks[(Math.random() * incTower.bossEnemyPacks.length) | 0];*/
            }
            basePack = incTower.selectedBossPack;
        }
        //Expand it out
        var pack = [];
        var remainingHealthMultiplier = 1; //By default we split the health pool evenly across all the mobs
        var unspecifiedHealthWeights = 0;
        basePack.forEach(function (packEntry) {
            var count = 1;
            if ("count" in packEntry) {
                count = packEntry.count;
            }
            for (var j = 0; j < count; j++) {
                var tempPack = {};
                if ("healthWeight" in packEntry) { //We have a specific health weight set so we subtract from our remaining
                    remainingHealthMultiplier -= packEntry.healthWeight;
                } else { //If we don't ahve a weight set we add to the count
                    unspecifiedHealthWeights++;
                }
                for (var key in packEntry) {
                    if (packEntry.hasOwnProperty(key)) {
                        if (key === "count") {
                            continue;
                        }
                        tempPack[key] = packEntry[key];
                    }
                }
                pack.push(tempPack);
            }
        });
        var remainingHealthWeight = remainingHealthMultiplier / unspecifiedHealthWeights;
        for (var j = 0; j < pack.length; j++) {
            if (!("healthWeight" in pack[j])) {
                pack[j].healthWeight = remainingHealthWeight;
            }
            pack[j].health = BigNumber.max(1, difficulty.times(pack[j].healthWeight));
            if ('bonusHealthPercentage' in pack[j]) {
                pack[j].health = pack[j].health.times(1 + (pack[j].bonusHealthPercentage * 0.01));
            }
            pack[j].goldValue = BigNumber.max(totalWaveGold.times(Math.min(1, pack[j].healthWeight).toPrecision(15)), 1).ceil();
        }
        var offset = 0;
        for (var i = 0; i < pack.length; ++i) {
            var packEntry = pack[i];
            if (packEntry.swarm === true) {
                offset -= 16;
            } else {
                offset -= 48;
            }
            new Enemy(offset, path.path[0].y * 32 + 16, packEntry);
        }
        incTower.generatingEnemies = false;

    };
    function EnemyInputDown(sprite, pointer) {
        incTower.currentlySelected(sprite);
    }

    function chilledUpdate(value) {
        if (value > 100) {
            value = 100;
            this.animations.paused = true;
        } else {
            this.animations.paused = false;
        }
        this.animations.currentAnim.speed = this.realSpeed() * 10;
        var others = 255 - value;
        this.tint = incTower.rgbToHex(others, others, 255);
    }

    var Enemy = function (x, y, opts) {
        var incrementObservable = incTower.incrementObservable;
        var anim = incTower.enemyTypes[opts.name].animation;
        Phaser.Sprite.call(this, incTower.game, x, y, 'incTower', anim[0]);
        incTower.game.physics.enable(this, Phaser.Physics.ARCADE);
        this.animations.add('walk', anim, 10, true, false);
        this.animations.play('walk');
        this.anchor.setTo(0.5, 0.5);
        this.speed = 1;

        this.enemy = true;
        this.knockback = false; //Only shows whether we are currently being knocked back orn ot.
        this.statusEffects = {
            chilled: ko.observable(new BigNumber(0)),
            sensitivity: ko.observable(new BigNumber(0)),
            burning: ko.observable(new BigNumber(0)),
            bleeding: ko.observable(new BigNumber(0))
        };
        this.events.onKilled.add(function () {
            if (incTower.currentlySelected() === this || incTower.currentlySelected() !== null && incTower.currentlySelected().enemy && !incTower.currentlySelected().alive) {
                incTower.currentlySelected(null);
            }
            this.removeChildren();
            this.healthbar.destroy();
            if (this.nullzoneGraphic !== undefined) {
                this.nullzoneGraphic.destroy();
            }

            this.healthbar = undefined;
            //This appears to have been causing a memory leak.
            this.animations.destroy();
            this.events.onKilled.dispose();
            this.healthSubscription.dispose();
            this.chillSubscription.dispose();
            if (this.burningSprite) {
                this.burningSprite.animations.destroy();
                this.burningSprite.destroy();
            }

            this.burningSprite = undefined;
            this.floatText = undefined;
            //this.statusEffects = undefined;
            this.realSpeed = undefined;
        }, this);

        this.chillSubscription = this.statusEffects.chilled.subscribe(chilledUpdate, this);
        this.goldValue = ko.observable(opts.goldValue);
        this.healthbar = incTower.game.add.graphics(0, 0);
        this.addChild(this.healthbar);


        this.curTile = -1;
        for (var opt in opts) {
            if (opts.hasOwnProperty(opt)) {
                if (opt === "scale") {
                    //this.scale.set( opts[opt], opts[opt]);
                    this.scale.x = opts[opt];
                    this.scale.y = opts[opt];
                    this.healthbar.scale.x = opts[opt];
                    this.healthbar.scale.y = opts[opt];
                } else if (opt === "speed") {
                    this.speed = opts[opt];
                } else if (!(opt in this)) {
                    this[opt] = opts[opt];
                    if (opt === 'powers') {
                        var powers = opts[opt];
                        var ret = [];
                        _.forEach(_.keys(powers), function (power) {
                            var preferred = opt.preferredPower === power ? 1 : 0;
                            ret.push({'power': power, 'level': powers[power], 'preferred': preferred});
                        });
                        this.sortedPowers = _.orderBy(ret, ['preferred', 'level'], ['desc', 'desc']);

                    }
                }
            }
        }
        if (this.heavy) {
            this.speed *= 0.7;
        }
        if (this.shielding > 0) {
            this.shieldSprite = incTower.game.add.sprite(0, 0, 'incTower', 'bubble.png');
            this.shieldSprite.anchor.setTo(0.5, 0.5);
            this.addChild(this.shieldSprite);
        }
        if (this.nullzone > 0) {
            this.nullzoneGraphic = incTower.game.add.graphics(0, 0);
            //this.addChild(this.nullzoneGraphic);
            this.nullzoneGraphic.beginFill(0x000000,0.5);
            this.nullzoneGraphic.lineStyle(1,0x000000,2);
            this.nullzoneGraphic.drawCircle(0,0,64 * this.nullzone);
            this.nullzoneCircle = new Phaser.Circle(0, 0, 64 * this.nullzone + 16);

        }
        incTower.enemys.add(this);
        this.inputEnabled = true;
        this.events.onInputDown.add(EnemyInputDown, this);
        this.health = ko.observable();

        this.healthSubscription = this.health.subscribe(function (newHealth) {
            this.healthbar.clear();
            var per = newHealth.div(this.maxHealth);
            var x = (per) * 100;
            var colour = incTower.rgbToHex((x > 50 ? 1 - 2 * (x - 50) / 100.0 : 1.0) * 255, (x > 50 ? 1.0 : 2 * x / 100.0) * 255, 0);
            this.healthbar.beginFill(colour);
            this.healthbar.lineStyle(5, colour, 1);
            this.healthbar.moveTo(-16, -21);
            this.healthbar.lineTo(32 * per - 16, -21);
            this.healthbar.endFill();
            incTower.game.world.bringToTop(this.healthbar);
        }, this);
        this.maxHealth = opts.health;
        this.health(new BigNumber(opts.health));
        this.elementalInstability = ko.observable(new BigNumber(0));
        this.elementalRunes = [];
        this.elementalRuneCounts = {};
        this.elementalRuneDiminishing = {};
        this.realSpeed = ko.computed(function () {
            var speed = this.speed;
            console.log(this.speed);
            if (!this.heavy || this.statusEffects.chilled() < 100) { //Heavy enemies are only impacted by chill when they are fully frozen.
                speed -= speed * (this.statusEffects.chilled() * 0.01);
            }
            return Math.max(0, speed);
        }, this);
        if (this.flying) {
            this.path = path.flyingPath.slice(0);
        } else {
            this.path = path.path.slice(0);
        }
        this.nextTile();
        this.moveElmt();

    };

    Enemy.prototype = Object.create(Phaser.Sprite.prototype);
    Enemy.prototype.constructor = Enemy;

    Enemy.prototype.assignDamage = function (damage, type) {
        var incrementObservable = incTower.incrementObservable;
        if (damage.times === undefined) {
            console.trace();
        }
        if (type === undefined) {
            type = "normal";
        }
        if (!this.alive) {
            return;
        }
        var sensitivity = this.statusEffects.sensitivity();
        if (sensitivity > 0) {
            damage = damage.times(1 + (this.statusEffects.sensitivity() * 0.01));
        }
        if (type in this.elementalRuneCounts) {
            damage = damage.times(1 + (this.elementalRuneCounts[type] * 0.20));
        }
        //Add instability if it's an elemental type
        if (type === 'fire' || type === 'water' || type === 'air' || type === 'earth' || type === 'arcane') {
            incrementObservable(this.elementalInstability, BigNumber.random().times(damage));
        }
        if (type === 'water') {
            damage = damage.times(1 + 0.1 * incTower.getEffectiveSkillLevel('waterMastery'));
            damage = damage.times(1 - 0.2 * (this['water-resistant'] || 0));
        } else if (type === 'air') {
            damage = damage.times(1 + 0.1 * incTower.getEffectiveSkillLevel('airMastery'));
            damage = damage.times(1 - 0.2 * (this['air-resistant'] || 0));
        } else if (type === 'fire') {
            damage = damage.times(1 + 0.1 * incTower.getEffectiveSkillLevel('fireMastery'));
            damage = damage.times(1 - 0.2 * (this['fire-resistant'] || 0));
        } else if (type === 'earth') {
            damage = damage.times(1 + 0.1 * incTower.getEffectiveSkillLevel('earthMastery'));
            damage = damage.times(1 - 0.2 * (this['earth-resistant'] || 0));
        } else if (type === 'arcane') {
            damage = damage.times(1 + 0.1 * incTower.getEffectiveSkillLevel('wizardry'));
            damage = damage.times(1 - 0.2 * (this['arcane-resistant'] || 0));
        } else if (type === 'normal' || type === 'kinetic') {
            damage = damage.times(1 - 0.2 * (this.armored || 0));
        }



        if (this.shielded) {
            damage = BigNumber(0);
            this.shieldSprite.visible = false;
            this.shielded = false;
        }
        incTower.incrementObservable(this.health, damage.negated());
        incTower.createFloatingText({'scatter': 0, 'around': this, 'amount': damage.negated(), 'type': 'damage'});
        if (this.health().lte(0)) {
            incTower.gainGold(this.goldValue(), this);
            this.kill();
        }
    };
    Enemy.prototype.moveElmt = function () {
        if (this.knockback || this.teleporting) {
            return;
        }
        var deltaCoords = incTower.game.physics.arcade.velocityFromRotation(this.rotation, this.realSpeed());
        this.x += deltaCoords.x;
        this.y += deltaCoords.y;
        var speed = this.realSpeed();
        //console.log([this.x, this.y, this.speedX, this.speedY, this.nextX, this.nextY]);
        if (Math.abs(this.x - this.nextX) < speed && Math.abs(this.y - this.nextY) < speed) {
            this.x = this.nextX;
            this.y = this.nextY;
            this.nextTile();
        }
    };
    Enemy.prototype.nextTile = function () {
        this.curTile++;
        if (this.curTile === 0 && this.x < 0) {
            this.angle = 0;
            this.nextX = this.path[this.curTile].x * 32 + 16 | 0;
            this.nextY = this.path[this.curTile].y * 32 + 16 | 0;
            return;
        }
        //We ran off the edge
        if (typeof(this.path[this.curTile]) === "undefined") {
            if (incTower.wave() % 5 === 0) {
                //Boss ran off the edge
                incTower.checkHelp('bosses');
                if (incTower.currentlySelected() !== null && incTower.currentlySelected().enemy) {
                    incTower.currentlySelected(null);
                }
                incTower.enemys.forEach(function (theEnemy) {
                    theEnemy.kill();
                });
                incTower.incrementObservable(incTower.wave, -1); //Go back a wave.
                incTower.farmMode(true); //Turn farm mode on
                return;
            } else {
                incTower.checkHelp('regularEdge');
            }
            if (incTower.wave() > 1) {
                this.goldValue(this.goldValue().times(0.9));
            } //Lose 10% of our gold value each time we p
            this.curTile = 0;
            this.x = (this.path[0].x - 1) * tileSquare;
            this.y = this.path[0].y * tileSquare;
        }
        this.reorient();
    };
    Enemy.prototype.reorient = function () {
        this.nextX = this.path[this.curTile].x * tileSquare + 16 | 0;
        this.nextY = this.path[this.curTile].y * tileSquare + 16 | 0;
        this.rotation = incTower.game.physics.arcade.angleToXY(this, this.nextX, this.nextY);
        if (this.angle === 180) {
            this.scale.x = -1;
            this.scale.y = 1;
        } else if (this.angle === -180) {
            this.scale.x = 1;
            this.scale.y = -1;
        } else {
            this.scale.x = 1;
            this.scale.y = 1;
        }

    };
    Enemy.prototype.update = function () {
        if (!this.alive) {
            return;
        }
        if (incTower.paused()) {
            return;
        }

        this.moveElmt();
        if (this.shielding > 0) {
            if (this.lastShieldTime === undefined || this.lastShieldTime + (4000 / this.shielding) < incTower.game.time.now) {
                this.shielded = true;
                this.lastShieldTime = incTower.game.time.now;
                this.shieldSprite.visible = true;
            }
        }
        if (this.nullzone > 0) {
            this.nullzoneGraphic.x = this.x;
            this.nullzoneGraphic.y = this.y;
            this.nullzoneCircle.x = this.x;
            this.nullzoneCircle.y = this.y;
            var nullzoneCircle = this.nullzoneCircle;
            incTower.towers_group.forEachAlive(function (tower) {
                if (nullzoneCircle.contains(tower.x, tower.y)) {
                    if (tower.disabledFrames() < 3) {
                        tower.disabledFrames(3);
                    }
                }
            });
        }
    };
    Enemy.prototype.addElementalRune = function (runeType) {
        var iconName = runeType + '-element.png';
        var runeIcon = incTower.game.add.sprite(0, 0, 'incTower', iconName);
        this.elementalRunes.push(runeIcon);
        runeIcon.scale.x = 0.8;
        runeIcon.scale.y = 0.8;
        runeIcon.anchor.setTo(0, 1);
        var magic = this.elementalRunes.length * 8;
        runeIcon.x = 16 + Math.floor(magic / 32) * 8;
        runeIcon.y = -16 + magic % 32;
        runeIcon.runeType = runeType;
        this.addChild(runeIcon);
        if (!(runeType in this.elementalRuneCounts)) {
            this.elementalRuneCounts[runeType] = 0;
        }
        this.elementalRuneCounts[runeType]++;
    };
    Enemy.prototype.addElementalRunesDiminishing = function (runeType, baseChance, number) {
        if (number === undefined) {
            number = 1;
        }
        var countAdded = 0;
        for (var i = 0; i < number; i++) {
            //Reduce the chance to attach the rune by 10% for each
            var chance = baseChance;
            //console.log("Base Chance: " + chance);
            chance *= Math.pow(0.95, this.elementalRuneDiminishing[runeType] || 0);
            //console.log("After diminish: " + chance);
            chance *=  1 - (0.2 * (this[runeType + '-resistant'] || 0));
            //console.log("After resistant: " + chance);
            chance *= Math.pow(0.7, this.elementalRuneCounts[runeType] || 0);
            //console.log("After counts: " + chance);
            if (incTower.game.rnd.frac() < chance) {
                countAdded++;
                this.addElementalRune(runeType);
            }

        }
        return countAdded;
    };

    Enemy.prototype.repositionRunes = function () {
        this.elementalRuneCounts = {};
        //This is called after we have deleted some runes so we'll recount as well.
        for (var i = 0; i < this.elementalRunes.length; i++) {
            var magic = i * 8;
            this.elementalRunes[i].x = 16 + Math.floor(magic / 32) * 8;
            this.elementalRunes[i].y = -16 + magic % 32;
            var runeType = this.elementalRunes[i].runeType;
            if (!(runeType in this.elementalRuneCounts)) {
                this.elementalRuneCounts[runeType] = 0;
            }
            this.elementalRuneCounts[runeType]++;

        }

    };
    Enemy.prototype.addDiminishingReturns = function (rune, amount) {
        this.elementalRuneDiminishing[rune] = (this.elementalRuneDiminishing[rune] || 0) + amount;
    };
    Enemy.prototype.performReaction = function (reaction, reactionCounts, opts) {
        var incrementObservable = incTower.incrementObservable;
        if (opts === undefined) {
            opts = {};
        }
        if (!this.alive) {
            return;
        }
        if (this.statusEffects === undefined) {
            return;
        }
        for (var key in reactionCounts) {
            this.addDiminishingReturns(key, reactionCounts[key]);
        }
        if (reaction === 'water') {
            var iceStormChance = reactionCounts.water - 4;
            if (iceStormChance > 0 && !opts.noStorm && incTower.game.rnd.integerInRange(1, 100) >= iceStormChance) {
                var newOpts = opts;
                newOpts.noStorm = true;
                incTower.enemys.forEachAlive(function (enemy) {
                    enemy.performReaction(reaction, reactionCounts, newOpts);
                    incTower.createFloatingText({
                        'color': '#0000CC',
                        'duration': 3000,
                        'around': this,
                        'text': 'Ice Storm!',
                        'type': 'iceStorm'
                    });
                });
            }
            incrementObservable(this.statusEffects.chilled, 50 * reactionCounts.water);
            if (this.statusEffects.chilled().gte(100)) {
                incTower.createFloatingText({
                    'color': '#0000CC',
                    'duration': 2000,
                    'around': this,
                    'text': 'Frozen!',
                    'type': 'frozen'
                });
            }
            this.assignDamage(this.elementalInstability().times(Math.pow(1.2, Math.max(0, reactionCounts.water - 1))), 'water');

        } else if (reaction === 'fire') {
            var fireStormChance = reactionCounts.fire - 4;
            if (fireStormChance > 0 && !opts.noStorm && incTower.game.rnd.integerInRange(1, 100) >= fireStormChance) {
                var newOpts = opts;
                newOpts.noStorm = true;
                incTower.enemys.forEachAlive(function (enemy) {
                    enemy.performReaction(reaction, reactionCounts, newOpts);
                    incTower.createFloatingText({
                        'color': '#CC0000',
                        'duration': 3000,
                        'around': this,
                        'text': 'Fire Storm!',
                        'type': 'fireStorm'
                    });
                });
            }
            incrementObservable(this.statusEffects.sensitivity, 20 * reactionCounts.fire);
            incrementObservable(this.statusEffects.burning, this.elementalInstability().times(Math.pow(1.2, Math.max(0, reactionCounts.fire - 1))));
            if (this.burningSprite === undefined) {
                this.burningSprite = incTower.game.add.sprite(0, -4, 'incTower', "smokefire-0001.png");
                this.burningSprite.anchor.setTo(0.5, 0.5);
                this.burningSprite.scale.x = 0.5;
                this.burningSprite.scale.y = 0.5;
                this.burningSprite.angle = 270;
                this.addChild(this.burningSprite);
                this.burningSprite.animations.add('burn', [
                    "smokefire-0001.png",
                    "smokefire-0002.png",
                    "smokefire-0003.png",
                    "smokefire-0004.png",
                    "smokefire-0005.png",
                    "smokefire-0006.png",
                    "smokefire-0007.png",
                    "smokefire-0008.png",
                    "smokefire-0009.png",
                    "smokefire-0010.png",
                    "smokefire-0011.png",
                    "smokefire-0012.png",
                    "smokefire-0013.png",
                    "smokefire-0014.png",
                    "smokefire-0015.png",
                    "smokefire-0016.png",
                    "smokefire-0017.png",
                    "smokefire-0018.png",
                    "smokefire-0019.png",
                    "smokefire-0020.png"
                ], 10, true, false);
                this.burningSprite.animations.play('burn');
            } else {
                this.burningSprite.visible = true;
            }
        } else if (reaction === 'earth') {
            var boulderStormChance = reactionCounts.earth - 4;
            if (boulderStormChance > 0 && !opts.noStorm && incTower.game.rnd.integerInRange(0, 100) >= boulderStormChance) {
                var newOpts = opts;
                newOpts.noStorm = true;
                incTower.enemys.forEachAlive(function (enemy) {
                    enemy.performReaction(reaction, reactionCounts, newOpts);
                    //incTower.createFloatingText({'color':'#CC0000', 'duration':3000, 'around':this,'text':'Fire Storm!', 'type':'fireStorm'});
                });
            }
            var boulder = incTower.game.add.sprite(this.x, this.y, 'incTower', 'rock' + incTower.game.rnd.integerInRange(1, 3) + '.png');
            boulder.anchor.setTo(0.5, 0.5);
            incTower.game.physics.enable(boulder, Phaser.Physics.ARCADE);
            var bigDim = boulder.width;
            if (boulder.height > bigDim) {
                bigDim = boulder.height;
            }
            var endWidth = Math.max(tileSquare * reactionCounts.earth * 0.5, tileSquare);
            var startWidth = endWidth * 4;
            boulder.damageOnImpact = this.elementalInstability().times(Math.pow(1.2, Math.max(0, reactionCounts.earth - 1)));
            boulder.scale.x = startWidth / bigDim;
            boulder.scale.y = startWidth / bigDim;

            var boulderTween = incTower.game.add.tween(boulder.scale).to({
                x: endWidth / bigDim,
                y: endWidth / bigDim
            }, 500, Phaser.Easing.Quadratic.In, true);
            boulderTween.onComplete.add(function () {
                incTower.game.physics.arcade.overlap(this, incTower.enemys, function (boulder, enemy) {
                    enemy.assignDamage(boulder.damageOnImpact, 'earth');
                    enemy.addDiminishingReturns('earth', reactionCounts.earth);
                    incTower.incrementObservable(enemy.statusEffects.bleeding, boulder.damageOnImpact);
                }, null, this);
                this.destroy();
            }, boulder);
        } else if (reaction === 'air') {
            var originX = this.x;
            var originY = this.y;
            var minX = Math.max(0, originX - 32 * reactionCounts.air);
            var maxX = Math.min(800, originX + 32 * reactionCounts.air);
            var minY = Math.max(0, originY - 32 * reactionCounts.air);
            var maxY = Math.min(608, originY + 32 * reactionCounts.air);
            var tweenLength = Math.max(500, Math.min(1500, 250 * reactionCounts.air - 1));
            var windStormChance = reactionCounts.air - 4;
            var windStorm = false;
            if (windStormChance > 0 && !opts.noStorm && incTower.game.rnd.integerInRange(1, 100) >= windStormChance) {
                //When we get a windstorm we impact all enemies on the map
                windStorm = true;
            }

            //var destTileNum = Math.floor(Math.max(0,this.curTile - Math.max(1,diminishingReturns(reactionCounts.air, 2))));
            var destTileNum = Math.floor(Math.max(0, this.curTile - Math.max(1, reactionCounts.air)));
            var kbX = this.path[destTileNum].x * 32 + 16; //Knock back X and Y
            var kbY = this.path[destTileNum].y * 32 + 16;
            var impactedEnemies = [];
            for (var i = 0; i < incTower.enemys.children.length; i++) {
                if (!incTower.enemys.children[i].alive) {
                    continue;
                }
                if (windStorm) {
                    impactedEnemies.push(incTower.enemys.children[i]);
                } else if (incTower.enemys.children[i].x >= minX && incTower.enemys.children[i].x <= maxX && incTower.enemys.children[i].y >= minY && incTower.enemys.children[i].y <= maxY) {
                    impactedEnemies.push(incTower.enemys.children[i]);
                }
            }
            var airDamage = this.elementalInstability().times(Math.pow(1.2, Math.max(0, reactionCounts.air - 1)));

            for (var i = 0; i < impactedEnemies.length; i++) {
                impactedEnemies[i].assignDamage(airDamage, 'air');
                if (!impactedEnemies[i].heavy && impactedEnemies[i].alive) {
                    impactedEnemies[i].knockback = true;
                    impactedEnemies[i].animations.paused = true;
                    impactedEnemies[i].curTile = destTileNum;
                    impactedEnemies[i].addDiminishingReturns('air', reactionCounts.air * 3);
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
    };
});
