/**
 * Created by Mo on 2/21/2015.
 */
function okDialog(opts) {
    'use strict';

    $('<div>' + opts.message + '</div>').dialog({
        modal: true,
        width: 600,
        buttons: {
            Ok: function () {
                $(this).dialog("close");
            }
        },
        title: opts.title
    });
}
//Stolen from http://lostsouls.org/grimoire_diminishing_returns
function diminishingReturns(val, scale) {
    'use strict';
    if (val < 0) {
        return -diminishingReturns(-val, scale);
    }
    var mult = val / scale;
    var trinum = (Math.sqrt(8.0 * mult + 1.0) - 1.0) / 2.0;
    return trinum * scale;
}
function loadSave(save) {
    'use strict';
    $('#b64_save').val(btoa(save));
    var i;
    save = JSON.parse(save);
    for (var prop in save) {
        if (save.hasOwnProperty(prop)) {
            if (prop === 'towers') {
                continue;
            }
            if (prop === 'blocks') {
                continue;
            }
            if (prop === 'skills') {
                continue;
            }
            if (ko.isComputed(incTower[prop])) { continue; }
            if (ko.isObservable(incTower[prop])) {
                var curVal = incTower[prop]();
                if (isArray(curVal)) {
                    for (i = 0;i < save[prop].length;i++) {
                        incTower[prop].push(save[prop][i]);
                    }
                } else if (isPrimativeNumber(curVal) || typeof curVal === 'boolean') {
                    incTower[prop](save[prop]);
                } else {
                    console.log(prop);
                    //should be a big number if we're getting here.
                    incTower[prop](new BigNumber(save[prop]));
                }
                continue;
            }
            incTower[prop] = save[prop];

        }
    }
    if ('blocks' in save) {
        incTower.blocks = [];
        for (i = 0;i < save.blocks.length;++i) {
            map.putTile(game.rnd.integerInRange(5,8),save.blocks[i].x,save.blocks[i].y,"Ground");
            incTower.blocks.push({x:save.blocks[i].x, y: save.blocks[i].y});
        }
        recalcPath();
    }
    if ('skills' in save) {
        //We have an observable dict
        var keys = Object.keys(save.skills);
        for (i = 0; i < keys.length;i++) {
            incTower.gainSkill(keys[i],save.skills[keys[i]]);
        }
        incTower.checkSkills();
    }
    if ('towers' in save) {
        for (i = 0;i < save.towers.length;++i) {
            var tileY = save.towers[i].tileY;
            var tileX = save.towers[i].tileX;
            var index = map.layers[0].data[tileY][tileX].index;
            if (index >= 5 && index <= 8) {
                new Tower(save.towers[i]);
            } else {
                incrementObservable(incTower.gold,save.towers[i].goldSpent);
            }
        }
    }
//    console.log(incTower);

}
BigNumber.config({ ERRORS: false });
$(document).ready(function () {
    'use strict';
    window.game = new Phaser.Game(800, 608, Phaser.AUTO, 'gameContainer', {preload: preload, create: create, update: update}, false, false);
    //Blatantly stolen from the qtip delegation example
    $(document).on('mouseover', '.tooltip', function(event) {
            $(this).qtip({
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
                }
            }, event);
        });
    $(document).on('click','.train_link', function (e) {
        incTower.switchActiveSkill($(this).attr('data-skill'));
        e.preventDefault();
    });
    $( ".accordion" ).accordion({
        collapsible: true,
        heightStyle: "content"
    });
});
function shuffle(o){ //Shuffles an array
    'use strict';
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
}
function incrementObservable(observable,amount) {
    'use strict';
    if (amount === undefined) {
        amount = 1;
    }
    var currentObs = observable();
    if (isPrimativeNumber(currentObs)) {
        observable(currentObs + amount);
    } else { //Should be a big number object in this case


        /*console.log(incrementObservable.caller);*/
        if (typeof currentObs.add === 'undefined') {
            console.trace();
            console.log(currentObs);
        }
        observable(currentObs.add(amount));
    }

}
var game;
function isPrimativeNumber(obj) {
    'use strict';
    return Object.prototype.toString.call(obj) === '[object Number]';
}
function isArray(obj) {
    'use strict';
    return Object.prototype.toString.call(obj) === "[object Array]";
}
var incTower = {
    gold: ko.observable(new BigNumber(150)),
    wave: ko.observable(0),
    lastUpdate: 0,
    lastUpdateRealTime: Date.now(),
    generatingEnemies: false,
    availableTowers: ko.observableArray(['kinetic']),
    numTowers: ko.observable(0),
    currentlySelected: ko.observable(null),
    currentlySelectedIndicator: null, //Holds the graphic we'll use to show what we have selected.
    frame: 0,
    farmMode: ko.observable(false),
    dialogWelcome: false, //Shows a welcome dialog at the beginning of the first game
    dialogEdgeRegular: false, //Shows a dialog when a regular enemy falls off the edge.
    dialogEdgeBoss: false,
    dialogTowerUpgradeDouble: false,
    dialogBossKill: false,
    sellTowerPer: ko.pureComputed(function () {
        'use strict';
        return 0.5 + (0.05 * incTower.getSkillLevel('scrapping'));
    }),
    showChangelog: function () {
        'use strict';
        $('#changelog').dialog({
            width: 600,
            height: 500
        });
    },
    showSkills: function () {
        'use strict';
        $('#skills').dialog({
            width: 500,
            height: 500
        });
    },
    showCredits: function () {
        'use strict';
        $('#credits').dialog({
            width: 500,
            height: 500
        });
    },
    showSaves: function () {
        'use strict';
        $('#save').dialog({
            width: 500,
            height: 500,
            buttons: {
                Ok: function () {
                    $(this).dialog("close");
                },
                Load: function () {
                    var save;
                    try {
                        save = atob($('#b64_load').val());
                        loadSave(save);
                    } catch (e) {
                        okDialog({
                            title: "Save Game",
                            message:"There was an issue with your save game. It cannot be loaded."
                        });
                        console.log(e);
                    }
                }
            }
        });

    },
    skills: ko.observableDictionary({}),
    activeSkill: ko.observable('kineticTowers'),
    switchActiveSkill: function(skill) {
        'use strict';
        incTower.activeSkill(skill);
    },
    skillIsMaxed: function(skillName) {
        'use strict';
        if (incTower.skillAttributes[skillName].maxLevel !== undefined) {
            if (incTower.getSkillLevel(skillName) >= incTower.skillAttributes[skillName].maxLevel) { return true; }
        }
        return false;
    },
    skillCanTrain: function(skillName) {
        'use strict';
        if (incTower.skillIsMaxed(skillName)) { return false; }
        if (incTower.activeSkill() === skillName) { return false; } //Can't train the skill you're already training
        return true;
    },
    skillTextProgress: function(skillName) {
        'use strict';
        if (incTower.skillAttributes[skillName] === undefined) { return ""; }
        var skill = incTower.skills.get(skillName)();
        if (skill === null) { return ""; }
        //if (skill.get('skillPoints')() === null) { return ""; }
        if (incTower.skillIsMaxed(skillName)) { return "Maxed"; }
        return humanizeNumber(skill.get('skillPoints')()) + " / " + humanizeNumber(skill.get('skillPointsCap')());
    },
    maxMana: ko.observable(new BigNumber(0)),
    mana: ko.observable(new BigNumber(0)),

    skillAttributes: {
        construction: {
            fullName: 'Construction',
            baseCost: 20,
            growth: 1.1,
            description: 'Reduces the cost of towers and their upgrades by 1% per rank.',
            describeRank: function (rank) {
                return 'Reduces the cost of towers and their upgrades by ' + rank + '%.';
            },
            maxLevel: 10
        },
        modularConstruction:{
            fullName: 'Modular Construction',
            baseCost: 135,
            growth: 1.15,
            description: 'Reduces the cost of upgrading all towers by 5% per level.',
            describeRank: function (rank) {
                return 'Reduces the cost of upgrading all towers by ' + (rank * 5) + '%.';
            },
            maxLevel: 5,
            requires: {
                construction: 10
            }

        },
        initialEngineering: {
            fullName: 'Initial Engineering',
            baseCost: 135,
            growth: 1.15,
            description: 'Increases the starting damage, attack speed, and range for all towers by 5% per rank.',
            describeRank: function (rank) {
                return 'Increases the starting damage, attack speed, and range for all towers by ' + (rank * 5) + '%.';
            },

            maxLevel: 5,
            requires: {
                construction: 10
            }
        },
        towerTemplates: {
            fullName: 'Tower Templates',
            baseCost: 120,
            growth: 2,
            description: 'Increases the starting damage of towers by a factor of 10 per rank.',
            describeRank: function (rank) {
                return 'Increases the starting damage of towers by a factor of ' + Math.pow(10,rank) + '.';
            },
            maxLevel: 5,
            requires: {
                initialEngineering: 5
            }

        },
        scrapping: {
            fullName: 'Scrapping',
            baseCost: 80,
            growth: 1.5,
            description: 'Returns an additional 5% of spent gold on the sale of a tower.',
            describeRank: function (rank) {
                return 'Refunds an additional ' + (rank * 5) + '% of gold spent after the sale of a tower.';
            },

            maxLevel: 5,
            requires: {
                initialEngineering: 5
            }
        },
        refinedBlueprints: {
            fullName: 'Refined Blueprints',
            baseCost: 15,
            growth: 1.2,
            description: 'Increases the starting damage of towers by 5% per rank.',
            describeRank: function (rank) {
                return 'Increases the starting damage of towers by ' + (rank * 5) + '%.';
            },
            requires: {
                towerTemplates: 5
            }
        },
        marketConnections: {
            fullName: 'Market Connections',
            baseCost: 45,
            growth: 1.2,
            description: 'Increases the gold reward on each kill by 1% per level.',
            describeRank: function (rank) {
                return 'Increases the gold reward on each kill by ' + (rank) + '%.';
            }


        },
        kineticTowers: {
            fullName: 'Kinetic Towers',
            baseCost: 20,
            growth: 1.1,
            maxLevel: 10,
            description: 'Increases the damage that kinetic towers deal by 1% per level.',
            describeRank: function (rank) {
                return 'Increases the damage that kinetic towers deal by ' + (rank) + '%.';
            },
        },
        //kineticAmmo:{
        //    fullName: 'Kinetic Ammunition',
        //    baseCost: 15,
        //    growth: 1.1,
        //    description: 'Optimizes the damage caused by kinetic towers, increasing damage by 1% per level.',
        //
        //},
        magicalAffinity: {
            fullName: 'Magical Affinity',
            baseCost: 300,
            growth: 1.1,
            maxLevel: 1,
            description: "Grants magical affinity opening the path to casting spells and elemental towers.",
            describeRank: function () {
                return "Grants magical affinity opening the path to casting spells and elemental towers.";
            },
            onMax: function () {
                'use strict';
                if (incTower.maxMana().eq(0)) {
                    incTower.maxMana(new BigNumber(1000));
                    incTower.mana(incTower.maxMana());
                }
            },
        },
        fireAffinity: {
            fullName: 'Fire Affinity',
            baseCost: 900,
            growth: 1.1,
            maxLevel: 1,
            description: "Attunes yourself with fire which allows you to build fire towers which burn enemies over time, causing them to take increased damage from all sources.",
            describeRank: function (rank) {
                return "Attunes yourself with fire which allows you to build fire towers which burn enemies over time, causing them to take increased damage from all sources.";
            },
            onMax: function () {
                'use strict';
                if (incTower.availableTowers.indexOf('fire') < 0) { incTower.availableTowers.push('fire'); }
            },
            requires: {
                magicalAffinity: 1
            }
        },
        fireRuneApplication: {
            fullName: 'Fire Rune Application',
            baseCost: 100,
            growth: 1.266,
            maxLevel: 10,
            description: "Increases the chance that a fire tower successfully applies a rune by 5% per rank.",
            describeRank: function (rank) {
                return "Increases the chance that a fire tower successfully applies a rune by " + (rank * 5) + '%.';
            },
            requires: {
                fireAffinity: 1
            }
        },
        fireAdvancedRuneApplication: {
            fullName: 'Fire Rune Application (Advanced)',
            baseCost: 200,
            growth: 1.406,
            maxLevel: 10,
            description: "When a fire tower successfully applies a rune, there is a 5% chance per rank that it will apply two instead.",
            describeRank: function (rank) {
                return "When a fire tower successfully applies a rune, there is a " + (rank * 5) + '% chance that it will apply two instead.';
            },

            requires: {
                fireRuneApplication: 10
            }
        },
        waterAffinity: {
            fullName: 'Water Affinity',
            baseCost: 900,
            growth: 1.1,
            maxLevel: 1,
            description: "Attunes yourself with water which allows you to build water towers which slow and freeze enemies.",
            describeRank: function (rank) {
                return "Attunes yourself with water which allows you to build water towers which slow and freeze enemies.";
            },

            onMax: function () {
                'use strict';
                if (incTower.availableTowers.indexOf('water') < 0) { incTower.availableTowers.push('water'); }
            },
            requires: {
                magicalAffinity: 1
            }
        },
        waterRuneApplication: {
            fullName: 'Water Rune Application',
            baseCost: 100,
            growth: 1.266,
            maxLevel: 10,
            description: "Increases the chance that a water tower successfully applies a rune by 5% per rank.",
            describeRank: function (rank) {
                return "Increases the chance that a water tower successfully applies a rune by " + (rank * 5) + '%.';
            },

            requires: {
                waterAffinity: 1
            }
        },
        waterAdvancedRuneApplication: {
            fullName: 'Water Rune Application (Advanced)',
            baseCost: 200,
            growth: 1.406,
            maxLevel: 10,
            description: "When a water tower successfully applies a rune, there is a 5% chance per rank that it will apply two instead.",
            describeRank: function (rank) {
                return "When a water tower successfully applies a rune, there is a " + (rank * 5) + '% chance that it will apply two instead.';
            },

            requires: {
                waterRuneApplication: 10
            }
        },

        earthAffinity: {
            fullName: 'Earth Affinity',
            baseCost: 900,
            growth: 1.1,
            maxLevel: 1,
            description: "Attunes yourself with earth which allows you to build earth towers which drop giant boulders from the sky, causing area of effect damage.",
            describeRank: function (rank) {
                return "Attunes yourself with earth which allows you to build earth towers which drop giant boulders from the sky, causing area of effect damage.";
            },

            onMax: function () {
                'use strict';
                if (incTower.availableTowers.indexOf('earth') < 0) { incTower.availableTowers.push('earth'); }
            },
            requires: {
                magicalAffinity: 1
            }

        },
        earthRuneApplication: {
            fullName: 'Earth Rune Application',
            baseCost: 100,
            growth: 1.266,
            maxLevel: 10,
            description: "Increases the chance that an earth tower successfully applies a rune by 5% per rank.",
            describeRank: function (rank) {
                return "Increases the chance that an earth tower successfully applies a rune by " + (rank * 5) + '%.';
            },

            requires: {
                earthAffinity: 1
            }
        },
        earthAdvancedRuneApplication: {
            fullName: 'Earth Rune Application (Advanced)',
            baseCost: 200,
            growth: 1.406,
            maxLevel: 10,
            description: "When a fire tower successfully applies a rune, there is a 5% chance per rank that it will apply two instead.",
            describeRank: function (rank) {
                return "When a fire tower successfully applies a rune, there is a " + (rank * 5) + '% chance that it will apply two instead.';
            },

            requires: {
                earthRuneApplication: 10
            }
        },

        airAffinity: {
            fullName: 'Air Affinity',
            baseCost: 900,
            growth: 1.1,
            maxLevel: 1,
            description: "Attunes yourself with air which allows you to build air towers which will occasionally trap enemies in a whirlwind, knocking them back.",
            describeRank: function (rank) {
                return "Attunes yourself with air which allows you to build air towers which will occasionally trap enemies in a whirlwind, knocking them back.";
            },

            onMax: function () {
                'use strict';
                if (incTower.availableTowers.indexOf('air') < 0) { incTower.availableTowers.push('air'); }
            },
            requires: {
                magicalAffinity: 1
            }
        },
        airRuneApplication: {
            fullName: 'Air Rune Application',
            baseCost: 100,
            growth: 1.266,
            maxLevel: 10,
            description: "Increases the chance that an air tower successfully applies a rune by 5% per rank.",
            describeRank: function (rank) {
                return "Increases the chance that an air tower successfully applies a rune by " + (rank * 5) + '%.';
            },

            requires: {
                airAffinity: 1
            }
        },
        airAdvancedRuneApplication: {
            fullName: 'Air Rune Application (Advanced)',
            baseCost: 200,
            growth: 1.406,
            maxLevel: 10,
            description: "When an air tower successfully applies a rune, there is a 5% chance per rank that it will apply two instead.",
            describeRank: function (rank) {
                return "When an air tower successfully applies a rune, there is a " + (rank * 5) + '% chance that it will apply two instead.';
            },

            requires: {
                airRuneApplication: 10
            }
        },




    },
    startingSkills: ['kineticTowers', 'construction', 'magicalAffinity'],
    gainSkill: function (name, opt) {
        'use strict';
        if (typeof opt === 'undefined') { opt = {}; }
        if (!(name in incTower.skillAttributes)) { console.log(name + " is not in our skills list."); }
        /*if (incTower.getSkillLevel(name) !== -1) { return; } //We already know the skill*/
        //Either gains a new skill at level 1 or loads in a previously saved skill
        var skillLevel = opt.skillLevel || 0;
        var skillPoints = new BigNumber(opt.skillPoints || 0);
        var skillPointsCap = costCalc(incTower.skillAttributes[name].baseCost,skillLevel,incTower.skillAttributes[name].growth);
        incTower.skills.push(name,ko.observableDictionary({
            skillLevel: skillLevel,
            skillPoints: skillPoints,
            skillPointsCap: skillPointsCap
        }));
    },
    describeSkill: function (name) {
        'use strict';
        if (!(name in incTower.skillAttributes)) { console.log(name); return ''; }
        var currentLevel = incTower.getSkillLevel(name);
        var desc = '';
        if (currentLevel > 0) { desc += "<p>Current Rank: " + incTower.skillAttributes[name].describeRank(currentLevel) + '</p>'; }
        if (!incTower.skillIsMaxed(name)) { desc += '<p>Next Rank: ' + incTower.skillAttributes[name].describeRank(currentLevel + 1) + '</p>'; }
        return desc;
    },
    getSkillLevel: function(name) {
        'use strict';
        if (incTower.skills.get(name)() === null) { return 0; }
        return incTower.skills.get(name)().get('skillLevel')();
    },
    checkSkills: function () {
        'use strict';
        for (var skill in incTower.skillAttributes) {
            var grantSkill = true;
            if (incTower.skillAttributes[skill].requires !== undefined) {
                for (var requirementSkill in incTower.skillAttributes[skill].requires) {
                    if (incTower.getSkillLevel(requirementSkill) < incTower.skillAttributes[skill].requires[requirementSkill]) {
                        grantSkill = false;
                    }
                }
            }
            if (grantSkill) {
                if (!incTower.haveSkill(skill)) {
                    incTower.gainSkill(skill);
                }
            }

        }
        var skillKeys = incTower.skills.keys();
        for (var h = 0; h < skillKeys.length; h++) {
            var skill = skillKeys[h];
            if (incTower.skillAttributes[skill].maxLevel !== undefined && incTower.getSkillLevel(skill) > incTower.skillAttributes[skill].maxLevel) {
                incTower.skills.get(skill)().get('skillLevel')(incTower.skillAttributes[skill].maxLevel);
            }
            if (incTower.skillAttributes[skill].onMax !== undefined && incTower.skillIsMaxed(skill)) {
                incTower.skillAttributes[skill].onMax();
            }
        }


    },
    haveSkill: function (name) {
        'use strict';
        if (incTower.skills.get(name)() === null) { return false; }
        return true;
    },
    getActiveSkillName: function () {
        'use strict';
        var active = incTower.activeSkill();
        if (active in incTower.skillAttributes) {
            return incTower.skillAttributes[active].fullName;
        }
        return '';
    },
    skillRate: function () {
        'use strict';
        return 1;
    },
    timeUntilSkillUp: function(pointDiff) {
        'use strict';
        return moment().add(pointDiff / incTower.skillRate(),'seconds').fromNow();
    },




    towers: [],
    towerAttributes: {
        kinetic: {
            name: 'Kinetic',
            baseCost: 25,
            startingFireRate: 2000,
            damagePerLevel: 1
        },
        earth: {
            name: 'Earth',
            baseCost: 100,
            damagePerLevel: 1,
            startingFireRate: 3000,
            icon: 'earth-element.png'
        },
        air: {
            name: 'Air',
            baseCost: 100,
            damagePerLevel: 1,
            startingFireRate: 3000,
            icon: 'air-element.png'
        },
        fire: {
            name: 'Fire',
            baseCost: 100,
            damagePerLevel: 1,
            startingFireRate: 3000,
            icon: 'fire-element.png'
        },
        water: {
            name: 'Water',
            baseCost: 100,
            damagePerLevel: 1,
            startingFireRate: 3000,
            icon: 'water-element.png'
        }
    },

    generateNormalPack: function () {
        'use strict';
        var numberOfCreeps = game.rnd.integerInRange(2,6);
        var possAnimations = Object.keys(incTower.enemyAnimations);
        var ret = [];
        while (numberOfCreeps > 0) {
            var baseEntry = {
                name: game.rnd.pick(possAnimations),
                speed: 1,
                scale: 1,
                powers: {}
            };
            baseEntry.length = incTower.enemyAnimations[baseEntry.name].length;
            var thisCount = game.rnd.integerInRange(1,numberOfCreeps);
            numberOfCreeps -= thisCount;
            baseEntry.count = thisCount;

            ret.push(baseEntry);

        }
        return ret;
    },

    bossPowers: {
        swarm: {
            describe: function () {
                'use strict';
                return "This unit is part of a swarm which causes it to spawn several copies with less health.";
            }
        },
        regenerating: {
            describe: function (mult) {
                'use strict';
                return "Regenerates " + (0.5 * mult) + "% of its max health a second.";
            }
        },
        healthy: {
            describe: function (mult) {
                'use strict';
                return "Has " + (10 * mult) + "% bonus health.";
            }
        },
        fast: {
            describe: function (mult) {
                'use strict';
                return "Moves " + (10 * mult) + "% faster.";
            }
        },
        teleport: {
            describe: function (mult) {
                'use strict';
                return "Has a 10% chance each second to teleport " + mult + " space(s).";
            }
        },
        shielding: {
            describe: function (mult) {
                'use strict';
                return "This unit gets a shield that stops the next source of damage every " + humanizeNumber(4 / mult) + " seconds.";
            }
        }
        /*nullzone: {
            describe: function (mult) {
                return "Towers within " + mult + "space(s) of this unit cannot fire.";
            }
        }*/

    },
    generateBossPack: function () {
        'use strict';
        var bossPowers = Object.keys(incTower.bossPowers);
        var totalPowers = (incTower.wave() / 25) + 1 | 0;
        var possAnimations = Object.keys(incTower.enemyAnimations);
        var ret = [];
        while (totalPowers >= 1) {
            var baseEntry = {
                name: game.rnd.pick(possAnimations),
                count: 1,
                bonusHealthPercentage: 0,
                regenerating: 0,
                teleport: 0,
                speed: 1,
                scale: 1.3,
                shielding: 0,
                powers: {}
            };
            baseEntry.length = incTower.enemyAnimations[baseEntry.name].length;
            var thisPowers = game.rnd.integerInRange(Math.min(5,totalPowers),totalPowers);
            totalPowers -= thisPowers;

            for (var i = 0;i < thisPowers;++i) {
                var power = game.rnd.pick(bossPowers);
                if (power === 'swarm') {
                    baseEntry.swarm = true;
                    baseEntry.count += game.rnd.integerInRange(5, 10);
                    if (baseEntry.scale > 0.7) {
                        baseEntry.scale *= 0.8;
                    }

                } else if (power === 'regenerating') {
                    baseEntry.regenerating += 0.5;
                } else if (power === 'fast') {
                    baseEntry.speed += 0.1;
                } else if (power === 'healthy') {
                    baseEntry.bonusHealthPercentage += 10;
                } else if (power === 'teleport') {
                    baseEntry.teleport += 1;
                } else if (power === 'nullzone') {
                    baseEntry.nullzone += 1;
                } else if (power === 'shielding') {
                    baseEntry.shielding += 1;
                }
                if (power in baseEntry.powers) {
                    baseEntry.powers[power]++;
                } else {
                    baseEntry.powers[power] = 1;
                }
            }
            if (baseEntry.swarm) { baseEntry.bonusHealthPercentage -= 20; }
            ret.push(baseEntry);

        }
        return ret;
    },
    selectedBossPack: false, //This holds our next boss, it's randomly generated and then remembered until beaten
    towerCost: function (base) {
        'use strict';
        if (base === undefined) { base = 25; }
        var amount = costCalc(base,incTower.numTowers(),1.4);
        amount = amount.times(1 - (incTower.getSkillLevel('construction') * 0.01));
        return amount;
    },
    gainGold: function (amount, floatAround) {
        'use strict';
        incrementObservable(incTower.gold,amount);
        if (floatAround !== undefined) {
            incTower.createFloatingText({'color':'#C9960C', 'duration':3000, 'around':floatAround,'text':'+'+humanizeNumber(amount) + 'g', 'scatter':16, 'type':'gold'});
        }
    },
    buyingCursor: ko.observable(false),
    numBlocks: ko.observable(1),
    blocks: [{x:13, y:9}],
    blockCost: function () {
        'use strict';
        return costCalc(1,incTower.numBlocks(),1.2);
    },
    buyBlock: function () {
        'use strict';
        var cost = incTower.blockCost();
        if (incTower.gold().gt(cost)) {
            incTower.buyingCursor('block');
        }
    },
    sellBlock: function () {
        'use strict';
        incTower.buyingCursor('sellBlock');
    },
    buyTower: function(type) {
        'use strict';
        if (type === undefined) { type = 'kinetic'; }
        var baseCost = incTower.towerAttributes[type].baseCost;
        var cost = incTower.towerCost(baseCost);
        if (incTower.gold().gt(cost)) {
            console.log("Setting cursor to " + type);
            incTower.buyingCursor(type);
        }
    },
    averageDamage: ko.pureComputed(function () {
        'use strict';
        var tally = new BigNumber(0);
        for (var i = 0;i < incTower.numTowers();++i) {
            var tower = towers.getAt(i);
            tally = tally.plus(tower.totalDamage());
        }
        return tally.div(incTower.numTowers());
    }),
    cheapestUpgradeCostTower: ko.pureComputed(function () {
        'use strict';
        var cheapest = -1;
        var retTower;
        for (var i = 0;i < incTower.numTowers();++i) {
            var tower = towers.getAt(i);
            var cost = tower.upgradeCost();
            if (cheapest < 0 || cost.lt(cheapest)) {
                cheapest = cost;
                retTower = tower;
            }
        }
        return retTower;
    }),
    cheapestUpgradeCost: ko.pureComputed(function () {
        'use strict';
        return incTower.cheapestUpgradeCostTower().upgradeCost();
    }),
    cheapestUpgrade: function () {
        'use strict';
        PayToUpgradeTower(incTower.cheapestUpgradeCostTower());
    },
    cheapestUpgradeAll: function () {
        'use strict';
        var cost = 0;
        do {
            var cheapestTower = incTower.cheapestUpgradeCostTower();
            cost = cheapestTower.upgradeCost();
            if (cost.lt(incTower.gold())) {
                PayToUpgradeTower(cheapestTower);
            }
        } while (cost.lt(incTower.gold()));
    },

    goldPerWave: function (wave) {
        'use strict';
        return costCalc(30,wave,1.2);
    },
    enemyAnimations: {
        duck: [
            'duck01.png',
            'duck02.png',
            'duck03.png',
            'duck04.png',
            'duck05.png',
            'duck06.png',
            'duck07.png',
            'duck08.png'
        ],
        panda: [
            'panda01.png',
            'panda02.png',
            'panda03.png'
        ],
        dog: [
            'dog01.png',
            'dog02.png',
            'dog03.png',
            'dog04.png',
            'dog05.png',
            'dog06.png'
        ],
        penguin: [
            'penguin01.png',
            'penguin02.png',
            'penguin03.png',
            'penguin04.png'
        ],
        goblin:[
            'goblin01.png',
            'goblin02.png',
            'goblin03.png'
        ],
        skeleton:[
            'skeleton01.png',
            'skeleton02.png',
            'skeleton03.png'
        ],
        zombie:[
            'zombie01.png',
            'zombie02.png',
            'zombie03.png'
        ]

    },
    deadBullets: { },
    floatingTexts: [],
    createFloatingText: function(opt) {
        'use strict';
        if (opt === undefined) { opt = {}; }
        var text;
        var unusedIndex;
        for (var i = 0;i < incTower.floatingTexts.length;++i) {
            if (incTower.floatingTexts[i].alpha === 0) {
                unusedIndex = i;
                break;
            }
        }
        var x, y;
        if ('x' in opt) { x = opt.x; }
        if ('y' in opt) { y = opt.y; }


        if (unusedIndex === undefined) {
            incTower.floatingTexts.push(game.add.text(0,0,"",{ font: "14px Arial", stroke: 'white', strokeThickness: 1, fontWeight: "bold", fill: "#ff0033", align: "center" }));
            incTower.floatingTexts[incTower.floatingTexts.length - 1].anchor.set(0.5);
            unusedIndex = incTower.floatingTexts.length - 1;
        }
        var floatText = incTower.floatingTexts[unusedIndex];
        var amount = new BigNumber(0);
        if ('amount' in opt) {
            amount = new BigNumber(opt.amount);
        }
        if ('around' in opt) {
            x = opt.around.x;
            y = opt.around.y;
            if (opt.around.floatText === undefined) {
                opt.around.floatText = {};
            }
            if (opt.around.floatText[opt.type] !== undefined && opt.around.floatText[opt.type].alpha > 0.7) {
                floatText = opt.around.floatText[opt.type];
                if (floatText.amount !== undefined) {
                    amount = amount.add(floatText.amount);
                }
            } else {
                opt.around.floatText[opt.type] = floatText;
            }
            opt.around.floatText[opt.type].amount = amount;
        }
        if ('text' in opt) {
            text = opt.text;
        } else {
            text = humanizeNumber(amount);
            if (amount > 0) { text = "+" + text; }
        }
        var scatter = 0;
        if ('scatter' in opt) { scatter = opt.scatter; }
        if (scatter > 0) {
            floatText.x = game.rnd.integerInRange(x - scatter,x + scatter);
            floatText.y = game.rnd.integerInRange(y - scatter,y + scatter);
        } else {
            floatText.x = x;
            floatText.y = y;
        }
        var color = "#ff0033";
        if ('color' in opt) {
            color = opt.color;
        }
        var duration = 1000;
        if ('duration' in opt) {
            duration = opt.duration;
        }
        floatText.fill = color;
        floatText.alpha = 1;
        floatText.text = text;
        game.add.tween(floatText).to( { alpha: 0, y: floatText.y - 30 }, duration, "Linear", true);


    }


};
incTower.self = incTower;
incTower.secondsUntilSkillUp = ko.computed(function () {
    'use strict';
    if (this.skills.get(this.activeSkill())() === null) { return 0; }
    return this.skills.get(this.activeSkill())().get('skillPointsCap')().minus(this.skills.get(this.activeSkill())().get('skillPoints')());
},incTower);
incTower.percentageUntilSkillUp = ko.computed(function () {
    'use strict';
    if (this.skills.get(this.activeSkill())() === null) { return 0; }
    return this.skills.get(this.activeSkill())().get('skillPoints')().dividedBy(this.skills.get(this.activeSkill())().get('skillPointsCap')()).times(100);
},incTower);

incTower.percentageMaxMana = ko.computed(function () {
    'use strict';
    if (this.maxMana().eq(0)) { return 0; }
    return this.mana().div(this.maxMana()).times(100);
},incTower);

incTower.currentlySelected.subscribe(function (value) {
    'use strict';
    if (value === null) {
        incTower.currentlySelectedIndicator.destroy();
        incTower.currentlySelectedIndicator = null;
        return;
    }
    if (incTower.currentlySelectedIndicator === null) {
        incTower.currentlySelectedIndicator = game.add.graphics(0,0);
        incTower.currentlySelectedIndicator.lineStyle(2, 0x66cc00, 3);
        incTower.currentlySelectedIndicator.drawCircle(0,0,40);
    }
    incTower.currentlySelectedIndicator.x = value.x; //+ (tileSquare / 2);
    incTower.currentlySelectedIndicator.y = value.y; //+ (tileSquare / 2);

});





var tileSquare = 32;
var map, layer;
var tileForbidden = new Array(25);
for (var i = 0;i < 25;++i) {
    tileForbidden[i] = new Array(19);
    for (var j = 0;j < 19;j++) {
        tileForbidden[i][j] = false;
    }
}

var path = [{"x":0,"y":0},{"x":1,"y":0},{"x":2,"y":0},{"x":3,"y":0},{"x":4,"y":0},{"x":5,"y":0},{"x":6,"y":0},{"x":7,"y":0},{"x":7,"y":1},{"x":8,"y":1},{"x":9,"y":1},{"x":10,"y":1},{"x":11,"y":1},{"x":11,"y":2},{"x":11,"y":3},{"x":11,"y":4},{"x":12,"y":4},{"x":12,"y":5},{"x":12,"y":6},{"x":12,"y":7},{"x":12,"y":8},{"x":13,"y":8},{"x":13,"y":9},{"x":14,"y":9},{"x":15,"y":9},{"x":15,"y":10},{"x":16,"y":10},{"x":16,"y":11},{"x":17,"y":11},{"x":17,"y":12},{"x":17,"y":13},{"x":18,"y":13},{"x":18,"y":14},{"x":19,"y":14},{"x":20,"y":14},{"x":21,"y":14},{"x":21,"y":15},{"x":21,"y":16},{"x":22,"y":16},{"x":22,"y":17},{"x":23,"y":17},{"x":23,"y":18},{"x":24,"y":18},{"x":24,"y":19}];

function recalcPath() {
    'use strict';
    var walkables = [30];
    pathfinder.setGrid(map.layers[0].data, walkables);

    pathfinder.setCallbackFunction(function(p) {
        if (p === null) {
            var block = incTower.blocks.pop();
            map.putTile(30,block.x,block.y,"Ground");
            incrementObservable(incTower.numBlocks,-1);
            incrementObservable(incTower.gold,incTower.blockCost());
            recalcPath();
            return;

        }
        path = p;
        if (incTower.pathGraphic !== undefined) { incTower.pathGraphic.destroy(); }
        incTower.pathGraphic = game.add.graphics(0,0);
        var colour = "0x80080";
        incTower.pathGraphic.beginFill(colour);
        incTower.pathGraphic.lineStyle(2, colour, 0.5);
        for (var i = 0;i < p.length - 1;i++) {
            incTower.pathGraphic.moveTo(p[i].x * 32 + 16, p[i].y * 32 + 16);
            incTower.pathGraphic.lineTo(p[i+1].x * 32 + 16, p[i+1].y * 32 + 16);
        }
        incTower.pathGraphic.endFill();
        game.world.bringToTop(enemys);
        enemys.forEachAlive(function(enemy) {
            //console.log("CALLED FUNC");
            var valid = true;
            for (var i = 0;i < enemy.path.length;++i) {
                //console.log("Test: " + map.layers[0].data[enemy.path[i].y][enemy.path[i].x].index);
                if (map.layers[0].data[enemy.path[i].y][enemy.path[i].x].index !== 30) {
                    valid = false;
                    //console.log('INVALID!')
                    break;
                }
            }
            if (!valid) {
                //var curPathTile = enemy.path[enemy.curTile];
                enemy.path = p.slice(0);
            }
        });

    });

    pathfinder.preparePathCalculation([0,0], [24,18]);
    pathfinder.calculatePath();

}

for (var i = 0;i < incTower.startingSkills.length; i++) {
    if (!incTower.haveSkill(incTower.startingSkills[i])) {
        incTower.gainSkill(incTower.startingSkills[i]);
    }
}
var towers;
function preload() {
    game.load.tilemap('desert', 'assets/maps/tower-defense.json', null, Phaser.Tilemap.TILED_JSON);
    //game.load.atlasXML('incTower', 'assets/sprites/sprites.png', 'assets/sprites/sprites.xml');
    game.load.atlas('incTower', 'assets/sprites/main.png', 'assets/sprites/main.json');
    game.load.image('tiles', 'assets/maps/tmw_desert_spacing.png');
}

function costCalc(base,number,growth) {
    'use strict';
    return new BigNumber(growth).pow(number).times(base);
    //return base * Math.pow(growth,number) | 0;
}
incTower.numSuffixes = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', //Directly stolen from Swarm Simulator
    'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'ODc', 'NDc',
    'Vi', 'UVi', 'DVi', 'TVi', 'QaVi', 'QiVi', 'SxVi', 'SpVi', 'OVi', 'NVi',
    'Tg', 'UTg', 'DTg', 'TTg', 'QaTg', 'QiTg', 'SxTg', 'SpTg', 'OTg', 'NTg',
    'Qd', 'UQd', 'DQd', 'TQd', 'QaQd', 'QiQd', 'SxQd', 'SpQd', 'OQd', 'NQd',
    'Qq', 'UQq', 'DQq', 'TQq', 'QaQq', 'QiQq', 'SxQq', 'SpQq', 'OQq', 'NQq',
    'Sg', 'USg', 'DSg', 'TSg', 'QaSg', 'QiSg', 'SxSg', 'SpSg', 'OSg', 'NSg',
    'St', 'USt', 'DSt', 'TSt', 'QaSt', 'QiSt', 'SxSt', 'SpSt', 'OSt', 'NSt',
    'Og', 'UOg', 'DOg', 'TOg', 'QaOg', 'QiOg', 'SxOg', 'SpOg', 'OOg', 'NOg'
];
function humanizeBigNumber(number,precision) {
    'use strict';
    if (precision === undefined) { precision = 1;}
    var thresh = 1000;
    //number = 3;
    if (typeof(number.abs) !== 'function') { number = new BigNumber(number); }
    if (number.abs() < thresh) { return number.toFixed(precision); }
    var u = -1;
    do {
        number = number.div(thresh);
        ++u;
    } while (number.abs().gte(thresh));
    return number.toFixed(precision)+incTower.numSuffixes[u];

}

function humanizeNumber(number,precision) {
    'use strict';
    if (precision === undefined) { precision = 1;}
    if (!isPrimativeNumber(number)) { return humanizeBigNumber(number,precision); }
    var thresh = 1000;
    //number = 3;
    if (Math.abs(number) < thresh) { return parseFloat(number.toFixed(precision)); }
    var u = -1;
    do {
        number /= thresh;
        ++u;
    } while(Math.abs(number) >= thresh);
    return parseFloat(number.toFixed(precision))+incTower.numSuffixes[u];

}
incTower.humanizeNumber = humanizeNumber;


function create() {
    //This function CANNOT be made strict as it sets globals.
    ko.applyBindings(incTower);
    game.physics.startSystem(Phaser.Physics.ARCADE);
    game.stage.disableVisibilityChange = true;
    map = game.add.tilemap('desert');
    map.addTilesetImage('Desert', 'tiles');

    layer = map.createLayer('Ground');
    layer.resizeWorld();


    pathfinder = game.plugins.add(Phaser.Plugin.PathFinderPlugin);
    recalcPath();
    game.input.onDown.add(function (pointer) {
        var tileX = Math.floor(pointer.worldX / tileSquare);
        var tileY = Math.floor(pointer.worldY / tileSquare);
        console.log(tileX + ", " + tileY);
        if (tileX > 24 || tileY > 18) { return; }

        if (!incTower.buyingCursor()) { return; }
        if (incTower.buyingCursor() === 'block') {
            if (tileX === 0 && tileY === 0) { return; }
            var cost = incTower.blockCost();
            if (incTower.gold().gte(cost) && map.layers[0].data[tileY][tileX].index > 8) {

                incrementObservable(incTower.numBlocks);
                incrementObservable(incTower.gold,-cost);
                map.putTile(game.rnd.integerInRange(5,8),tileX,tileY,"Ground");
                incTower.blocks.push({x:tileX, y:tileY});
                recalcPath();
                incTower.buyingCursor(false);
            }
            return;
        }
        if (incTower.buyingCursor() === 'sellBlock') {
            if (tileX === 0 && tileY === 0) { return; }
            var tileIndex = map.layers[0].data[tileY][tileX].index;
            if (tileIndex > 4 && tileIndex < 9 && !tileForbidden[tileX][tileY]) {
                map.putTile(30,tileX,tileY,"Ground");
                incrementObservable(incTower.numBlocks,-1);
                incrementObservable(incTower.gold,incTower.blockCost());
                recalcPath();
                for (var i = 0; i < incTower.blocks.length; i++) {
                    var curBlock = incTower.blocks[i];
                    if (curBlock.x === tileX && curBlock.y === tileY) {
                        incTower.blocks.splice(i,1);
                        break;
                    }
                }

                incTower.buyingCursor(false);
            }
            return;
        }

        var cost = incTower.towerCost(incTower.towerAttributes[incTower.buyingCursor()].baseCost);
        var tileIndex = map.layers[0].data[tileY][tileX].index;
        if (!tileForbidden[tileX][tileY] && incTower.gold().gte(cost) && tileIndex >= 5 && tileIndex <= 8) {
            var opt = {};
            opt.towerType = incTower.buyingCursor();
            opt.cost = cost;
            Tower.prototype.posit(pointer,opt);
            incrementObservable(incTower.gold,-cost);
            incTower.buyingCursor(false);

        }

        console.log(tileX + ", " + tileY);


    },this);

    /*
     * Tower
     */

    towers = game.add.group();
    //--game.physics.enable(towers, Phaser.Physics.ARCADE);
    /*
     * Towers Bullets
     */
    bullets = game.add.group();
    //game.physics.enable(bullets, Phaser.Physics.ARCADE);
    /*bullets.enableBody = true;
    bullets.physicsBodyType = Phaser.Physics.ARCADE;
    *///bullets.createMultiple(30, 'bullet');
    //bullets.setAll('anchor.x', 0.5);
    //bullets.setAll('anchor.y', 1);
    //bullets.setAll('outOfBoundsKill', true);
   // bullets.setAll('checkWorldBounds', true);

    /*
     * Enemy
     */
    enemys = game.add.group();

    /*enemys.enableBody = true;
    enemys.physicsBodyType = Phaser.Physics.ARCADE;
*/



    //incTower.selectedText = game.add.text(830,260,"",{font: "16px Arial", fill: "#ffffff", align: "left"});

    //game.world.bringToTop(incTower.goldText);
    //t.events.onInputDown.add(Tower.prototype.add(), this);
    //t.events.onInputDown.add(function (pointer) { console.log(pointer); }, this);
    if (Worker === undefined) {
        setInterval(function () {
            //console.log("Update check!");
            //game.update(Math.floor(new Date()));
            convergeUpdate();
/*
            if ((Date.now() - incTower.lastUpdateRealTime) > 35) {
                //console.log("CALLING UPDATE");
                update();
            }
*/
        },1000);
    } else {
        var worker = new Worker('incTower-Worker.js');
        worker.postMessage({'cmd':'start'});
        worker.addEventListener('message', function(e) {
            if (e.data === "update") {
                convergeUpdate();
            }
        }, false);
    }
    var save = localStorage.getItem("save");
    if (save !== null) {
        loadSave(save);
    }

    //We need a load function here for this to really make sense
    if (!incTower.dialogWelcome) {
        okDialog({
            title: "Incremental Tower Defense",
            message:"In the beginning you can build the following things: " +
            "<ul>" +
            "<li><b>Blocks</b>: Reroutes enemy movement and required for tower placement. The purple line shows the way in which most enemies will move toward the red zone.</li>" +
            "<li><b>Kinetic Towers</b>: Deals damage to enemies, upgrading these is the main way to progress through the game.</li>" +
            "</ul>"
        });
        incTower.dialogWelcome = true;
    }
    game.time.events.loop(Phaser.Timer.SECOND, everySecond, this);
    //game.add.plugin(Phaser.Plugin.Debug);
    var startZone = game.add.graphics(0,0);
    var colour = "0x00FF00";
    startZone.beginFill(colour);
    startZone.lineStyle(5, colour, 1);
    startZone.lineTo(0, tileSquare);
    startZone.moveTo(0, 0);
    startZone.lineTo(tileSquare, 0);
    startZone.endFill();

    var endZone = game.add.graphics(800,608);
    colour = "0xFF0000";
    endZone.beginFill(colour);
    endZone.lineStyle(5, colour, 1);
    endZone.lineTo(0, -tileSquare);
    endZone.moveTo(0, 0);
    endZone.lineTo(-tileSquare, 0);
    endZone.endFill();
    game.world.bringToTop(endZone);
}

function convergeUpdate() {
    'use strict';
    var ticks = (Date.now() - incTower.lastUpdateRealTime) / 16;
    var lastRealUpdate = incTower.lastUpdateRealTime;
    for (var i = 0;i < ticks;i++) {
        game.update(lastRealUpdate + 16 * i);
    }
}

function rgbToHex (r, g, b) {
    'use strict';
    return "0x" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function createSaveObj(obj) {
    'use strict';
    var save = {};
    var dontSave = [
        'self',
        'lastUpdate',
        'lastUpdateRealTime',
        'numTowers',
        'rangeIndicator',
        'currentlySelected',
        'currentlySelectedIndicator',
        'bossEnemyPacks',
        'normalEnemyPacks',
        'buyingCursor',
        'deadBullets',
        'frame',
        'enemyAnimations',
        'generatingEnemies',
        'towerAttributes',
        'floatingTexts',
        'availableTowers',
        'bossPowers',
        'numSuffixes',
        'skillAttributes',
        'startingSkills',
        //The following are extra cruft (for save purposes) caused by subclassing tower to sprite
        '_width',
        '_height',
        'tint',
        'cachedTint',
        'blendMode',
        'key',
        'customRender',
        'fireLastTime',
        'z',
        'previousRotation',
        'fresh',
        'renderOrderID',
        '_cacheAsBitmap',
        '_cacheIsDirty',
        '_cr',
        '_sr',
        'alpha',
        'renderable',
        'visible',
        'worldAlpha',
        'worldRotation',
        'children',
        'rotation',
        'type',
        'physicsType'
    ];
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            if (ko.isComputed(obj[prop])) { continue; }
            if (dontSave.indexOf(prop) > -1) { continue; }
            if (ko.isObservable(obj[prop])) {
                //console.log("Currently on: " + prop);
                if (isPrimativeNumber(obj[prop]()) || typeof obj[prop]() === 'string' || typeof obj[prop]() === 'boolean') {
                    save[prop] = obj[prop]();
                } else if (isArray(obj[prop]())) {
                    save[prop] = [];
                    for (var i = 0;i < obj[prop]().length;i++) {
                        save[prop][i] = obj[prop]()[i];
                    }
                } else {
                    //Should be a big number if we get to ehre
                    if (obj[prop]().toJSON === undefined) { console.log(prop + " ERROR"); }
                    save[prop] = obj[prop]().trunc().toJSON();
                }
                continue;
            }
            if (prop === 'towers') {
                save[prop] = [];
                for (var i = 0; i < obj[prop].length; ++i) {

                    save[prop].push(createSaveObj(obj[prop][i]));
                }
                continue;
            }
            //if (typeof(obj[prop]) === 'object' && !isArray(obj[prop]) && obj[prop] !== null && typeof(obj[prop].push) === 'function') {
            if (prop === 'skills') {
                //We have an observable dict
                save[prop] = {};
                var keys = obj[prop].keys();
                for (var key in keys) {
                    var value = obj[prop].get(keys[key])();
                    save[prop][keys[key]] = {
                        skillLevel: value.get('skillLevel')(),
                        skillPoints: value.get('skillPoints')().toJSON(),
                        skillPointsCap: value.get('skillPointsCap')().toJSON()
                    };
                }
            }
            if (typeof(obj[prop]) === 'object' && !isArray(obj[prop])) { continue; }
            if (typeof(obj[prop]) === 'function') { continue; }

            save[prop] = obj[prop];
        }
    }
    return save;
}
//Repeat event that fires on every second. Currently used for regenerating enemies.
function everySecond() {
    //Training skills
    'use strict';
    incTower.mana(BigNumber.min(incTower.maxMana(), incTower.mana().plus(incTower.maxMana().times(0.001))));
    if (!(incTower.activeSkill() in incTower.skillAttributes)) {
        var skills = incTower.skills.keys();
        shuffle(skills);
        for (var i = 0;i < skills.length;i++) {
            var possibleSkill = skills[i];
            if (incTower.skillAttributes[possibleSkill].maxLevel !== undefined && incTower.getSkillLevel(possibleSkill) >= incTower.skillAttributes[possibleSkill].maxLevel) { continue; }
            incTower.activeSkill(skills[i]);
            break;
        } 
        
    }

    var skill = incTower.skills.get(incTower.activeSkill())();
    incrementObservable(skill.get('skillPoints'), incTower.skillRate());
    if (skill.get('skillPoints')().gte(skill.get('skillPointsCap')())) {
        skill.get('skillPoints')(skill.get('skillPoints')().sub(skill.get('skillPointsCap')()));
        incrementObservable(skill.get('skillLevel'));
        skill.get('skillPointsCap')(costCalc(incTower.skillAttributes[incTower.activeSkill()].baseCost,skill.get('skillLevel')(),incTower.skillAttributes[incTower.activeSkill()].growth));
        incTower.checkSkills();
        console.log("Hit: " + skill.get('skillLevel')() + " out of " + incTower.skillAttributes[incTower.activeSkill()].maxLevel);
        if (incTower.skillAttributes[incTower.activeSkill()].maxLevel !== undefined && skill.get('skillLevel')() >= incTower.skillAttributes[incTower.activeSkill()].maxLevel) {
            incTower.activeSkill(false);
        }
        //incTower.skills.get(incTower.activeSkill()).push('skillPointsCap')()();
    }
    enemys.forEachAlive(function(enemy) {
        if (enemy.regenerating > 0 && enemy.statusEffects.chilled().lt(100)) {
            var curHealth = enemy.health();
            var healAmount = enemy.maxHealth.times(enemy.regenerating * 0.01);
            if (healAmount.add(curHealth).gt(enemy.maxHealth)) { healAmount = enemy.maxHealth.minus(curHealth); }
            if (enemy.statusEffects.burning() > 0) {
                enemy.statusEffects.burning(enemy.statusEffects.burning().times(0.8)); //Reduces the burning instead of allowing a full regen tick
            } else if (healAmount > 0) {
                incTower.createFloatingText({'color':'green', 'around':enemy,'amount':healAmount, 'type':'regenerating'});
                incrementObservable(enemy.health,healAmount);
            }
        }
        if (enemy.teleport > 0 && enemy.statusEffects.chilled().lt(100) && !enemy.knockback) {
            if (game.rnd.integerInRange(0,100) <= 10) {
                var origScale = enemy.scale.x;
                var blinkTween = game.add.tween(enemy.scale).to({x:0},250, Phaser.Easing.Quadratic.In);
                var bestDist = 0;
                var curTileEntry = enemy.path[enemy.curTile];
                var possibleTiles = [];
                for (var i = enemy.curTile;i < enemy.path.length;++i) {
                    var destTile = enemy.path[i];
                    var dist = Math.abs(destTile.x - curTileEntry.x) + Math.abs(destTile.y - curTileEntry.y);
                    if (dist <= enemy.teleport && dist >= 1) {
                        possibleTiles.push(i);
                    }
                }
                enemy.curTile =  game.rnd.pick(possibleTiles);
                var bestTile = enemy.path[enemy.curTile];

                var moveTween = game.add.tween(enemy).to({x:bestTile.x * 32 + 16, y:bestTile.y * 32 + 16},50,"Linear");
                var blinkInTween = game.add.tween(enemy.scale).to({x:origScale},250, Phaser.Easing.Quadratic.In);
                blinkTween.chain(moveTween,blinkInTween);
                blinkTween.start();
            }
        }
        var statusEffects = Object.keys(enemy.statusEffects);
        for (var i = 0;i < statusEffects.length;++i) {
            var effectName = statusEffects[i];
            var effect = enemy.statusEffects[effectName];
            if (effect().gt(0)) {
                effect(effect().times(0.8));
                if (effectName === 'burning') {
                    enemy.assignDamage(effect(),'fire');
                }
                if (effect().lt(3)) {
                    effect(new BigNumber(0));
                    if (effectName === 'burning') {
                        enemy.burningSprite.visible = false;
                    }
                }
                if (statusEffects[i] === 'chilled' && effect().lt(100) && enemy.speedX === 0 && enemy.speedY === 0) {
                    enemy.nextTile();
                }
            }
        }
        enemy.elementalRuneDiminishing = _.mapValues(enemy.elementalRuneDiminishing, function (dim) {
            if (dim < 0.5) { return 0; }
            return dim * 0.95;
        });
        var reaction = false;
        for (i = 0;i < enemy.elementalRunes.length;i++) {
            if (game.rnd.integerInRange(0,100) < 10) {
                reaction = enemy.elementalRunes[i].runeType;
                break;
            }
        }
        if (reaction) {
            var newElementalRunes = [];
            var eligibleToReact = {};
            eligibleToReact[reaction] = true;
            var reactionCounts = {};
            for (i = 0; i < enemy.elementalRunes.length; i++) {
                var runeType = enemy.elementalRunes[i].runeType;
                if (runeType in eligibleToReact) {
                    if (!(runeType in reactionCounts)) { reactionCounts[runeType] = 0; }
                    reactionCounts[runeType]++;
                    enemy.elementalRunes[i].destroy();
                } else {
                    newElementalRunes.push(enemy.elementalRunes[i]);
                }
            }
            enemy.elementalRunes = newElementalRunes;
            enemy.repositionRunes();
            enemy.performReaction(reaction, reactionCounts);
            //Run the reaction
        }
    });
}
function update() {
    'use strict';
    var currentTime = game.time.now;
    incTower.frame++;
    if (incTower.lastUpdate === 0) { incTower.lastUpdate = currentTime; }
    incTower.lastUpdateRealTime = Date.now();
    incTower.lastUpdate = currentTime;

    if ((!incTower.generatingEnemies) && (enemys.countLiving() === 0)) {
        if (incTower.wave() > 0) {
            //Save state
            var saveData = JSON.stringify(createSaveObj(incTower));
            $('#b64_save').val(btoa(saveData));
            localStorage.setItem("save",saveData);
        }
        enemys.removeAll();
        if (incTower.wave() > 0 && incTower.wave() % 5 === 0) {
            if (!incTower.dialogBossKill) {
                incTower.dialogBossKill = true;
                okDialog({
                    title: "First Boss Kill",
                    message: "Congratulations! You killed your first boss wave. " +
                             "Bosses do not cycle back through your defenses if they are not defeated. " +
                             "If killed it allows you to redeem an upgrade."
                });

            }
        }
        if (!incTower.farmMode()) {
            incrementObservable(incTower.wave);
        }

        //generateEnemy(Math.pow(incTower.wave * 5,1.35));
        generateEnemy(costCalc(5,incTower.wave(),1.2));
    }
    bullets.forEachAlive(function (bullet) {
        var range = bullet.tower.range;
        var timeSinceFired = game.time.now - bullet.fired;
        //The default speed is hardcoded at 300px/s, or 300px/1000ms we can use this ratio to see if we've gone past our range.
        if (timeSinceFired > ((range + 25) * 3.333)) { // Equivalent to (range / 300) * 1000
            bullet.kill();
            var frame = bullet._frame.name;
            if (!(frame in incTower.deadBullets)) { incTower.deadBullets[frame] = []; }
            incTower.deadBullets[frame].push(bullet);
            return;
        }
        //console.log(bullet.target);
        if (bullet.target.alive) {
            game.physics.arcade.moveToObject(bullet, bullet.target, 300);
        }

    });
    if (incTower.currentlySelectedIndicator !== null) {
        var selected = incTower.currentlySelected();
        incTower.currentlySelectedIndicator.x = selected.x;
        incTower.currentlySelectedIndicator.y = selected.y;
    }

    game.physics.arcade.overlap(bullets, enemys, collisionHandler, null, this);
}

function collisionHandler(bullet, enemy) {
    'use strict';
    if (!bullet.alive) { return; }
    bullet.kill();
    var frame = bullet._frame.name;
    if (!(frame in incTower.deadBullets)) { incTower.deadBullets[frame] = []; }
    incTower.deadBullets[frame].push(bullet);
    var damage = bullet.damage;
    var towerType = bullet.tower.towerType;
    enemy.assignDamage(damage,towerType);
    if (towerType === 'fire' || towerType === 'water' || towerType === 'air' || towerType === 'earth') {
        incrementObservable(enemy.elementalInstability,BigNumber.random().times(damage));
        var chance = 0.10; //10% base chance of applying a rune
        chance += (0.05 * incTower.getSkillLevel(towerType + 'RuneApplication')); //increases by 5% per rank in the relevant skill
        chance -= (0.05 * enemy.elementalRuneDiminishing[towerType] || 0);
        if (game.rnd.frac() < chance) {
            enemy.addElementalRune(bullet.tower.towerType);
            if (game.rnd.frac() < (0.05 * incTower.getSkillLevel(towerType + 'AdvancedRuneApplication'))) {
                enemy.addElementalRune(bullet.tower.towerType);
            }

        }

    }




}

function generateEnemy(difficulty) {
    'use strict';
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
        basePack = incTower.generateNormalPack();
    } else {
        if (!incTower.selectedBossPack) {
            incTower.selectedBossPack = incTower.generateBossPack(); /*incTower.bossEnemyPacks[(Math.random() * incTower.bossEnemyPacks.length) | 0];*/
        }
        basePack = incTower.selectedBossPack;
    }
    //Expand it out
    var pack = [];
    var remainingHealthMultiplier = 1; //By default we split the health pool evenly across all the mobs
    var unspecifiedHealthWeights = 0;
    basePack.forEach(function (packEntry) {
        var count = 1;
        if ("count" in packEntry) { count = packEntry.count; }
        for (var j = 0;j < count;j++) {
            var tempPack = {};
            if ("healthWeight" in packEntry) { //We have a specific health weight set so we subtract from our remaining
                remainingHealthMultiplier -= packEntry.healthWeight;
            } else { //If we don't ahve a weight set we add to the count
                unspecifiedHealthWeights++;
            }
            for (var key in packEntry) {
                if (packEntry.hasOwnProperty(key)) {
                    if (key === "count") { continue; }
                    tempPack[key] = packEntry[key];
                }
            }
            pack.push(tempPack);
        }
    });
    var remainingHealthWeight = remainingHealthMultiplier / unspecifiedHealthWeights;
    for (var j = 0;j < pack.length;j++) {
        if (!("healthWeight" in pack[j])) {
            pack[j].healthWeight = remainingHealthWeight;
        }
        pack[j].health = BigNumber.max(1,difficulty.times(pack[j].healthWeight));
        if ('bonusHealthPercentage' in pack[j]) {
            pack[j].health = pack[j].health.times(1 + (pack[j].bonusHealthPercentage * 0.01));
        }
        pack[j].goldValue = BigNumber.max(totalWaveGold.times(Math.min(1,pack[j].healthWeight).toPrecision(15)),1).ceil();
    }
    var offset = 0;
    for (var i = 0;i < pack.length;++i) {
        var packEntry = pack[i];
        if (packEntry.swarm === true) {
            offset -= 16;
        } else {
            offset -= 48;
        }
        new Enemy(offset, path[0].y * tileSquare, packEntry);
    }
    incTower.generatingEnemies = false;

}
function calcSkill(skill,toLevel) {
    'use strict';
    var tally = new BigNumber(0);
    for (var i = 0; i < toLevel;i++) {
        tally = tally.plus(costCalc(incTower.skillAttributes[skill].baseCost,i,incTower.skillAttributes[skill].growth));
    }
    return tally;
}
function calcSkillGrowth(skill,toLevel,targetTime) {
    'use strict';
    var toggle = 1;
    var targetTime = new BigNumber(targetTime);
    while (1) {
        var baseGrowth = incTower.skillAttributes[skill].growth;
        var posGrowth = baseGrowth + toggle;
        var negGrowth = baseGrowth - toggle;
        var zeroval = calcSkill(skill,toLevel).minus(targetTime).abs();
        incTower.skillAttributes[skill].growth = posGrowth;
        var posval = calcSkill(skill,toLevel).minus(targetTime).abs();
        incTower.skillAttributes[skill].growth = negGrowth;
        var negval = calcSkill(skill,toLevel).minus(targetTime).abs();
        if (zeroval.lt(posval) && zeroval.lt(negval)) {
            console.log("Within " + zeroval.toJSON() + " at " + baseGrowth);
            if (zeroval.lt(1)) { break; }
            toggle /= 2;
        } else if (posval.lt(negval)) {
            console.log("Within " + posval.toJSON() + " at " + posGrowth);
            incTower.skillAttributes[skill].growth = posGrowth;
        } else {
            console.log("Within " + negval.toJSON() + " at " + negGrowth);
            incTower.skillAttributes[skill].growth = negGrowth;
        }






    }


}
