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
//This is a cursor object used for keeping track of building locations, spells etc.
function Cursor(type, param, action) {
    'use strict';
    this.type = type;
    this.param = param;
    this.indicator = game.add.graphics(0,0);
    if (type === 'buy' || type === 'sell') {
        //incTower.currentlySelectedIndicator.lineStyle(2, 0x66cc00, 3);
        this.indicator.beginFill(0x3333FF, 0.5);
        this.indicator.drawRect(0,0,32,32);
    }
    if (type === 'spell') {
        this.indicator.beginFill(0x760076, 0.5);
        this.indicator.drawCircle(0,0,incTower.spellAttributes[param].diameter);
    }
    this.indicator.x = game.input.x;
    this.indicator.y = game.input.y;
    this.action = action;
}

function Spell(opts) {
    this.fullName = opts.fullName;
    this.manaCost = opts.manaCost;
    this.trueManaCost = ko.pureComputed(function () {
        if (incTower === undefined) { return 0; }
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

function addToObsArray(arr, value) {
    'use strict';
    //Adds a value to an observable array (or regular array) if it doesn't already exist.
    if (arr.indexOf(value) < 0) { arr.push(value); }
}
function emptyObsArray(arr) {
    while (arr().length > 0) {
        arr.shift();
    }
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
                    incTower[prop]([]);
                    for (i = 0;i < save[prop].length;i++) {
                        addToObsArray(incTower[prop],save[prop][i])
                        //incTower[prop].push(save[prop][i]);
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
        _.forEach(incTower.blocks(), function (block) {
            map.putTile(30,block.x,block.y,"Ground");
        });
        incTower.blocks([]);
        _.forEach(save.blocks, function (block) {
            map.putTile(game.rnd.integerInRange(5,8),block.x,block.y,"Ground");
            incTower.blocks.push({x:block.x, y: block.y});
        });
        recalcPath();
    }
    if ('skills' in save) {
        //We have an observable dict
        _.mapValues(save.skills, function (skillAttribs, skillName) {
           incTower.gainSkill(skillName, skillAttribs);
        });
        incTower.checkSkills();
    }
    if ('towers' in save) {
        _.forEach(save.towers, function (tower) {
            var tileY = tower.tileY;
            var tileX = tower.tileX;
            var index = map.layers[0].data[tileY][tileX].index;
            if (index >= 5 && index <= 8) {
                new Tower(tower);
            } else {
                incrementObservable(incTower.gold,tower.goldSpent);
            }
        });
    }
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
                },
             }, event);
        });
    $('#skills').on('click','#skill_queue_button', function (e) {
        incTower.enqueueSkill(incTower.UIselectedSkill());
        e.preventDefault();
    });
    $('#skills').on('click','.remove-queue', function (e) {
        var jthis = $(this);
        var parent = jthis.parent();
        var skill = parent.attr('data-skill');
        var rank = parseInt(parent.attr('data-rank'));
        incTower.skillQueue.remove(function (item) {
            return item[0] === skill && item[1] === rank;
        });
        e.preventDefault();
    });
    $('#skills').on('click','#skill_queue_prereqs', function (e) {
        var prereqs = [];
        var toFind = incTower.UIselectedSkill();
        while (toFind !== false) {
            var prereq = incTower.skillGetPrereq(toFind);
            if (prereq) {
                toFind = prereq[0];
                prereqs.unshift(prereq);
            } else {
                toFind = false;
            }
        }
        _.forEach(prereqs, function(prereq) {
            while (incTower.directlyQueueable(prereq[0]) && incTower.directlyQueueable(prereq[0]) <= prereq[1]) {
                incTower.enqueueSkill(prereq[0]);
            }
        });
        console.log(prereqs);
        //incTower.enqueueSkill();
        e.preventDefault();
    });

    $('#skills_tree').on('select_node.jstree', function (e, data) {
        var selected = data.selected[0];
        if (selected in incTower.skillAttributes) {
            incTower.UIselectedSkill(selected);
        }
    }).jstree({
        core: {
            data: incTower.skillTreeData(),
            multiple: false,
            check_callback: true
        }
    });
    $('#sortable_queue').sortable({
        stop: function () {
            var potentialList = [];
            $('#sortable_queue li').each(function (i,v) {
                var jv = $(v);
                var skill = jv.attr('data-skill');
                var rank = jv.attr('data-rank');
                potentialList.push([skill, parseInt(rank)]);
            });
            var skillTally = {};
            var valid = true;
            _.forEach(potentialList, function (item) {
                if (!valid) { return false; }
                var skill = item[0];
                var rank = item[1];
                if (!_.has(skillTally,skill)) {
                    skillTally[skill] = incTower.getSkillLevel(skill);
                    if (!incTower.haveSkill(skill)) {
                        console.log(skill);
                        valid = false;

                    }
                }
                if (rank !== skillTally[skill] + 1) {
                    console.log(skill + " out of order ranks");

                    valid = false;
                }
                else {
                    skillTally[skill] = rank;
                }
                if (incTower.skillAttributes[skill].grants) {
                    var grants = [];
                    _.mapValues(incTower.skillAttributes[skill].grants, function (skills, level) {
                        if (rank >= level) {
                            grants = grants.concat(skills);
                        }
                    });
                    _.forEach(grants, function (grant) {
                       if (!_.has(skillTally, grant)) { skillTally[grant] = 0; }
                    });
                }
            });

            if (!valid) { return false; }
            incTower.skillQueue(potentialList);
            //incTower.activeSkill(potentialList[0][0]);
        }
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
    pathDirty: false,
    lastUpdate: 0,
    lastUpdateRealTime: Date.now(),
    generatingEnemies: false,
    availableTowers: ko.observableArray(['kinetic']),
    numTowers: ko.pureComputed(function () {
        return incTower.towers().length || 0;
    }),
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
        return 0.5 + (0.05 * incTower.getEffectiveSkillLevel('scrapping'));
    }),
    describePrestige: function (points, next) {
        if (next) {
            return 'On your next prestige reset your prestige points will be increased by ' + points + ' which will increase your learning rate by ' + (points * 10) + '%. Potential points are earned by defeating bosses after wave 100.';
        }
        return 'Increases your skill learning rate by ' + (points * 10) + '%.';
    },
    prestigePoints: ko.observable(0),
    prestigePointsNext: ko.pureComputed(function () {
        var wave = incTower.wave();
        if (wave < 100) { return 0; }
        var points = 1;
        wave--;
        while (wave >= 100) {
            points += Math.floor((wave / 25) + 1);
            wave -= 5;
        }
        return points;
    }),
    prestigeReset: function () {
        incrementObservable(incTower.prestigePoints, incTower.prestigePointsNext());
        incTower.gold(new BigNumber(150));
        incTower.wave(0);
        incTower.farmMode(false);
        _.forEach(incTower.skills.keys(), function (skill) {
            incTower.skills.remove(skill);
            incTower.skillTreeUpdateLabel(skill);
        });
        _.forEach(incTower.startingSkills, function (skill) {
            if (!incTower.haveSkill(skill)) {
                incTower.gainSkill(skill);
            }
        });
        incTower.clearQueue();
        incTower.UIselectedSkill(false);
        incTower.maxMana(new BigNumber(0));
        incTower.mana(new BigNumber(0));
        incTower.currentlySelected(false);
        emptyObsArray(incTower.availableTowers);
        emptyObsArray(incTower.availableSpells);
        incTower.availableTowers.push('kinetic');


        towers.forEach(function(tower) {
            if (tower.icon) { tower.icon.destroy(); }
            tower.kill();
        });
        towers.removeAll(true);
        tileForbidden = new Array(25);
        for (var i = 0;i < 25;++i) {
            tileForbidden[i] = new Array(19);
            for (var j = 0;j < 19;j++) {
                tileForbidden[i][j] = false;
            }
        }
        _.forEach(incTower.blocks(), function (block) {
            map.putTile(30,block.x,block.y,"Ground");
        });
        incTower.blocks([{x:13, y:9}]);
        map.putTile(game.rnd.integerInRange(5,8),13,9,"Ground");
        enemys.removeAll(true);
        towers.removeAll(true);
        incTower.towers([]);
        incTower.selectedBossPack = false;
        recalcPath();


    },
    prevWave: function () {
        incrementObservable(incTower.wave,-1);
        enemys.removeAll(true);
    },
    showChangelog: function () {
        'use strict';
        $('#changelog').dialog({
            width: 600,
            height: 500
        });
    },
    showSkills: function () {
        'use strict';
        incTower.checkSkills();
        $('#skills').dialog({
            width: 800,
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
                        console.trace();
                    }
                }
            }
        });

    },
    skills: ko.observableDictionary({}),
    skillQueue: ko.observableArray([]),
    clearQueue: function () {
        'use strict';
        while (incTower.skillQueue().length > 0) {
            incTower.skillQueue.shift();
        }
    },
    UIselectedSkill: ko.observable(false),
    activeSkill: ko.pureComputed(function() {
        'use strict';
        if (incTower.skillQueue().length === 0) { return false; }
        return incTower.skillQueue()[0][0];
    }),
    skillTreeUpdateLabel: function (skillName) {
        'use strict';
        var maxLevel = incTower.skillAttributes[skillName].maxLevel;
        if (maxLevel === undefined) { maxLevel = '&infin;'; }
        var currentLevel = '--';
        var stars = '';
        if (incTower.haveSkill(skillName)) {
            currentLevel = incTower.getSkillLevel(skillName);
            stars = _.repeat('&#9733;', Math.floor(currentLevel / 20));
        }


        var label = incTower.skillAttributes[skillName].fullName + stars + ' (' + currentLevel + ' / ' + maxLevel + ')';
        $('#skills_tree').jstree('rename_node', '#' + skillName, label);
    },
    checkQueue: function () {
        'use strict';
        while (true) {
            if (incTower.skillQueue().length === 0) { break; }
            var firstItem = incTower.skillQueue()[0];
            if (incTower.getSkillLevel(firstItem[0]) !== firstItem[1] - 1) {
                incTower.skillQueue.shift();
            } else {
                break;
            }
        }
        if (!incTower.activeSkill() || !_.has(incTower.skillAttributes, incTower.activeSkill())) {
            if (incTower.skillQueue().length === 0) {
                var skills = incTower.skills.keys();
                shuffle(skills);
                incTower.enqueueSkill(_.find(skills, function (skill) {
                    return incTower.directlyQueueable(skill);
                }));
            }
            //incTower.activeSkill(incTower.skillQueue()[0][0]);
        }

    },
    //switchActiveSkill: function(skill) {
    //    'use strict';
    //    incTower.activeSkill(skill);
    //},
    skillHasMax: function (skillName) {
        'use strict';
        return incTower.skillAttributes[skillName].maxLevel !== undefined;
    },
    skillGetPrereq: function (skillNameToFind) {
        'use strict';
        if (incTower.skillAttributes[skillNameToFind].prereq) { return incTower.skillAttributes[skillNameToFind].prereq; }
        if (_.includes(incTower.startingSkills, skillNameToFind)) {
            incTower.skillAttributes[skillNameToFind].prereq = false;
            return false;
        }
        var ret;
        _.forEach(_.keys(incTower.skillAttributes), function (skill) {
            if (incTower.skillAttributes[skill].grants === undefined) { return; }
            _.mapValues(incTower.skillAttributes[skill].grants, function (skills, level) {
                if (_.includes(skills, skillNameToFind)) {
                    ret = [skill, parseInt(level)];
                    incTower.skillAttributes[skillNameToFind].prereq = ret;
                    return false;
                }
            });
        });
        return ret;

    },
    skillIsMaxed: function(skillName) {
        'use strict';
        if (!skillName) { return false; }
        if (incTower.skillHasMax(skillName)) {
            if (incTower.getSkillLevel(skillName) >= incTower.skillAttributes[skillName].maxLevel) { return true; }
        }
        return false;
    },

    skillRankInQueue: function (skill) {
        'use strict';
        var minRank = 0;
        _.map(incTower.skillQueue(), function(item) {
            if (item[0] === skill) {
                minRank = item[1];
            }
        });
        return minRank;
    },
    skillMaxedInQueue: function (skill) {
        'use strict';
        if (!skill) { return false; }
        var minRank = incTower.skillRankInQueue(skill) + 1;
        if (incTower.skillAttributes[skill].maxLevel !== undefined && minRank > incTower.skillAttributes[skill].maxLevel) {
            return true;
        }
        return false;
    },
    directlyQueueable: function (skill) {
        'use strict';
        if (!(skill in incTower.skillAttributes)) { return false; }
        //Returns the rank trainable in the skill if it is directly trainable, meaning all prereqs are met in the queue already, otherwise false
        var minRank = Math.max(incTower.getSkillLevel(skill), incTower.skillRankInQueue(skill)) + 1;

        if (incTower.skillAttributes[skill].maxLevel !== undefined && minRank > incTower.skillAttributes[skill].maxLevel) {
            return false;
        }
        if (!incTower.haveSkill(skill)) {
            var grants = [];
            _.map(incTower.skillQueue(), function(item) {
                var skill = item[0];
                var rank = item[1];
                if (incTower.skillAttributes[skill].grants !== undefined) {
                    _.mapValues(incTower.skillAttributes[skill].grants, function (skills, level) {
                       if (rank >= level) {
                           grants = grants.concat(skills);
                       }
                    });
                }
            });
            if (!_.includes(grants,skill)) { return false; }
        }
        return minRank;
    },
    directlyRemovable: function (skill, rank) {
        'use strict';
        var removable = true;
        var possGrants = incTower.possibleGrants(skill,rank);
        _.forEach(incTower.skillQueue(), function (item) {
            if (item[0] === skill && item[1] === rank + 1) {
                removable = false;
                return false;
            }
            if (_.includes(possGrants,item[0])) {
                removable = false;
                return false;
            }


        });
        return removable;
    },
    enqueueSkill: function(skill) {
        'use strict';
        var minRank = incTower.directlyQueueable(skill);
        if (minRank === false) { return false; }
        incTower.skillQueue.push([skill, minRank]);

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
    describeManaRegeneration: ko.pureComputed(function () {
       return 'Regenerating ' + incTower.manaRegeneration() + ' mana per second.';
    }),
    manaRegeneration: ko.pureComputed(function () {
        return 1 + incTower.getEffectiveSkillLevel('manaRegeneration');
    }),
    spellLevel: ko.observable(new BigNumber(0)),
    spellLevelDamageFactor: ko.pureComputed(function () {
       return Math.pow(2,incTower.spellLevel());
    }),
    availableSpells: ko.observableArray([]),
    castSpell: function (spell) {
        'use strict';
        var manaCost = incTower.spellAttributes[spell].trueManaCost();
        if (incTower.mana().lt(manaCost)) { return; }
        incTower.cursor(new Cursor('spell',spell, function (pointer) {
            if (incTower.mana().lt(manaCost)) {
                incTower.clearCursor();
                return;
            }
            incTower.spellAttributes[spell].perform(pointer, spell);
            incrementObservable(incTower.mana,-manaCost);
            if (!shiftKey.isDown) {
                incTower.clearCursor();
            }

        }));
    },
    describeSpellLevel: ko.pureComputed(function () {
        'use strict';
        return "Increases the damage of all spells by " + incTower.spellLevelDamageFactor() + "X and increases their mana costs by " + (incTower.spellLevel() * 50) + "%.";
    }),

    spellAttributes: {
        manaBurst: new Spell({
            fullName: 'Mana Burst',
            damageType: 'arcane',
            manaCost: 100,
            diameter: 200,
            describe: function () {
                var damage = incTower.totalTowerDamage().times(incTower.spellLevelDamageFactor());
                var fullManaDamage = damage.times(10);

                return 'Deals ' + humanizeNumber(damage) + ' arcane damage in an area. When cast at full mana, it will deal ' + humanizeNumber(fullManaDamage) + ' instead. When cast at low mana there is a chance that you will increase your maximum mana pool by ' + humanizeNumber(0.25 * this.trueManaCost()) + '.'
            },
            perform: function (pointer, spellName) {
                var cursor = incTower.cursor();
                var diameter = incTower.spellAttributes[spellName].diameter;
                var area =  new Phaser.Circle(pointer.worldX, pointer.worldY, diameter);
                var damage = incTower.totalTowerDamage().times(incTower.spellLevelDamageFactor());
                if (incTower.mana().eq(incTower.maxMana())) { damage = damage.times(10); }

                enemys.forEachAlive(function(enemy) {
                    if (area.contains(enemy.x, enemy.y)) {
                        enemy.assignDamage(damage,'arcane');
                    }
                });
                var perMana = incTower.mana().div(incTower.maxMana()).toNumber();
                if (game.rnd.frac() < 1 - perMana) {
                    incrementObservable(incTower.maxMana,0.25 * this.trueManaCost());
                    //incTower.maxMana(incTower.maxMana().times(1.03));
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
                return 'Deals ' + humanizeNumber(damage) + ' arcane damage in a small area. If an enemy is killed they will be sacrificed, increasing the damage of all spells by 100% and increasing the mana cost of all spells by 50%.'
            },
            perform: function (pointer, spellName) {
                var cursor = incTower.cursor();
                var diameter = incTower.spellAttributes[spellName].diameter;
                var area =  new Phaser.Circle(pointer.worldX, pointer.worldY, diameter);
                var damage = incTower.totalTowerDamage().times(100).times(incTower.spellLevelDamageFactor());
                var livingBefore = enemys.countLiving();
                enemys.forEachAlive(function(enemy) {
                    if (area.contains(enemy.x, enemy.y)) {
                        enemy.assignDamage(damage,'arcane');
                    }
                });
                if (enemys.countLiving() < livingBefore) {
                    //Someone died!
                    incrementObservable(incTower.spellLevel);
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
                return 'Deals ' + humanizeNumber(damage) + ' water damage in an area, adding three water runes to each enemy that is not already frozen. If an enemy is frozen it takes ' + humanizeNumber(frozenDamage) + ' damage and gains one water rune instead.<br><br>If all enemies in the area are frozen 50% of the mana cost is refunded.';
            },
            perform: function (pointer, spellName) {
                var cursor = incTower.cursor();
                var diameter = incTower.spellAttributes[spellName].diameter;
                var area =  new Phaser.Circle(pointer.worldX, pointer.worldY, diameter);
                var damage = incTower.totalTowerDamage().div(2).times(incTower.spellLevelDamageFactor());
                var frozenDamage = damage.times(5);
                var allFrozen = true;

                enemys.forEachAlive(function(enemy) {
                    if (area.contains(enemy.x, enemy.y)) {
                        if (enemy.statusEffects.chilled().gte(100)) {
                            enemy.addElementalRune('water');
                            enemy.assignDamage(frozenDamage,'water');
                        } else {
                            enemy.assignDamage(damage,'water');
                            enemy.addElementalRune('water');
                            enemy.addElementalRune('water');
                            enemy.addElementalRune('water');
                            allFrozen = false;
                        }
                    }
                });
                if (allFrozen) {
                    incrementObservable(incTower.mana, 0.5 * this.trueManaCost());
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
                return 'Deals ' + humanizeNumber(damage) + ' fire damage in an area, adding three fire runes to each enemy that is not already burning. If an enemy is burning its burn amount is increased by ' + humanizeNumber(burnDamage) + ' damage and gains one fire rune instead.<br><br>Each already burning enemy hit will restore ' +  humanizeNumber(0.15 * this.trueManaCost()) + ' mana.';
            },
            perform: function (pointer, spellName) {
                var diameter = incTower.spellAttributes[spellName].diameter;
                var area =  new Phaser.Circle(pointer.worldX, pointer.worldY, diameter);
                var damage = incTower.totalTowerDamage().div(2).times(incTower.spellLevelDamageFactor());
                var burnDamage = damage.times(4);
                var alreadyBurning = 0;

                enemys.forEachAlive(function(enemy) {
                    if (area.contains(enemy.x, enemy.y)) {
                        if (enemy.statusEffects.burning().gte(1)) {
                            enemy.addElementalRune('fire');
                            incrementObservable(enemy.statusEffects.burning,burnDamage);
                            alreadyBurning++;
                        } else {
                            enemy.assignDamage(damage,'fire');
                            enemy.addElementalRune('fire');
                            enemy.addElementalRune('fire');
                            enemy.addElementalRune('fire');
                        }
                    }
                });

                if (alreadyBurning > 0) {
                    incrementObservable(incTower.mana, incTower.maxMana().minus(incTower.mana()).times(0.05 * alreadyBurning));
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
                return 'Deals ' + humanizeNumber(damage) + ' air damage in a focused area, adding three air runes to each enemy. If only one enemy is is under this spells effect it deals ' + humanizeNumber(soloDamage) + ' damage and gains six air runes instead.<br><br>Gain 20 mana for each air rune that was already attached to affected enemies.';
            },
            perform: function (pointer, spellName) {
                var diameter = incTower.spellAttributes[spellName].diameter;
                var area =  new Phaser.Circle(pointer.worldX, pointer.worldY, diameter);
                var damage = incTower.totalTowerDamage().div(3);
                var soloDamage = damage.times(7);
                var airRunes = 0;
                var impactedEnemies = [];

                enemys.forEachAlive(function(enemy) {
                    if (area.contains(enemy.x, enemy.y)) {
                        impactedEnemies.push(enemy);
                    }
                });
                _.forEach(impactedEnemies, function (enemy) {
                    airRunes += enemy.elementalRuneCounts.air || 0;
                    if (impactedEnemies.length === 1) {
                        enemy.addElementalRune('air');
                        enemy.addElementalRune('air');
                        enemy.addElementalRune('air');
                        enemy.addElementalRune('air');
                        enemy.addElementalRune('air');
                        enemy.addElementalRune('air');
                        enemy.assignDamage(soloDamage,'air');
                    } else {
                        enemy.addElementalRune('air');
                        enemy.addElementalRune('air');
                        enemy.addElementalRune('air');
                        enemy.assignDamage(damage,'air');

                    }
                });

                if (airRunes > 0) {
                    incrementObservable(incTower.mana, 20 * airRunes);
                }
            }
        })
    },

    skillAttributes: {
        construction: {
            fullName: 'Construction',
            baseCost: 20,
            growth: 1.1,
            describeRank: function (rank) {
                'use strict';
                return 'Reduces the cost of towers and their upgrades by ' + rank + '%.';
            },
            maxLevel: 10,
            grants: {
                10: ['modularConstruction', 'initialEngineering']
            }
        },
        modularConstruction:{
            fullName: 'Modular Construction',
            baseCost: 135,
            growth: 1.15,
            describeRank: function (rank) {
                'use strict';
                return 'Reduces the cost of upgrading all towers by ' + (rank * 5) + '%.';
            },
            maxLevel: 5,
            grants: {
                5: ['adaptiveUpgrades']
            }
        },
        adaptiveUpgrades: {
            fullName: 'Adaptive Upgrades',
            baseCost: 120,
            growth: 1.25,
            describeRank: function (rank) {
                'use strict';
                return "Each hit from a tower now reduces its upgrade cost by " + (rank * 0.1) + "% of the monster's gold value. Towers will automatically upgrade when their upgrade cost reaches zero.";
            },
            maxLevel: 10
        },
        initialEngineering: {
            fullName: 'Initial Engineering',
            baseCost: 135,
            growth: 1.15,
            describeRank: function (rank) {
                'use strict';
                return 'Increases the starting damage, attack speed, and range for all towers by ' + (rank * 5) + '%.';
            },

            maxLevel: 5,
            grants: {
                5: ['towerTemplates','scrapping']
            }
        },
        towerTemplates: {
            fullName: 'Tower Templates',
            baseCost: 120,
            growth: 2,
            describeRank: function (rank) {
                'use strict';
                return 'Increases the starting damage of towers by a factor of ' + Math.pow(10,rank) + '.';
            },
            maxLevel: 5,
            grants: {
                5: ['refinedBlueprints']
            }

        },
        scrapping: {
            fullName: 'Scrapping',
            baseCost: 80,
            growth: 1.5,
            describeRank: function (rank) {
                'use strict';
                return 'Refunds an additional ' + (rank * 5) + '% of gold spent after the sale of a tower.';
            },
            maxLevel: 5,
        },
        refinedBlueprints: {
            fullName: 'Refined Blueprints',
            baseCost: 15,
            growth: 1.2,
            describeRank: function (rank) {
                'use strict';
                return 'Increases the starting damage of towers by ' + (rank * 5) + '%.';
            },
        },
        marketConnections: {
            fullName: 'Market Connections',
            baseCost: 45,
            growth: 1.2,
            describeRank: function (rank) {
                'use strict';
                return 'Increases the gold reward on each kill by ' + (rank) + '%.';
            }


        },
        kineticTowers: {
            fullName: 'Kinetic Towers',
            baseCost: 20,
            growth: 1.1,
            maxLevel: 10,
            describeRank: function (rank) {
                'use strict';
                return 'Increases the damage that kinetic towers deal by ' + (5 * rank) + '%.';
            },
            grants: {
                10: ['shrapnelAmmo', 'kineticAmmo']
            }
        },
        shrapnelAmmo: {
            fullName: 'Shrapnel Ammo',
            baseCost: 20,
            growth: 1.1,
            maxLevel: 5,
            describeRank: function (rank) {
                'use strict';
                return 'There is a ' + (5 * rank) + '% chance on hit that the target will bleed for 100% of tower damage.';
            },
            grants: {
                5: ['anticoagulants']
            }
        },
        anticoagulants: {
            fullName: 'Anti-Coagulants',
            baseCost: 20,
            growth: 2.386,
            describeRank: function (rank) {
                'use strict';
                if (rank < 10) {
                    return 'Bleeding is reduced by ' + (50 - 5 * rank) + '% each tick instead of the base 50%.';
                }
                if (rank === 10) {
                    return 'Bleeding no longer reduced over time.';
                }
                if (rank > 10) {
                    return 'Instead of bleed damage being reduced it is increased by ' + (rank * 5) + '%.';
                }
            }
        },
        kineticAmmo:{
            fullName: 'Kinetic Ammo',
            baseCost: 15,
            growth: 1.1,
            describeRank: function (rank) {
                'use strict';
                return 'Optimizes the damage caused by kinetic towers, increasing damage by ' + (rank * 5) + '% per level.';
            }
        },
        magicalAffinity: {
            fullName: 'Magical Affinity',
            baseCost: 120,
            growth: 1.1,
            maxLevel: 1,
            describeRank: function () {
                'use strict';
                return "Grants magical affinity opening the path to casting spells and elemental towers.";
            },
            onMax: function () {
                'use strict';
                if (incTower.maxMana().eq(0)) {
                    incTower.maxMana(new BigNumber(1000));
                    incTower.mana(incTower.maxMana());
                }
                addToObsArray(incTower.availableSpells,'manaBurst');
                addToObsArray(incTower.availableSpells,'arcaneSacrifice');


            },
            grants: {
                1: ['fireAffinity', 'waterAffinity', 'earthAffinity', 'airAffinity', 'wizardry']
            }
        },
        wizardry: {
            fullName: 'Wizardry',
            baseCost: 60,
            growth: 1.2,
            maxLevel: 5,
            describeRank: function (rank) {
                'use strict';
                return "Increases arcane damage by " + (rank * 10) +'%.';
            },
            grants: {
                1: ['manaRegeneration']
            }
        },
        manaRegeneration: {
            fullName: 'Mana Regeneration',
            baseCost: 30,
            growth: 1.2,
            describeRank: function (rank) {
                'use strict';
                return "Increases mana regeneration by " + rank +' per second.';
            },
        },
        fireAffinity: {
            fullName: 'Fire Affinity',
            baseCost: 900,
            growth: 1.1,
            maxLevel: 1,
            describeRank: function (rank) {
                'use strict';
                return "Attunes yourself with fire which allows you to build fire towers which burn enemies over time, causing them to take increased damage from all sources.";
            },
            onMax: function () {
                'use strict';
                addToObsArray(incTower.availableTowers,'fire');
                addToObsArray(incTower.availableSpells,'smolder');
            },
            grants: {
                1: ['fireRuneApplication', 'fireMastery']
            }
        },
        fireMastery: {
            fullName: 'Fire Mastery',
            baseCost: 100,
            growth: 1.266,
            describeRank: function (rank) {
                'use strict';
                return "Increases all fire damage dealt by " + (rank * 10) + '%.';
            },
        },

        fireRuneApplication: {
            fullName: 'Fire Rune Application',
            baseCost: 100,
            growth: 1.266,
            maxLevel: 10,
            describeRank: function (rank) {
                'use strict';
                return "Increases the chance that a fire tower successfully applies a rune by " + (rank * 5) + '%.';
            },
            grants: {
                10: ['fireAdvancedRuneApplication']
            }
        },
        fireAdvancedRuneApplication: {
            fullName: 'Fire Rune Application (Advanced)',
            baseCost: 200,
            growth: 1.406,
            maxLevel: 10,
            describeRank: function (rank) {
                'use strict';
                return "When a fire tower successfully applies a rune, there is a " + (rank * 5) + '% chance that it will apply two instead.';
            }
        },
        waterAffinity: {
            fullName: 'Water Affinity',
            baseCost: 900,
            growth: 1.1,
            maxLevel: 1,
            describeRank: function (rank) {
                'use strict';
                return "Attunes yourself with water which allows you to build water towers which slow and freeze enemies.";
            },

            onMax: function () {
                'use strict';
                addToObsArray(incTower.availableTowers,'water');
                addToObsArray(incTower.availableSpells,'frostShatter');
            },
            grants: {
                1: ['waterRuneApplication', 'waterMastery']
            }
        },
        waterMastery: {
            fullName: 'Water Mastery',
            baseCost: 100,
            growth: 1.266,
            describeRank: function (rank) {
                'use strict';
                return "Increases all water damage dealt by " + (rank * 10) + '%.';
            },
        },
        waterRuneApplication: {
            fullName: 'Water Rune Application',
            baseCost: 100,
            growth: 1.266,
            maxLevel: 10,
            describeRank: function (rank) {
                'use strict';
                return "Increases the chance that a water tower successfully applies a rune by " + (rank * 5) + '%.';
            },
            grants: {
                10: ['waterAdvancedRuneApplication']
            }
        },
        waterAdvancedRuneApplication: {
            fullName: 'Water Rune Application (Advanced)',
            baseCost: 200,
            growth: 1.406,
            maxLevel: 10,
            describeRank: function (rank) {
                'use strict';
                return "When a water tower successfully applies a rune, there is a " + (rank * 5) + '% chance that it will apply two instead.';
            }
        },

        earthAffinity: {
            fullName: 'Earth Affinity',
            baseCost: 900,
            growth: 1.1,
            maxLevel: 1,
            describeRank: function (rank) {
                'use strict';
                return "Attunes yourself with earth which allows you to build earth towers which drop giant boulders from the sky, causing area of effect damage.";
            },

            onMax: function () {
                'use strict';
                addToObsArray(incTower.availableTowers,'earth');
            },
            grants: {
                1: ['earthRuneApplication','earthMastery']
            }

        },
        earthMastery: {
            fullName: 'Earth Mastery',
            baseCost: 100,
            growth: 1.266,
            describeRank: function (rank) {
                'use strict';
                return "Increases all earth damage dealt by " + (rank * 10) + '%.';
            },
        },

        earthRuneApplication: {
            fullName: 'Earth Rune Application',
            baseCost: 100,
            growth: 1.266,
            maxLevel: 10,
            describeRank: function (rank) {
                'use strict';
                return "Increases the chance that an earth tower successfully applies a rune by " + (rank * 5) + '%.';
            },
            grants: {
                10: ['earthAdvancedRuneApplication']
            }
        },
        earthAdvancedRuneApplication: {
            fullName: 'Earth Rune Application (Advanced)',
            baseCost: 200,
            growth: 1.406,
            maxLevel: 10,
            describeRank: function (rank) {
                'use strict';
                return "When an earth tower successfully applies a rune, there is a " + (rank * 5) + '% chance that it will apply two instead.';
            },
        },

        airAffinity: {
            fullName: 'Air Affinity',
            baseCost: 900,
            growth: 1.1,
            maxLevel: 1,
            describeRank: function (rank) {
                'use strict';
                return "Attunes yourself with air which allows you to build air towers which will occasionally trap enemies in a whirlwind, knocking them back.";
            },

            onMax: function () {
                'use strict';
                addToObsArray(incTower.availableTowers,'air');
                addToObsArray(incTower.availableSpells,'eyeOfTheStorm');
            },
            grants: {
                1: ['airRuneApplication', 'airMastery']
            }
        },
        airMastery: {
            fullName: 'Air Mastery',
            baseCost: 100,
            growth: 1.266,
            describeRank: function (rank) {
                'use strict';
                return "Increases all air damage dealt by " + (rank * 10) + '%.';
            },
        },
        airRuneApplication: {
            fullName: 'Air Rune Application',
            baseCost: 100,
            growth: 1.266,
            maxLevel: 10,
            describeRank: function (rank) {
                'use strict';
                return "Increases the chance that an air tower successfully applies a rune by " + (rank * 5) + '%.';
            },

            grants: {
                10: ['airAdvancedRuneApplication']
            }
        },
        airAdvancedRuneApplication: {
            fullName: 'Air Rune Application (Advanced)',
            baseCost: 200,
            growth: 1.406,
            maxLevel: 10,
            describeRank: function (rank) {
                'use strict';
                return "When an air tower successfully applies a rune, there is a " + (rank * 5) + '% chance that it will apply two instead.';
            },
        },
    },
    startingSkills: ['kineticTowers', 'construction', 'magicalAffinity'],
    gainSkill: function (name, opt) {
        'use strict';
        if (typeof opt === 'undefined') { opt = {}; }
        if (!(name in incTower.skillAttributes)) { console.log(name + " is not in our skills list."); }
        /*if (incTower.getSkillLevel(name) !== -1) { return; } //We already know the skill*/
        //Either gains a new skill at level 1 or loads in a previously saved skill
        console.log(name);
        var skillLevel = opt.skillLevel || 0;
        var skillPoints = new BigNumber(opt.skillPoints || 0);
        var skillPointsCap = costCalc(incTower.skillAttributes[name].baseCost, skillLevel, incTower.skillAttributes[name].growth);
        incTower.skills.push(name,ko.observableDictionary({
            skillLevel: skillLevel,
            skillPoints: skillPoints,
            skillPointsCap: skillPointsCap
        }));
        incTower.checkSkill(name);
        //incTower.skillTreeUpdateLabel(name);
    },
    describeSkill: function (name) {
        'use strict';
        if (!(name in incTower.skillAttributes)) { return ''; }
        var currentLevel = incTower.getSkillLevel(name);
        var desc = '';
        var maxed = incTower.skillIsMaxed(name);
        if (currentLevel > 0) {
            desc += "<p>" + incTower.skillAttributes[name].describeRank(incTower.levelToEffective(currentLevel)) + '</p>';
        }
        if (!maxed) {
            desc += '<p>Next Rank: ' + incTower.skillAttributes[name].describeRank(incTower.levelToEffective(currentLevel + 1)) + '</p>';
        }
        return desc;
    },
    getSkillLevel: function(name) {
        'use strict';
        if (incTower.skills.get(name)() === null) { return 0; }
        return incTower.skills.get(name)().get('skillLevel')();
    },
    getEffectiveSkillLevel: function (name) {
        return incTower.levelToEffective(incTower.getSkillLevel(name));
    },
    levelToEffective: function (skillLevel) {
        return skillLevel * Math.pow(2,Math.floor(skillLevel / 20));
    },
    possibleGrants: function(skill, atLevel) {
        'use strict';
        if (atLevel === undefined) {
            return _.flatten(_.values(incTower.skillAttributes[skill].grants));
        }
        var grants = [];
        _.mapValues(incTower.skillAttributes[skill].grants, function (skills, level) {
            if (atLevel >= level) {
                grants = grants.concat(skills);
            }
        });
        return grants;
    },
    checkSkills: function () {
        'use strict';
        _.map(incTower.skills.keys(), incTower.checkSkill);
    },
    checkSkill: function (skill) {
        'use strict';
        //console.log("CHECK : " + skill);
        var toAdd = [];
        if (incTower.skillAttributes[skill].maxLevel !== undefined && incTower.getSkillLevel(skill) > incTower.skillAttributes[skill].maxLevel) {
            incTower.skills.get(skill)().get('skillLevel')(incTower.skillAttributes[skill].maxLevel);
        }
        if (incTower.skillAttributes[skill].onMax !== undefined && incTower.skillIsMaxed(skill)) {
            incTower.skillAttributes[skill].onMax();
        }
        if (incTower.skillAttributes[skill].grants !== undefined) {
            var curLevel = incTower.getSkillLevel(skill);
            _.keys(incTower.skillAttributes[skill].grants).map(function (level) {
                if (curLevel >= level) {
                    toAdd = toAdd.concat(incTower.skillAttributes[skill].grants[level]);
                }
            });
        }
        //console.log(toAdd);
        _.map(toAdd, function (skill) {
            if (!incTower.haveSkill(skill)) {
                incTower.gainSkill(skill);
            }
        });
        incTower.skillTreeUpdateLabel(skill);
    },
    haveSkill: function (name) {
        'use strict';
        return incTower.skills.get(name)() !== null;
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
        return 1 + 0.1 * incTower.prestigePoints();
    },
    timeUntilSkillUp: function(pointDiff) {
        'use strict';
        return moment().add(pointDiff / incTower.skillRate(),'seconds').fromNow();
    },

    skillDescribeTimeAdded: function(skill) {
        'use strict';
        var directlyQueueable = incTower.directlyQueueable(skill);
        if (directlyQueueable) {
            return moment().add(costCalc(incTower.skillAttributes[skill].baseCost,directlyQueueable,incTower.skillAttributes[skill].growth) / incTower.skillRate(),'seconds').fromNow(true);
        }

    },
    towerIconCSS: function (tower) {
        return 'url(img/towers/'+tower+'.png)';
    },
    spellIconCSS: function (spell) {
        return 'url(img/spells/'+spell+'.png)';
    },
    towers: ko.observableArray([]),
    towerAttributes: {
        kinetic: {
            name: 'Kinetic',
            baseCost: 25,
            startingFireRate: 2000,
            damagePerLevel: 1,
            describe: function() {
                return 'Kinetic towers are cheap to build and reliable. Their simpler parts make them cheaper to upgrade as well.';
            }
        },
        earth: {
            name: 'Earth',
            baseCost: 100,
            damagePerLevel: 1,
            startingFireRate: 3000,
            icon: 'earth-element.png',
            describe: function() {
                return 'Earth towers deal earth damage and have a chance to attach an earth rune to enemies. When an earth reaction happens a giant boulder falls from the sky on the affected enemy.';
            }
        },
        air: {
            name: 'Air',
            baseCost: 100,
            damagePerLevel: 1,
            startingFireRate: 3000,
            icon: 'air-element.png',
            describe: function() {
                return 'Air towers deal air damage and have a chance to attach an air rune to enemies. When an air reaction happens a group of enemies will be knocked back..';
            }
        },
        fire: {
            name: 'Fire',
            baseCost: 100,
            damagePerLevel: 1,
            startingFireRate: 3000,
            icon: 'fire-element.png',
            describe: function() {
                return 'Fire towers deal fire damage and have a chance to attach a fire rune to enemies. When a fire reaction happens the affected enemy takes additional damage from all sources and takes burn damage over time.';
            }
        },
        water: {
            name: 'Water',
            baseCost: 100,
            damagePerLevel: 1,
            startingFireRate: 3000,
            icon: 'water-element.png',
            describe: function() {
                return 'Water towers deal water damage and have a chance to attach a water rune to enemies. When a water reaction occurs the affected enemy becomes either slowed or frozen in place depending on the number of runes.';
            }
        }
    },

    generateNormalPack: function () {
        'use strict';
        var numberOfCreeps = game.rnd.integerInRange(2,6);
        var possAnimations = _.keys(incTower.enemyAnimations);
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
            name: 'Swarm',
            describe: function () {
                'use strict';
                return "This unit is part of a swarm which causes it to spawn several copies with less health.";
            },
            maxLevel: 2
        },
        regenerating: {
            name: 'Regenerating',
            describe: function (mult) {
                'use strict';
                return "Regenerates " + (0.5 * mult) + "% of its max health a second.";
            }
        },
        healthy: {
            name: 'Healthy',
            describe: function (mult) {
                'use strict';
                return "Has " + (10 * mult) + "% bonus health.";
            }
        },
        fast: {
            name: 'Fast',
            describe: function (mult) {
                'use strict';
                return "Moves " + (10 * mult) + "% faster.";
            }
        },
        teleport: {
            name: 'Teleport',
            describe: function (mult) {
                'use strict';
                return "Has a 10% chance each second to teleport " + mult + " space(s).";
            }
        },
        shielding: {
            name: 'Shielding',
            describe: function (mult) {
                'use strict';
                return "This unit gets a shield that stops the next source of damage every " + humanizeNumber(4 / mult) + " seconds.";
            }
        },
        'fire-resistant': {
            name: 'Fire-Resistant',
            describe: function (mult) {
                'use strict';
                return "Reduces fire damage taken and fire rune attachment chance by " + humanizeNumber(20 * mult) + "%.";
            },
            maxLevel: 5,
            requirements: function () {
                'use strict';
                return incTower.haveSkill('fireAffinity');
            }
        },
        'water-resistant': {
            name: 'Water-Resistant',
            describe: function (mult) {
                'use strict';
                return "Reduces water damage taken and water rune attachment chance by " + humanizeNumber(20 * mult) + "%.";
            },
            maxLevel: 5,
            requirements: function () {
                'use strict';
                return incTower.haveSkill('waterAffinity');
            }
        },
        'air-resistant': {
            name: 'Air-Resistant',
            describe: function (mult) {
                'use strict';
                return "Reduces air damage taken and air rune attachment chance by " + humanizeNumber(20 * mult) + "%.";
            },
            maxLevel: 5,
            requirements: function () {
                'use strict';
                return incTower.haveSkill('airAffinity');
            }

        },
        'earth-resistant': {
            name: 'Earth-Resistant',
            describe: function (mult) {
                'use strict';
                return "Reduces earth damage taken and earth rune attachment chance by " + humanizeNumber(20 * mult) + "%.";
            },
            maxLevel: 5,
            requirements: function () {
                'use strict';
                return incTower.haveSkill('earthAffinity');
            }
        },
        'arcane-resistant': {
            name: 'Arcane-Resistant',
            describe: function (mult) {
                'use strict';
                return "Reduces arcane damage taken and arcane rune attachment chance by " + humanizeNumber(20 * mult) + "%.";
            },
            maxLevel: 5,
            requirements: function () {
                'use strict';
                return incTower.haveSkill('magicalAffinity');
            }
        }


        /*nullzone: {
            describe: function (mult) {
                return "Towers within " + mult + "space(s) of this unit cannot fire.";
            }
        }*/
    },
    seenPowers: {},
    generateBossPack: function () {
        'use strict';
        var bossPowers = _.keys(incTower.bossPowers);
        var totalPowers = Math.floor((incTower.wave() / 25) + 1);
        var possAnimations = _.keys(incTower.enemyAnimations);
        var ret = [];
        while (totalPowers >= 1) {
            var baseEntry = {
                name: game.rnd.pick(possAnimations),
                count: 1,
                bonusHealthPercentage: 0,
                regenerating: 0,
                speed: 1,
                scale: 1.3,
                powers: {}
            };
            baseEntry.length = incTower.enemyAnimations[baseEntry.name].length;
            var thisPowers = game.rnd.integerInRange(Math.min(5,totalPowers),totalPowers);
            totalPowers -= thisPowers;
            var eligiblePowers = _.clone(bossPowers);




            for (var i = 0;i < thisPowers;++i) {
                shuffle(eligiblePowers);
                var power = _.find(eligiblePowers, function (power) {
                    console.log(power);
                    var seenBefore = incTower.seenPowers[power] || 0;
                    var currentPowerLevel = baseEntry.powers[power] || 0;
                    if (currentPowerLevel > incTower.bossPowers[power].maxLevel) { return false; }
                    if (incTower.bossPowers[power].requirements && !incTower.bossPowers[power].requirements()) { return false; }
                    if (currentPowerLevel > seenBefore) { return false; }
                    return true;
                });
                if (power === undefined) {
                    power = _.find(eligiblePowers, function (power) {
                        var currentPowerLevel = baseEntry.powers[power] || 0;
                        if (currentPowerLevel > incTower.bossPowers[power].maxLevel) { return false; }
                        if (incTower.bossPowers[power].requirements && !incTower.bossPowers[power].requirements()) { return false; }
                        return true;
                    });
                }

                if (power === 'swarm') {
                    baseEntry.swarm = true;
                    baseEntry.count += game.rnd.integerInRange(3, 7);
                    if (baseEntry.scale > 0.7) {
                        baseEntry.scale *= 0.8;
                    }

                } else if (power === 'regenerating') {
                    baseEntry.regenerating += 0.5;
                } else if (power === 'fast') {
                    baseEntry.speed += 0.1;
                } else if (power === 'healthy') {
                    baseEntry.bonusHealthPercentage += 10;
                } else {
                    baseEntry[power] = (baseEntry[power] || 0) + 1;
                }
                if (power in baseEntry.powers) {
                    baseEntry.powers[power]++;
                } else {
                    baseEntry.powers[power] = 1;
                }
            }
            if (baseEntry.swarm) { baseEntry.bonusHealthPercentage -= 20; }
            _.mapValues(baseEntry.powers, function (level, power) {
                var prevSeen = incTower.seenPowers[power] || 0;
                if (level > prevSeen) {
                    incTower.seenPowers[power] = level;
                }
            });
            ret.push(baseEntry);

        }
        return ret;
    },
    selectedBossPack: false, //This holds our next boss, it's randomly generated and then remembered until beaten
    towerCost: function (base) {
        'use strict';
        if (base === undefined) { base = 25; }
        var amount = costCalc(base,incTower.numTowers(),1.4);
        amount = amount.times(1 - (incTower.getEffectiveSkillLevel('construction') * 0.01));
        return amount;
    },
    gainGold: function (amount, floatAround) {
        'use strict';
        //amount = amount.times(1 + 0.1 * incTower.prestigePoints());
        incrementObservable(incTower.gold,amount);
        if (floatAround !== undefined) {
            incTower.createFloatingText({'color':'#C9960C', 'duration':3000, 'around':floatAround,'text':'+'+humanizeNumber(amount) + 'g', 'scatter':16, 'type':'gold'});
        }
    },
    cursor: ko.observable(false),
    clearCursor: function () {
        'use strict';
        if (incTower.cursor() !== false && incTower.cursor().indicator) {
            incTower.cursor().indicator.destroy();
        }
        incTower.cursor(false);
    },
    numBlocks: ko.pureComputed(function () {
        'use strict';
        return incTower.blocks().length;
    }),
    blocks: ko.observableArray([{x:13, y:9}]),
    blockCost: function () {
        'use strict';
        return costCalc(1,incTower.numBlocks(),1.1);
    },
    buyBlock: function () {
        'use strict';
        var cost = incTower.blockCost();
        if (incTower.gold().gt(cost)) {
            incTower.cursor(new Cursor('buy','block', function(pointer) {
                var tileX = Math.floor(pointer.worldX / tileSquare);
                var tileY = Math.floor(pointer.worldY / tileSquare);
                if (tileX > 24 || tileY > 18) { return; }
                if (tileX === 0 && tileY === 0) { return; }
                var cost = incTower.blockCost();
                if (incTower.gold().gte(cost) && map.layers[0].data[tileY][tileX].index > 8) {
                    incrementObservable(incTower.gold, -cost);
                    map.putTile(game.rnd.integerInRange(5, 8), tileX, tileY, "Ground");
                    incTower.blocks.push({x: tileX, y: tileY});
                    incTower.pathDirty = true;
                    _.forEach(path, function (pathUnit) {
                        if (pathUnit.x === tileX && pathUnit.y === tileY) {
                            recalcPath();
                            return false;
                        }
                    });
                    //recalcPath();
                    if (!shiftKey.isDown) {
                        incTower.clearCursor();
                    }
                }
            }));

        }
    },
    tooltipUpgradeLeast: function () {
        return 'Upgrade the tower with the lowest upgrade-cast. Currently the cost to do this is ' + humanizeNumber(incTower.cheapestUpgradeCost()) + 'g';
    },
    towerKeybindLetter: function (i) {
        console.log(i);
        // Towers start at w because blocks are Q
        return ['W','E','R','T','Y','U','I','O'][i];
    },
    spellKeybindLetter: function (i) {
        // Towers start at w because blocks are Q
        return ['1','2','3','4','5','6','7','8','9'][i];
    },
    sellTool: function () {
        'use strict';
        incTower.cursor(new Cursor('sell','', function (pointer) {
            var tileX = Math.floor(pointer.worldX / tileSquare);
            var tileY = Math.floor(pointer.worldY / tileSquare);
            if (tileX > 24 || tileY > 18) { return; }
            if (tileX === 0 && tileY === 0) { return; }
            var tileIndex = map.layers[0].data[tileY][tileX].index;
            if (tileIndex > 4 && tileIndex < 9 && tileForbidden[tileX][tileY]) {
                _.forEach(towers.children, function(tower) {
                    if (tower.tileX === tileX && tower.tileY === tileY) {
                        SellTower(tower);
                        return false;
                    }
                });
                return;
            }
            if (tileIndex > 4 && tileIndex < 9 && !tileForbidden[tileX][tileY]) {
                map.putTile(30,tileX,tileY,"Ground");
                incrementObservable(incTower.gold,incTower.blockCost());
                for (var i = 0; i < incTower.blocks().length; i++) {
                    var curBlock = incTower.blocks()[i];
                    if (curBlock.x === tileX && curBlock.y === tileY) {
                        incTower.blocks.splice(i,1);
                        break;
                    }
                }
                recalcPath();
                if (!shiftKey.isDown) { incTower.clearCursor(); }
            }
        }));
    },
    buyTower: function(type) {
        'use strict';
        if (type === undefined) { type = 'kinetic'; }
        var baseCost = incTower.towerAttributes[type].baseCost;
        var cost = incTower.towerCost(baseCost);
        if (incTower.gold().gt(cost)) {
            console.log("Setting cursor to " + type);
            incTower.cursor(new Cursor('buy',type, function (pointer) {
                var tileX = Math.floor(pointer.worldX / tileSquare);
                var tileY = Math.floor(pointer.worldY / tileSquare);
                console.log(tileX + ', ' + tileY);
                if (tileX > 24 || tileY > 18) { return; }
                var towerType = incTower.cursor().param;
                var cost = incTower.towerCost(incTower.towerAttributes[towerType].baseCost);
                var tileIndex = map.layers[0].data[tileY][tileX].index;
                if (!tileForbidden[tileX][tileY] && incTower.gold().gte(cost) && tileIndex >= 5 && tileIndex <= 8) {
                    var opt = {};
                    opt.towerType = towerType;
                    opt.cost = cost;
                    Tower.prototype.posit(pointer,opt);
                    incrementObservable(incTower.gold,-cost);
                    if (!shiftKey.isDown) { incTower.clearCursor(); }
                }
            }));
        }
    },
    totalTowerDamage: ko.pureComputed(function () {
        'use strict';
        var tally = new BigNumber(0);
        var towerLength = incTower.numTowers();
        for (var i = 0;i < towerLength;++i) {
            var tower = towers.getAt(i);
            tally = tally.plus(tower.totalDamage());
        }
        return tally;
    }),
    averageDamage: ko.pureComputed(function () {
        'use strict';
        var tally = new BigNumber(0);
        var towerLength = incTower.numTowers();
        for (var i = 0;i < towerLength;++i) {
            var tower = towers.getAt(i);
            tally = tally.plus(tower.totalDamage());
        }
        return tally.div(incTower.numTowers());
    }),
    cheapestUpgradeCostTower: ko.pureComputed(function () {
        'use strict';
        var cheapest = -1;
        var retTower;
        var towerLength = incTower.numTowers();
        for (var i = 0;i < towerLength;++i) {
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
        var tower = incTower.cheapestUpgradeCostTower();
        if (tower) { return tower.upgradeCost(); }
        return 0;

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
incTower.secondsUntilQueueExhausted = ko.computed(function () {
    'use strict';
    if (this.skillQueue().length === 0) { return 0; }
    var tally = new BigNumber(0);
    _.forEach(this.skillQueue(), function (item) {
        var skill = item[0];
        var rank = item[1];
        if (incTower.haveSkill(skill) && incTower.getSkillLevel(skill) === rank - 1) {
            tally = tally.plus(this.skills.get(skill)().get('skillPointsCap')().minus(this.skills.get(skill)().get('skillPoints')()));
        } else {
            tally = tally.plus(costCalc(incTower.skillAttributes[skill].baseCost,rank,incTower.skillAttributes[skill].growth));
        }
    }, this);
    return tally;
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
        //Hide all tooltips in case we were looking at a boss power.
        $('.qtip').remove();
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
incTower.cursor.subscribe(function (oldValue) {
    if (oldValue !== false && oldValue.indicator) {
        oldValue.indicator.destroy();
    }
}, null, 'beforeChange');
incTower.skillTreeData = function () {
    'use strict';
    var data = [];
    function addSkillToData (skill, parent) {
        if (parent === undefined) { parent = "#"; }
        var maxLevel = incTower.skillAttributes[skill].maxLevel;
        if (maxLevel === undefined) { maxLevel = '&infin;'; }
        var currentLevel = '--';
        if (incTower.haveSkill(skill)) { currentLevel = incTower.getSkillLevel(skill); }
        var label = incTower.skillAttributes[skill].fullName + ' (' + currentLevel + ' / ' + maxLevel + ')';
        data.push({id: skill, parent: parent, text: label });
        if (incTower.skillAttributes[skill].grants !== undefined) {
            var origin = skill;
            _.map(incTower.possibleGrants(skill), function (skill) {
                addSkillToData(skill, origin);
            });
        }
    }
    _.map(incTower.startingSkills,function (skill) { addSkillToData(skill); });
    return data;
};




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
    incTower.pathDirty = false;
    var walkables = [30];
    pathfinder.setGrid(map.layers[0].data, walkables);

    pathfinder.setCallbackFunction(function(p) {
        if (p === null) {
            var block = incTower.blocks.pop();
            map.putTile(30,block.x,block.y,"Ground");
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
            var curTileCoord = enemy.path[enemy.curTile];
            var bestDist = -1;
            var bestIndex = -1;
            _.forEach(p,function (pathEntry, index) {
                var dist = Math.abs(pathEntry.x - curTileCoord.x) + Math.abs(pathEntry.y - curTileCoord.y);
                if (bestIndex < 0 || dist < bestDist) {
                    bestIndex = index;
                    bestDist = dist;
                }
            });

            enemy.path = p.slice(0); //Make a shallow copy of hte array
            enemy.curTile = bestIndex;
        });

    });

    pathfinder.preparePathCalculation([0,0], [24,18]);
    pathfinder.calculatePath();

}

_.forEach(incTower.startingSkills, function (skill) {
    if (!incTower.haveSkill(skill)) {
        incTower.gainSkill(skill);
    }
});
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
    if (number.abs() < thresh) { return number.toFixed(precision).replace('.0',''); }
    var u = -1;
    do {
        number = number.div(thresh);
        ++u;
    } while (number.abs().gte(thresh));
    return number.toFixed(precision).replace('.0','')+incTower.numSuffixes[u];

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

    shiftKey = game.input.keyboard.addKey(Phaser.Keyboard.SHIFT);
    pathfinder = game.plugins.add(Phaser.Plugin.PathFinderPlugin);
    recalcPath();
    game.input.addMoveCallback(function(pointer, x, y) {
        // pointer returns the active pointer, x and y return the position on the canvas
        if (!incTower.cursor()) { return; }
        //console.log(x + ", "+ y);
        var cursor = incTower.cursor();
        if (cursor.type === 'buy' || cursor.type === 'sell') {
            cursor.indicator.x = Math.floor(x / 32) * 32;
            cursor.indicator.y = Math.floor(y / 32) * 32;
        } else {
            cursor.indicator.x = x;
            cursor.indicator.y = y;
        }
    });
    // Keybinds
    qKey = game.input.keyboard.addKey(Phaser.Keyboard.Q);
    qKey.onDown.add(incTower.buyBlock, this);
    var towerKeys = [Phaser.Keyboard.W, Phaser.Keyboard.E, Phaser.Keyboard.R, Phaser.Keyboard.T, Phaser.Keyboard.Y, Phaser.Keyboard.U];

    _.forEach(towerKeys, function(towerKey, index) {
        var tempKey = game.input.keyboard.addKey(towerKey);
        tempKey.onDown.add(function () {
                var key = incTower.availableTowers()[index];
                if (key !== undefined) {
                    incTower.buyTower(key);
                }
            }, this);
    });
    var spellKeys = [Phaser.Keyboard.ONE, Phaser.Keyboard.TWO, Phaser.Keyboard.THREE, Phaser.Keyboard.FOUR, Phaser.Keyboard.FIVE, Phaser.Keyboard.SIX, Phaser.Keyboard.SEVEN, Phaser.Keyboard.EIGHT, Phaser.Keyboard.NINE, Phaser.Keyboard.ZERO];

    _.forEach(spellKeys, function(spellKey, index) {
        var tempKey = game.input.keyboard.addKey(spellKey);
        tempKey.onDown.add(function () {
            var key = incTower.availableSpells()[index];
            if (key !== undefined) {
                incTower.castSpell(key);
            }
        }, this);
    });

    sKey = game.input.keyboard.addKey(Phaser.Keyboard.S);
    sKey.onDown.add(incTower.sellTool, this);
    aKey = game.input.keyboard.addKey(Phaser.Keyboard.A);
    aKey.onDown.add(incTower.cheapestUpgradeAll, this);
    lKey = game.input.keyboard.addKey(Phaser.Keyboard.L);
    lKey.onDown.add(incTower.cheapestUpgrade, this);

    escKey = game.input.keyboard.addKey(Phaser.Keyboard.ESC);
    escKey.onDown.add(incTower.clearCursor, this);


    /*    key2 = game.input.keyboard.addKey(Phaser.Keyboard.TWO);
        key2.onDown.add(addPhaserLogo, this);

        key3 = game.input.keyboard.addKey(Phaser.Keyboard.THREE);
        key3.onDown.add(addPineapple, this);*/
    game.input.onDown.add(function (pointer) {
        if (!incTower.cursor()) { return; }
        incTower.cursor().action(pointer);
    });
    game.input.mouse.mouseOutCallback = function() {
        if (!incTower.cursor()) { return; }
        incTower.cursor().indicator.alpha = 0;
    };
    game.input.mouse.mouseOverCallback = function() {
        if (!incTower.cursor()) { return; }
        incTower.cursor().indicator.alpha = 1;
    };

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
        'cursor',
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
        'UIselectedSkill',
        'pathGraphic',
        'spellAttributes',
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
        '_frame',
        'alpha',
        'renderable',
        'visible',
        'worldAlpha',
        'worldRotation',
        'children',
        'rotation',
        'type',
        'physicsType',
    ];
    if (typeof obj !== 'object') { return obj; }
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
                        save[prop][i] = createSaveObj(obj[prop]()[i]) ;
                    }
                } else {
                    //Should be a big number if we get to ehre
                    if (obj[prop]().toJSON === undefined) { console.log(prop + " ERROR"); }
                    save[prop] = obj[prop]().trunc().toJSON();
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
                        skillPoints: value.get('skillPoints')().trunc().toJSON(),
                        skillPointsCap: value.get('skillPointsCap')().trunc().toJSON()
                    };
                }
                continue;
            }
            if (prop === 'seenPowers') {
                save[prop] = obj[prop];
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
    incTower.mana(BigNumber.min(incTower.maxMana(), incTower.mana().plus(incTower.manaRegeneration())));
    incTower.checkQueue();

    var skillName = incTower.activeSkill();
    var skill = incTower.skills.get(skillName)();
    if (skill !== null) {
        incrementObservable(skill.get('skillPoints'), incTower.skillRate());
        while (skill.get('skillPoints')().gte(skill.get('skillPointsCap')())) {
            skill.get('skillPoints')(skill.get('skillPoints')().sub(skill.get('skillPointsCap')()));
            incrementObservable(skill.get('skillLevel'));
            //console.log(incTower.activeSkill());
            skill.get('skillPointsCap')(costCalc(incTower.skillAttributes[incTower.activeSkill()].baseCost, skill.get('skillLevel')(), incTower.skillAttributes[incTower.activeSkill()].growth));

            incTower.skillQueue.shift();
            incTower.checkSkill(skillName);
            incTower.checkQueue();
        }
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
        _.mapValues(enemy.statusEffects, function (effect, effectName) {
            if (effect().gt(0)) {
                var reduction = 0.8;
                if (effectName === 'bleeding') {
                    reduction = 0.5 + (0.05 * incTower.getEffectiveSkillLevel('anticoagulants'));
                }
                effect(effect().times(reduction));
                if (effectName === 'burning') {
                    enemy.assignDamage(effect(),'fire');
                }
                if (effectName === 'bleeding') {
                    enemy.assignDamage(effect(),'bleed');
                }
                if (effect().lt(3)) {
                    effect(new BigNumber(0));
                    if (effectName === 'burning') {
                        enemy.burningSprite.visible = false;
                    }
                }
                if (effectName === 'chilled' && effect().lt(100) && enemy.speedX === 0 && enemy.speedY === 0) {
                    enemy.nextTile();
                }
            }
        });
        enemy.elementalRuneDiminishing = _.mapValues(enemy.elementalRuneDiminishing, function (dim) {
            if (dim < 0.5) { return 0; }
            return dim * 0.95;
        });
        var reaction = false;
        _.forEach(enemy.elementalRunes, function (rune) {
            if (game.rnd.integerInRange(0,100) < 10) {
                reaction = rune.runeType;
                return false;
            }
        });
        if (reaction) {
            var newElementalRunes = [];
            var eligibleToReact = {};
            eligibleToReact[reaction] = true;
            var reactionCounts = {};
            _.forEach(enemy.elementalRunes, function (rune) {
                var runeType = rune.runeType;
                if (runeType in eligibleToReact) {
                    if (!(runeType in reactionCounts)) { reactionCounts[runeType] = 0; }
                    reactionCounts[runeType]++;
                    rune.destroy();
                } else {
                    newElementalRunes.push(rune);
                }
            });
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
        if (incTower.pathDirty) { recalcPath(); }
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

    //So lame that I even need this check.
    if (incTower.currentlySelected() !== null && incTower.currentlySelected().enemy && !incTower.currentlySelected().alive) {
        incTower.currentlySelected(null);
    }
    bullets.forEachAlive(function (bullet) {
        var range = bullet.tower.trueRange();
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
    var adaptiveSkill = incTower.getEffectiveSkillLevel('adaptiveUpgrades');
    if (adaptiveSkill > 0) {
        incrementObservable(bullet.tower.remainingUpgradeCost, enemy.goldValue().times(0.001 * adaptiveSkill).neg());
    }
    if (towerType === 'kinetic') {
        if (game.rnd.frac() < (0.05 * incTower.getEffectiveSkillLevel('shrapnelAmmo'))) {
            incrementObservable(enemy.statusEffects.bleeding, damage);
        }
    }
    enemy.assignDamage(damage,towerType);
    if (towerType === 'fire' || towerType === 'water' || towerType === 'air' || towerType === 'earth') {
        var chance = 0.10; //10% base chance of applying a rune
        chance += (0.05 * incTower.getEffectiveSkillLevel(towerType + 'RuneApplication')); //increases by 5% per rank in the relevant skill
        chance -= (0.05 * enemy.elementalRuneDiminishing[towerType] || 0);
        chance -= (0.2 * (enemy[towerType + '-resistant'] || 0));
        if (game.rnd.frac() < chance) {
            enemy.addElementalRune(bullet.tower.towerType);
            if (game.rnd.frac() < (0.05 * incTower.getEffectiveSkillLevel(towerType + 'AdvancedRuneApplication'))) {
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
        new Enemy(offset, path[0].y * tileSquare + 16, packEntry);
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
