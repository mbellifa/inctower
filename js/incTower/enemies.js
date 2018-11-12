define(['incTower/core', 'lib/knockout', 'lib/lodash', 'lib/bignumber', 'lib/phaser', 'incTower/path', 'incTower/save'], function (incTower, ko, _, BigNumber, Phaser, path, saveModule) {
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
            maxLevel: 2,
            ofNoun: ['Replication'],
            adjective: ['Fertile', 'Abundant', 'Fruitful']
        },
        regenerating: {
            name: 'Regenerating',
            describe: function (mult) {
                return "Regenerates " + (0.5 * mult) + "% of its max health a second.";
            },
            ofNoun: ['Regeneration'],
            adjective: ['Regenerating', 'Restorative']
        },
        healthy: {
            name: 'Healthy',
            describe: function (mult) {
                return "Has " + (10 * mult) + "% bonus health.";
            },
            ofNoun: ['Vigor'],
            adjective: ['Healthy', 'Hearty', 'Robust']
        },
        fast: {
            name: 'Fast',
            describe: function (mult) {
                return "Moves " + (10 * mult) + "% faster.";
            },
            requirements: function (entry) {
                //Don't allow heavy and fast to mix.
                if (entry.heavy) {
                    return false;
                }
                return true;
            },
            ofNoun: ['Alacrity'],
            adjective: ['Fast', 'Agile', 'Nimble', 'Quick', 'Swift']

        },
        teleport: {
            name: 'Teleport',
            describe: function (mult) {
                return "Has a 10% chance each second to teleport " + mult + " space(s), this power will only activate if this unit has another unit closer to the end zone to teleport to.";
            },
            ofNoun: ['Foresight'],
            adjective: ['Beaming', 'Otherworldly']
        },
        shielding: {
            name: 'Shielding',
            describe: function (mult) {
                return "This unit gets a shield that stops the next source of damage every " + incTower.humanizeNumber(4 / mult) + " seconds.";
            },
            ofNoun: ['Shielding'],
            adjective: ['Safeguarded', 'Protected']
        },
        'fire-resistant': {
            name: 'Fire-Resistant',
            describe: function (mult) {
                return "Reduces fire damage taken and fire rune attachment chance by " + incTower.humanizeNumber(20 * mult) + "%.";
            },
            maxLevel: 5,
            requirements: function () {
                return incTower.getSkillLevel('fireAffinity') > 0;
            },
            ofNoun: ['Flame Resistance'],
            adjective: ['Flame Retardant']
        },
        'water-resistant': {
            name: 'Water-Resistant',
            describe: function (mult) {
                return "Reduces water damage taken and water rune attachment chance by " + incTower.humanizeNumber(20 * mult) + "%.";
            },
            maxLevel: 5,
            requirements: function () {
                return incTower.getSkillLevel('waterAffinity') > 0;
            },
            ofNoun: ['Water Resistance'],
            adjective: ['Icy']
        },
        'air-resistant': {
            name: 'Air-Resistant',
            describe: function (mult) {
                return "Reduces air damage taken and air rune attachment chance by " + incTower.humanizeNumber(20 * mult) + "%.";
            },
            maxLevel: 5,
            requirements: function () {
                return incTower.getSkillLevel('airAffinity') > 0;
            },
            ofNoun: ['Air Resistance'],
            adjective: ['Wind Defiant']

        },
        'earth-resistant': {
            name: 'Earth-Resistant',
            describe: function (mult) {
                return "Reduces earth damage taken and earth rune attachment chance by " + incTower.humanizeNumber(20 * mult) + "%.";
            },
            maxLevel: 5,
            requirements: function () {
                return incTower.getSkillLevel('earthAffinity') > 0;
            },
            ofNoun: ['Earth Resistance'],
            adjective: ['Grounded']
        },
        'arcane-resistant': {
            name: 'Arcane-Resistant',
            describe: function (mult) {
                return "Reduces arcane damage taken and arcane rune attachment chance by " + incTower.humanizeNumber(20 * mult) + "%.";
            },
            maxLevel: 5,
            requirements: function () {
                return incTower.getSkillLevel('magicalAffinity') > 0;
            },
            ofNoun: ['Arcane Resistance'],
            adjective: ['Wizardproof']
        },
        nullzone: {
            name: 'Null-Zone',
            describe: function (mult) {
                return "Towers within " + incTower.humanizeNumber(1 + (mult * 0.5)) + " space(s) of this unit cannot fire.";
            },
            maxLevel: 10,
            ofNoun: ['Dampening'],
            adjective: ['Diminishing', 'Depressed']
        },
        armored: {
            name: 'Armored',
            describe: function (mult) {
                if (mult < 5) {
                    return "Takes " + (mult * 20) + "% less kinetic damage.";
                }
                return "Immune to kinetic damage.";
            },
            maxLevel: 5,
            ofNoun: ['the Adamantine'],
            adjective: ['Armored']
        },
        heavy: {
            name: 'Heavy',
            describe: function () {
                return "Significantly lower base movement speed but immune to movement altering such as slows and knockbacks. (Freezing works as normal.)";
            },
            maxLevel: 1,
            requirements: function (entry) {
                //Don't allow heavy and flying to mix.
                if (entry.flying) {
                    return false;
                }
                //Or fast
                if (entry.fast) {
                    return false;
                }
                return true;
            },
            ofNoun: ['Substantial Girth'],
            adjective: ['Heavy', 'Bulky', 'Hefty', 'Weighty']
        },
        flying: {
            name: 'Flying',
            describe: function () {
                return "Can move over blocks and towers, but with reduced health. Flying enemies knocked airborn stay in the air for longer.";
            },
            maxLevel: 1,
            requirements: function (entry) {
                //Don't allow heavy and flying to mix.
                if (entry.heavy) {
                    return false;
                }
                return _.includes(entry.preferredPowers,'flying'); //Don't allow this power if it's not preferred.
            },
            ofNoun: ['Flight'],
            adjective: ['Floating', 'Aerial', 'Soaring']
        },
        directionalShield: {
            name: 'Directional-Shield',
            describe: function (mult) {
                return "Summons an impervious shield which blocks projectiles in a " + (45 * mult) + " degree radius around it.";
            },
            maxLevel: 6,
            ofNoun: ['Blocking'],
            adjective: ['Oriented']
        },
        healer: {
            name: 'Healer',
            describe: function (mult) {
                return "Once every 10 seconds this unit can heal itself for " + (2.5 * mult) + "% or another unit for " + (5 * mult) + "% of its max health. Casting requires it to stop moving.";
            },
            ofNoun: ['Curing'],
            adjective: ['Healing', 'Therapeutic']
        },
        steelSkin: {
            name: 'Steel-Skinned',
            describe: function (mult) {
                if (mult < 2) {
                    return "Takes " + (mult * 50) + "% less damage from damage over time effects such as bleeding and burning.";
                }
                return "Immune to damage over time effects such as bleeding and burning.";
            },
            maxLevel: 2,
            ofNoun: ['the Iron-Clad'],
            adjective: ['Steel-Skinned']
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
        var preferredPowers = incTower.enemyTypes[baseEntry.name].power;
        if (!_.isArray(preferredPowers)) { preferredPowers = [preferredPowers]; }
        baseEntry.preferredPowers = preferredPowers;
        var valid = true;

        _.forEach(preferredPowers, function (preferredPower) {
            if (valid && incTower.bossPowers[preferredPower].requirements && !incTower.bossPowers[preferredPower].requirements(baseEntry)) {
                console.log("Marked invalid for " + preferredPower);
                valid = false;
            }
        });
        //If the preferred power of this sprite doesn't meet the requirements, select a new one.
        if (!valid) { return incTower.generateBasePack(normal, numPowers, startCount); }



        baseEntry.length = incTower.enemyTypes[baseEntry.name].animation.length;

        var eligiblePowers = _.clone(bossPowers);

        var randomizeChance = 0.5;
        //console.log("Preferred Power: " + preferredPower);
        var findPowerSeenBefore = function (power) {
            //console.log(power);
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
        var findPowerNotSeen = function (power) {
            var currentPowerLevel = baseEntry.powers[power] || 0;
            if (currentPowerLevel >= incTower.bossPowers[power].maxLevel) {
                return false;
            }
            if (incTower.bossPowers[power].requirements && !incTower.bossPowers[power].requirements(baseEntry)) {
                return false;
            }
            return true;
        };
        var preferredPowerFunc = function (preferredPower) { return baseEntry.powers[preferredPower] || 0; };
        for (var i = 0; i < numPowers; ++i) {
            var currentPreferredLevel = _.max(_.map(preferredPowers, preferredPowerFunc));
            var maximumPowerLevel = Math.max(_.max(_.values(baseEntry.powers)) || 0, 0);
            //console.log("Preferred Power: " + preferredPower + " : " + currentPreferredLevel + " <= " + maximumPowerLevel);
            if (incTower.game.rnd.frac() < randomizeChance) { incTower.shuffle(eligiblePowers); }
            if (currentPreferredLevel < maximumPowerLevel || maximumPowerLevel === 0) {
                _.pullAll(eligiblePowers, preferredPowers);
                eligiblePowers = _.concat(preferredPowers, eligiblePowers);
            }

            var power = false;
            if (power === false) {
                power = _.find(eligiblePowers, findPowerSeenBefore);
            }
            if (power === false) {
                power = _.find(eligiblePowers, findPowerNotSeen);
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
            } else if (power === 'directionalShield') {
                baseEntry.directionalShieldOffset = incTower.game.rnd.integerInRange(-180, 180);
                baseEntry[power] = (baseEntry[power] || 0) + 1;
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
        baseEntry.title = incTower.getPackName(baseEntry);
        return baseEntry;

    };


    incTower.generatePack = function (normal) {

        var totalPowers = Math.floor((incTower.wave() / 25) + 1);
        if (normal) {
            totalPowers = Math.floor(totalPowers * 0.5);
        }

        var ret = [];
        if (!normal) {
            while (totalPowers >= 1) {
                var thisPowers = incTower.game.rnd.integerInRange(Math.min(5, totalPowers), totalPowers);
                var baseEntry = incTower.generateBasePack(normal, thisPowers, 1);
                totalPowers -= thisPowers;

                ret.push(baseEntry);
            }
        } else {
            ret.push(incTower.generateBasePack(normal, totalPowers, incTower.game.rnd.integerInRange(3, 7)));
        }
        //console.log(ret);
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
            nounSingle: ['Penguin'],
            nounPlural: ['Penguins'],
            power: ['swarm', 'earth-resistant']
        },
        panda: {
            animation: [
                'panda01.png',
                'panda02.png',
                'panda03.png'
            ],
            power: ['shielding', 'healthy'],
            nounSingle: ['Panda'],
            nounPlural: ['Pandas']
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
            power: 'fast',
            nounSingle: ['Hound', 'Dog', 'Doggo', 'Pupper'],
            nounPlural: ['Hounds', 'Dogs', 'Doggos', 'Puppers']
        },
        penguin: {
            animation: [
                'penguin01.png',
                'penguin02.png',
                'penguin03.png',
                'penguin04.png'
            ],
            power: ['healthy', 'fire-resistant'],
            nounSingle: ['Penguin'],
            nounPlural: ['Penguins']
        },
        goblin: {
            animation: [
                'goblin01.png',
                'goblin02.png',
                'goblin03.png'
            ],
            power: ['regenerating', 'fast'],
            nounSingle: ['Goblin'],
            nounPlural: ['Goblins']
        },
        skeleton: {
            animation: [
                'skeleton01.png',
                'skeleton02.png',
                'skeleton03.png'
            ],
            power: ['steelSkin'],
            nounSingle: ['Skeleton'],
            nounPlural: ['Skeletons']
        },
        zombie: {
            animation: [
                'zombie01.png',
                'zombie02.png',
                'zombie03.png'
            ],
            power: ['teleport', 'shielding'],
            nounSingle: ['Zombie'],
            nounPlural: ['Zombies']
        },
        icebeetle: {
            animation: [
                'icebeetle-01.png',
                'icebeetle-02.png',
                'icebeetle-03.png',
                'icebeetle-04.png',
                'icebeetle-05.png'
            ],
            power: ['water-resistant', 'armored'],
            nounSingle: ['Ice Beetle'],
            nounPlural: ['Ice Beetles']
        },
        firebeetle: {
            animation: [
                'firebeetle-01.png',
                'firebeetle-02.png',
                'firebeetle-03.png',
                'firebeetle-04.png',
                'firebeetle-05.png'
            ],
            power: ['fire-resistant', 'steelSkin'],
            nounSingle: ['Fire Beetle'],
            nounPlural: ['Fire Beetles']
        },
        blackbeetle: {
            animation: [
                'blackbeetle-01.png',
                'blackbeetle-02.png',
                'blackbeetle-03.png',
                'blackbeetle-04.png',
                'blackbeetle-05.png'
            ],
            power: ['armored', 'arcane-resistant'],
            nounSingle: ['Black Beetle'],
            nounPlural: ['Black Beetles']

        },
        greenbeetle: {
            animation: [
                'greenbeetle-01.png',
                'greenbeetle-02.png',
                'greenbeetle-03.png',
                'greenbeetle-04.png',
                'greenbeetle-05.png'
            ],
            power: ['regenerating', 'healer'],
            nounSingle: ['Green Beetle'],
            nounPlural: ['Green Beetles']

        },
        chicken: {
            animation: [
                'chicken-01.png',
                'chicken-02.png',
                'chicken-03.png',
                'chicken-04.png'
            ],
            power: ['swarm', 'fast'],
            nounSingle: ['Chicken'],
            nounPlural: ['Chickens']

        },
        cow: {
            animation: [
                'cow-01.png',
                'cow-02.png',
                'cow-03.png',
                'cow-04.png'
            ],
            power: ['heavy', 'air-resistant'],
            nounSingle: ['Cow'],
            nounPlural: ['Cows']

        },
        llama: {
            animation: [
                'llama-01.png',
                'llama-02.png',
                'llama-03.png',
                'llama-04.png'
            ],
            power: 'teleport',
            nounSingle: ['Llama'],
            nounPlural: ['Llamas']

        },
        pig: {
            animation: [
                'pig-01.png',
                'pig-02.png',
                'pig-03.png',
                'pig-04.png'
            ],
            power: ['teleport', 'heavy'],
            nounSingle: ['Pig'],
            nounPlural: ['Pigs']

        },
        sheep: {
            animation: [
                'sheep-01.png',
                'sheep-02.png',
                'sheep-03.png',
                'sheep-04.png'
            ],
            power: ['healer', 'directionalShield'],
            nounSingle: ['Sheep'],
            nounPlural: ['Sheep']

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
            power: 'flying',
            nounSingle: ['Red Fairy'],
            nounPlural: ['Red Fairies']

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
            power: ['flying', 'healer'],
            nounSingle: ['Green Fairy'],
            nounPlural: ['Green Fairies']

        },
        blackgolem: {
            animation: [
                'blackgolem-01.png',
                'blackgolem-02.png',
                'blackgolem-03.png'
            ],
            power: ['heavy', 'armored'],
            nounSingle: ['Black Golem'],
            nounPlural: ['Black Golems']

        },

        icegolem: {
            animation: [
                'icegolem-01.png',
                'icegolem-02.png',
                'icegolem-03.png'
            ],
            power: ['water-resistant', 'directionalShield'],
            nounSingle: ['Ice Golem'],
            nounPlural: ['Ice Golems']

        },
        darkwizard: {
            animation: [
                'darkwizard-01.png',
                'darkwizard-02.png',
                'darkwizard-03.png'
            ],
            power: 'nullzone',
            nounSingle: ['Dark Wizard'],
            nounPlural: ['Dark Wizards']
        },
        redwizard: {
            animation: [
                'redwizard-01.png',
                'redwizard-02.png',
                'redwizard-03.png'
            ],
            power: ['nullzone', 'arcane-resistant'],
            nounSingle: ['Red Wizard'],
            nounPlural: ['Red Wizards']
        },
        skull: {
            animation: [
                'skull-01.png',
                'skull-02.png',
                'skull-03.png'
            ],
            power: ['nullzone', 'earth-resistant'],
            nounSingle: ['Floating Skull'],
            nounPlural: ['Floating Skulls']

        },
        turtle: {
            animation: [
                'turtle-01.png',
                'turtle-02.png',
                'turtle-03.png'
            ],
            power: 'shielding',
            nounSingle: ['Turtle'],
            nounPlural: ['Turtles']

        }
    };
    var totalPowers = [];
    _.forEach(_.shuffle(_.keys(incTower.enemyTypes)), function (firstEnemy) {
        var firstPowers = incTower.enemyTypes[firstEnemy].power;
        if (!_.isArray(firstPowers)) { firstPowers = [firstPowers]; }
        totalPowers = _.concat(totalPowers, firstPowers);
        var invalidPower = _.find(firstPowers, function (val) { return incTower.bossPowers[val] === undefined; });
        if (invalidPower) {
            console.log("INVALID: " + invalidPower + ' on ' + firstEnemy);
        }

        _.forEach(_.keys(incTower.enemyTypes), function (secondEnemy) {
            if (firstEnemy === secondEnemy) { return; }
            var secondPowers = incTower.enemyTypes[secondEnemy].power;
            if (!_.isArray(secondPowers)) { secondPowers = [secondPowers]; }
            if (firstPowers.length === secondPowers.length && _.difference(firstPowers, secondPowers).length === 0) {
                console.log(firstEnemy + " - " + secondEnemy);
            }


        });
    });
    var powerCounts = _.countBy(totalPowers);
    _.forEach(_.keys(incTower.bossPowers), function (power) {
        if (!powerCounts[power]) { powerCounts[power] = 0; }
    });
    powerCounts = _.sortBy(_.toPairs(powerCounts), function (val) { return val[1]; });
    //console.log(powerCounts);


    incTower.getPackName = function (pack) {
        var formatStrings = [
            '%possessiveTitle% %noun% %ofPower%',
            '%adjectivePower% %noun% %ofPower%'
        ];
        var currentFormat = incTower.game.rnd.pick(formatStrings);
        var powerList = [];
        _.forOwn(pack.powers, function (rank, power) {
            powerList.push({'level': rank, 'power': power});
        });
        var packPowers = _.orderBy(powerList, ['level'], ['desc']);
        packPowers.push({'power': 'generic', 'level': 1});
//        console.log(packPowers);
        var repeat = true;
        while (repeat) {
            repeat = false;
            currentFormat = currentFormat.replace(/%(\w+)%/g, function (match, token) {
                repeat = true;
                if (token === 'noun') {
                    if (pack.count > 1) {
                        return incTower.game.rnd.pick(incTower.enemyTypes[pack.name].nounPlural);
                    }
                    return incTower.game.rnd.pick(incTower.enemyTypes[pack.name].nounSingle);
                }
                if (token === 'possessiveTitle') {
                    var gender = incTower.game.rnd.pick(['male', 'female']);
                    var titles = [];
                    var names = [];
                    if (gender === 'male') {
                        titles = ['King', 'Lord', 'Duke', 'Viscount', 'Czar', 'Emporer', 'Khan', 'Prince', 'Count'];
                        names = ['Merek', 'Carac', 'Tybalt', 'Brom', 'Hadrian'];
                    } else {
                        titles = ['Queen', 'Lady', 'Duchess', 'Princess', 'Countess'];
                        names = ['Millicent', 'Ellyn', 'Thea', 'Gloriana', 'Beatrix', 'Mirabelle', 'Seraphina'];
                    }
                    return incTower.game.rnd.pick(titles) + ' ' + incTower.game.rnd.pick(names) + "'s";
                }
                if (token === 'ofPower') {
                    var power = incTower.game.rnd.weightedPick(packPowers);
                    _.pull(packPowers, power);
                    packPowers.push(power);
                    power = power.power;
                    if (power === 'generic') {
                        return incTower.game.rnd.pick(['of the %genericAdj% %genericNounSingular%']);
                    }
                    return 'of ' + incTower.game.rnd.pick(incTower.bossPowers[power].ofNoun);
                }
                if (token === 'adjectivePower') {
                    var power = incTower.game.rnd.weightedPick(packPowers);
                    _.pull(packPowers, power);
                    packPowers.push(power);
                    power = power.power;
                    if (power === 'generic') {
                        return incTower.game.rnd.pick([
                            'Alert',
                            'Arrogant',
                            'Assertive',
                            'Bold',
                            'Boundless',
                            'Brazen',
                            'Callous',
                            'Crude',
                            'Dark',
                            'Dauntless',
                            'Defiant',
                            'Determined',
                            'Dreamer',
                            'Efficient',
                            'Ferocious',
                            'Frantic',
                            'Furious',
                            'Hostile',
                            'Malicious',
                            'Ornery',
                            'Practical',
                            'Profane',
                            'Repulsive',
                            'Rough',
                            'Rude',
                            'Scornful',
                            'Sly',
                            'Spiteful',
                            'Tenacious',
                            'Uncouth',
                            'Vain',
                            'Vulgar',
                            'Wretched'
                        ]);
                    }
                    return incTower.game.rnd.pick(incTower.bossPowers[power].adjective);
                }
                if (token === 'genericNounSingular') {
                    return incTower.game.rnd.pick([
                        'Age',
                        'Bone',
                        'Chain',
                        'Dawn',
                        'Flame',
                        'Horn',
                        'Ice',
                        'Lamp',
                        'Lotus',
                        'Mask',
                        'Mother',
                        'Night',
                        'Scarecrow',
                        'Seed',
                        'Throne',
                        'Veil',
                        'Volcano',
                        'Year'
                    ]);
                }
                if (token === 'genericAdj') {
                    return incTower.game.rnd.pick([
                        'Blackened',
                        'Blessed',
                        'Ethereal',
                        'Glorious',
                        'Golden',
                        'Last',
                        'Twisted',
                        'Wrathful'
                    ]);
                }
                if (token === 'genericNormalizedVerb') {
                    return incTower.game.rnd.pick([
                        'Destroyer',
                        'Bringer'
                    ]);
                }
            });

        }
        return currentFormat;
    };

    incTower.generateEnemy = function (difficulty) {
        //var i = 0;
        //console.log("Difficulty: " + incTower.humanizeNumber(difficulty));
        incTower.generatingEnemies = true;
        var totalWaveGold = incTower.goldPerWave(incTower.wave());
        //Get our random pack type
        var basePack;
        if (incTower.maxWave() % 5 === 1) { incTower.selectedBossPack = false; } // Clear the boss pack when we've cleared one
        if (incTower.wave() % 5 > 0) {
            basePack = incTower.generatePack(true);
        } else {
            if (!incTower.selectedBossPack) {
                incTower.selectedBossPack = incTower.generatePack(false);
            }
            basePack = incTower.selectedBossPack;
        }
        //Expand it out
        var pack = [];
        var title = "";
        var difficultyPerPack = difficulty.div(basePack.length);
  //      console.log("Difficulty (per pack): " + incTower.humanizeNumber(difficultyPerPack));
        var goldPerPack = totalWaveGold.div(basePack.length);
        //console.log("Gold (per pack): " + incTower.humanizeNumber(goldPerPack));
        basePack.forEach(function (packEntry) {
            var count = packEntry.count || 1;
            //console.log("Count: " + count);
            if (title.length > 0) { title += "\n"; }
            title += packEntry.title;
            var packHealth = BigNumber.max(1, difficultyPerPack.div(count));
            var packGold = BigNumber.max(1, goldPerPack.div(count)).ceil();
//            console.log("Pack health: " + incTower.humanizeNumber(packHealth));
            //console.log("Pack gold: " + incTower.humanizeNumber(packGold));
            for (var j = 0; j < count; j++) {
                var tempPack = _.clone(packEntry);
                tempPack.count = undefined;
                tempPack.health = packHealth;
                if (tempPack.bonusHealthPercentage) {
                    tempPack.health = tempPack.health.times(1 + (tempPack.bonusHealthPercentage * 0.01));
                }
                tempPack.goldValue = packGold;
                pack.push(tempPack);
            }
        });
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
        var titleColor = incTower.game.rnd.pick(['#FF6746', '#BACDD4', '#DFC67A', '#63A67F', '#B89384']);
        incTower.createFloatingText({
            noFloat: true,
            x: 400,
            y: 50,
            font: "Arial",
            fontSize: "18pt",
            color: titleColor,
            stroke: 'black',
            strokeThickness: 3,
            shadowed: true,
            delay: 2500,
            duration: 1000,
            text: title
        });
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
            try {
                if (incTower.currentlySelected() === this || incTower.currentlySelected() !== null && incTower.currentlySelected().enemy && !incTower.currentlySelected().alive) {
                    incTower.currentlySelected(null);
                }
                // console.log("onKilled");
                // console.log(typeof this.nullzoneGraphic);
                if (this.nullzoneGraphic) {
                    this.nullzoneGraphic.destroy();
                    this.nullzoneGraphic = null;
                }
                if (this.directionalShieldGraphic) {
                    this.directionalShieldGraphic.destroy();
                    this.directionalShieldGraphic = null;
                }
                if (this.burningSprite) {
                    this.burningSprite.animations.destroy();
                    this.burningSprite.destroy();
                    this.burningSprite = null;
                }
                if (this.spellCastSprite) {
                    this.spellCastSprite.destroy();
                    this.spellCastSprite = null;

                }
                this.cleanup();
            } catch (e) {

            }
        }, this);
        this.events.onDestroy.add(function () {
            //This is gross but is necessary ot prevent random null reference errors
            try {
                if (incTower.currentlySelected() === this || incTower.currentlySelected() !== null && incTower.currentlySelected().enemy && !incTower.currentlySelected().alive) {
                    incTower.currentlySelected(null);
                }
                this.removeChildren();
                if (this.nullzoneGraphic !== undefined) {
                    this.nullzoneGraphic.destroy();
                }
                if (this.directionalShieldGraphic) {
                    this.directionalShieldGraphic.destroy();
                    this.directionalShieldGraphic = null;
                }
                //This appears to have been causing a memory leak.
                this.animations.destroy();
                // this.events.onKilled.dispose();
                this.healthSubscription.dispose();
                this.chillSubscription.dispose();
                if (this.burningSprite) {
                    this.burningSprite.animations.destroy();
                    this.burningSprite.destroy();
                }
                if (this.spellCastSprite) {
                    this.spellCastSprite.destroy();
                    this.spellCastSprite = null;

                }


                this.burningSprite = undefined;
                this.floatText = undefined;
                //this.statusEffects = undefined;
                this.realSpeed = undefined;
                this.cleanup();
            } catch (e) {

            }
        }, this);

        this.chillSubscription = this.statusEffects.chilled.subscribe(chilledUpdate, this);
        this.burningSubscription = this.statusEffects.burning.subscribe(function (newBurns) {
            if (newBurns.gt(0)) {
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
            } else {
                if (this.burningSprite !== undefined) {
                    this.burningSprite.visible = false;
                }
            }
        }, this);
        this.goldValue = ko.observable(opts.goldValue);
        //this.healthbar = incTower.game.add.graphics(0, 0, incTower.enemyHealthbars);
        this.healthbar = incTower.game.add.sprite(0, 0, 'incTower', 'white.png');
        //this.addChild(this.healthbar);


        this.curTile = -1;
        for (var opt in opts) {
            if (opts.hasOwnProperty(opt)) {
                if (opt === "scale") {
                    //this.scale.set( opts[opt], opts[opt]);
                    this.scale.x = opts[opt];
                    this.scale.y = opts[opt];
                } else if (opt === "speed") {
                    this.speed = opts[opt];
                } else if (!(opt in this)) {
                    this[opt] = opts[opt];
                    if (opt === 'powers') {
                        var powers = opts[opt];
                        var ret = [];
                        _.forEach(_.keys(powers), function (power) {
                            var preferred = _.includes(opts.preferredPowers, power) ? 1 : 0;
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
            var nullZoneKey = "nullzone" + this.nullzone;
            var nullzoneDiameter = 64 + (32 * this.nullzone - 1);
            if (!incTower.game.cache.checkImageKey(nullZoneKey)) {
                this.nullzoneGraphic = incTower.game.add.graphics(0, 0);
                //this.addChild(this.nullzoneGraphic);
                this.nullzoneGraphic.beginFill(0x000000, 0.5);
                this.nullzoneGraphic.lineStyle(1, 0x000000, 2);
                this.nullzoneGraphic.drawCircle(0, 0, nullzoneDiameter);
                this.nullzoneGraphic = incTower.replaceGraphics(this.nullzoneGraphic, nullZoneKey, incTower.enemyNullzones);

            } else {
                this.nullzoneGraphic = incTower.game.add.sprite(0, 0, nullZoneKey, incTower.enemyNullzones);
            }
            this.nullzoneGraphic.anchor.set(0.5);
            this.nullzoneGraphic.alpha = 0.3;
            this.nullzoneCircle = new Phaser.Circle(0, 0, nullzoneDiameter + 16);
        }
        if (this.directionalShield > 0) {
            this.directionalShieldGraphic = incTower.game.add.graphics(0, 0);
            this.directionalShieldGraphic.lineStyle(2, 0x000000, 2);
            this.directionalShieldOffset = 270;
            this.directionalStart = incTower.game.math.degToRad(0 + this.directionalShieldOffset);
            this.directionalEnd = incTower.game.math.degToRad(45 * this.directionalShield + this.directionalShieldOffset);
            this.directionalShieldGraphic.arc(0, 0, 25, this.directionalStart, this.directionalEnd);
            //Wrap both values to be between -PI and +PI
            while (this.directionalStart < -Math.PI || this.directionalEnd < -Math.PI) {
                this.directionalStart += Math.PI * 2;
                this.directionalEnd += Math.PI * 2;
            }
            while (this.directionalStart > Math.PI || this.directionalEnd > Math.PI) {
                this.directionalStart -= Math.PI * 2;
                this.directionalEnd -= Math.PI * 2;
            }
            if (this.directionalStart > this.directionalEnd) {
                var tmp = this.directionalEnd;
                this.directionalEnd = this.directionalStart;
                this.directionalStart = tmp;
            }
            this.directionalShieldGraphic.cacheAsBitmap = true;
        }
        incTower.enemys.add(this);
        this.inputEnabled = true;
        this.events.onInputDown.add(EnemyInputDown, this);
        this.health = ko.observable();

        this.healthSubscription = this.health.subscribe(function (newHealth) {
            if (!this.healthbar) { return; }
            //this.healthbar.clear();
            var per = newHealth.div(this.maxHealth);
            var x = (per) * 100;
            var colour = incTower.rgbToHex((x > 50 ? 1 - 2 * (x - 50) / 100.0 : 1.0) * 255, (x > 50 ? 1.0 : 2 * x / 100.0) * 255, 0);
            /*this.healthbar.beginFill(colour);
            this.healthbar.lineStyle(5, colour, 1);
            this.healthbar.moveTo(-16, -21);
            this.healthbar.lineTo(32 * per - 16, -21);
            this.healthbar.endFill();*/
            this.healthbar.tint = colour;
            this.healthbar.scale.setTo(32 * per, 5);

            incTower.game.world.bringToTop(this.healthbar);
        }, this);
        this.maxHealth = opts.health;
        this.health(new BigNumber(opts.health));
        //console.log("Health" + incTower.humanizeNumber(this.health()));
        this.elementalInstability = ko.observable(new BigNumber(0));
        this.elementalRunes = [];
        this.elementalRuneCounts = {};
        this.elementalRuneDiminishing = {};
        this.recentlyCast = ko.observable(false);
        this.recentlyCast.subscribe(function (newVal) {
            this.animations.paused = newVal || false;
            if (!this.animations.paused && this.spellCastSprite) {
                this.spellCastSprite.destroy();
                this.spellCastSprite = null;
            }
        }, this);
        this.realSpeed = ko.computed(function () {
            if (this.recentlyCast()) {
                return 0;
            }
            var speed = this.speed;
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
    Enemy.prototype.cleanup = function () {
        if (this.healthbar) {
            this.healthbar.destroy();
            this.healthbar = undefined;
        }
    };

    Enemy.prototype.castSpell = function (spellName) {
        this.recentlyCast(true);

        this.spellCastSprite = incTower.game.add.sprite(0, -4, 'incTower', "spell-cast-01.png");
        this.spellCastSprite.anchor.setTo(0.5, 0);
        this.addChild(this.spellCastSprite);
        this.spellCastSprite.animations.add('spell-cast', [
            "spell-cast-01.png",
            "spell-cast-02.png",
            "spell-cast-03.png",
            "spell-cast-04.png",
            "spell-cast-05.png",
            "spell-cast-06.png",
            "spell-cast-07.png",
            "spell-cast-08.png",
            "spell-cast-09.png",
            "spell-cast-10.png",
            "spell-cast-11.png",
            "spell-cast-12.png",
            "spell-cast-13.png",
            "spell-cast-14.png",
            "spell-cast-15.png",
            "spell-cast-16.png",
            "spell-cast-17.png",
            "spell-cast-18.png",
            "spell-cast-19.png",
            "spell-cast-20.png",
            "spell-cast-21.png",
            "spell-cast-22.png",
            "spell-cast-23.png",
            "spell-cast-24.png",
            "spell-cast-25.png",
            "spell-cast-26.png",
            "spell-cast-27.png",
            "spell-cast-28.png",
            "spell-cast-29.png",
            "spell-cast-30.png",
        ], 10, false, true);
        this.spellCastSprite.animations.play('spell-cast');
        incTower.createFloatingText({'color':'purple', 'around':this, 'text':"Casting " + spellName + "!", 'type':'spell-cast'});
    };
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
        return damage;
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
            if (Date.now() - saveModule.lastSave > 60000) {
                saveModule.triggerSave();
            }

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
        if (this.healthbar) {
            this.healthbar.x = this.x - 16;
            this.healthbar.y = Math.max(0, this.y - 22);
        }
        if (this.shielding > 0) {
            if (this.lastShieldTime === undefined || this.lastShieldTime + (4000 / this.shielding) < incTower.game.time.now) {
                this.shielded = true;
                this.lastShieldTime = incTower.game.time.now;
                this.shieldSprite.visible = true;
            }
        }

        if (this.nullzone > 0 && this.nullzoneGraphic) {
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
        if (this.directionalShield > 0 && this.directionalShieldGraphic) {
            this.directionalShieldGraphic.x = this.x;
            this.directionalShieldGraphic.y = this.y;
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
            chance *= 1 - (0.2 * (this[runeType + '-resistant'] || 0));
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
    //Consumes runes of a given type, returning the number consumed
    Enemy.prototype.consumeRunes = function (runeType) {
        var count = 0;
        var newElementalRunes = [];
        _.forEach(this.elementalRunes, function (rune) {
            if (rune.runeType === runeType) {
                count++;
                rune.destroy();
            } else {
                newElementalRunes.push(rune);
            }
        });
        this.elementalRunes = newElementalRunes;
        this.repositionRunes();
        return count;
    };

});
