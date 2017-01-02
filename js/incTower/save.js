define(['incTower/core', 'lib/lodash', 'lib/knockout', 'incTower/path', 'lib/bignumber', 'incTower/blocks', 'incTower/skills', 'incTower/util', 'incTower/spells', 'incTower/towers', 'incTower/actions', 'incTower/help', 'incTower/prestige'], function (incTower, _, ko, path, BigNumber) {
    'use strict';
    var saveModule = {};
    saveModule.loadSave = function (save) {
        var savehex = btoa(save);
        document.getElementById('b64_save').innerHTML = savehex;
        console.log("Loading save: " + savehex);
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
                if (prop === 'towerBlueprints') {
                    continue;
                }
                if (ko.isComputed(incTower[prop])) { continue; }
                if (ko.isObservable(incTower[prop])) {
                    var curVal = incTower[prop]();
                    if (_.isArray(curVal)) {
                        incTower[prop]([]);
                        for (i = 0;i < save[prop].length;i++) {
                            incTower.addToObsArray(incTower[prop],save[prop][i])
                            //incTower[prop].push(save[prop][i]);
                        }
                    } else if (_.isNumber(curVal) || _.isBoolean(curVal) || _.isString(curVal)) {
                        incTower[prop](save[prop]);
                    } else {
                        console.log(prop);
                        console.log(save[prop]);
                        console.log(curVal);
                        //should be a big number if we're getting here.
                        incTower[prop](new BigNumber(save[prop]));
                    }
                    continue;
                }
                incTower[prop] = save[prop];

            }
        }
        if ('towerBlueprints' in save) {
            _.mapValues(save.towerBlueprints, function(blueprintPoints, towerType) {
                if (!_.has(incTower.towerBlueprints, towerType)) {
                    incTower.towerBlueprints[towerType] = ko.observable(new BigNumber(0));
                }
                incTower.towerBlueprints[towerType](new BigNumber(blueprintPoints));
            });
        }
        if ('blocks' in save) {
            _.forEach(incTower.blocks(), function (block) {
                incTower.core.map.putTile(30,block.x,block.y,"Ground");
            });
            incTower.blocks([]);
            _.forEach(save.blocks, function (block) {
                incTower.core.map.putTile(incTower.game.rnd.integerInRange(5,8),block.x,block.y,"Ground");
                incTower.blocks.push({x:block.x, y: block.y});
            });
            path.recalcPath();
        }
        if ('skills' in save) {
            //We have an observable dict
            _.mapValues(save.skills, function (skillAttribs, skillName) {
                incTower.gainSkill(skillName, skillAttribs);
            });
            incTower.checkSkills();
        }
        if ('towers' in save) {
            _.forEach(incTower.towers(), function (tower) {
                incTower.destroyTower(tower, false);
            });
            incTower.towers([]);

            _.forEach(save.towers, function (tower) {
                var tileY = tower.tileY;
                var tileX = tower.tileX;
                var index = incTower.core.map.layers[0].data[tileY][tileX].index;
                if (index >= 5 && index <= 8) {
                    incTower.createTower(tower);
                } else {
                    incTower.incrementObservable(incTower.gold,tower.goldSpent);
                }
            });
        }
    };
    saveModule.createSaveObj = function (obj) {
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
            'enemyTypes',
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
            'towerMaxDamage',
            'buffs',
            'disabledFrames',
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
            'autoUpgrade',
            'pathDirty'
        ];
        if (typeof obj !== 'object') { return obj; }
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                if (ko.isComputed(obj[prop])) { continue; }
                if (dontSave.indexOf(prop) > -1) { continue; }
                if (ko.isObservable(obj[prop])) {
                    //console.log("Currently on: " + prop);
                    if (_.isNumber(obj[prop]()) || typeof obj[prop]() === 'string' || typeof obj[prop]() === 'boolean') {
                        save[prop] = obj[prop]();
                    } else if (_.isArray(obj[prop]())) {
                        save[prop] = [];
                        for (var i = 0;i < obj[prop]().length;i++) {
                            save[prop][i] = saveModule.createSaveObj(obj[prop]()[i]) ;
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
                if (prop === 'towerBlueprints') {
                    save[prop] = saveModule.createSaveObj(obj[prop]);
                }
                if (typeof(obj[prop]) === 'object' && !_.isArray(obj[prop])) { continue; }
                if (typeof(obj[prop]) === 'function') { continue; }

                save[prop] = obj[prop];
            }
        }
        return save;
    };

    return saveModule;
});
