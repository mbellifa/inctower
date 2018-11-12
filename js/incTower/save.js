define(['incTower/core', 'lib/lodash', 'lib/knockout', 'incTower/path', 'lib/bignumber', 'lib/lz-string', 'incTower/blocks', 'incTower/skills', 'incTower/util', 'incTower/spells', 'incTower/towers', 'incTower/actions', 'incTower/help', 'incTower/prestige'], function (incTower, _, ko, path, BigNumber, lzString) {
    'use strict';
    var saveModule = {};
    saveModule.loadSave = function (save) {
        document.getElementById('b64_save').innerHTML = save;
        console.log("Loading save: " + save);
        var origSave = save;
        try {
            save = lzString.decompressFromBase64(save);
            if (save.length === 0) {
                throw "Invalid compressed save";
            }
            // console.log(save);
            save = JSON.parse(save);
        } catch (e) {
            try {
                save = origSave;
                console.log("Attempting to load base 64");
                save = atob(save);
                console.log(save);
                save = JSON.parse(save);
            } catch (e) {
                save = origSave;
                console.log("Loading plain JSON");
                console.log(save);
                save = JSON.parse(save);
            }
        }
        var i;
//        console.log(save);
        //save = JSON.parse(save);
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
                            incTower.addToObsArray(incTower[prop],save[prop][i]);
                            //incTower[prop].push(save[prop][i]);
                        }
                    } else if (_.isNumber(curVal) || _.isBoolean(curVal) || _.isString(curVal)) {
                        incTower[prop](save[prop]);
                    } else {
                        // console.log(prop);
                        // console.log(save[prop]);
                        // console.log(curVal);
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
                if (towerType === 'fire' || towerType === 'water' || towerType === 'earth' || towerType === 'air') {
                    towerType = 'elemental'; // All of the old elemental towers blueprint points get added into elementals
                }
                if (towerType === 'sensor') {
                    towerType = 'support';
                }

                if (!_.has(incTower.towerBlueprints, towerType)) {
                    incTower.towerBlueprints[towerType] = ko.observable(new BigNumber(0));
                }
                incTower.towerBlueprints[towerType](incTower.towerBlueprints[towerType]().plus(new BigNumber(blueprintPoints)));
            });
        }
        if ('blocks' in save) {
            _.forEach(incTower.blocks(), function (block) {

                path.mutateTile(block.x, block.y);
            });
            incTower.blocks([]);
            _.forEach(save.blocks, function (block) {
                incTower.core.map.putTile(incTower.game.rnd.integerInRange(1,4),block.x,block.y);
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
                //console.log(tower);
                var tileY = tower.tileY;
                var tileX = tower.tileX;
                //If our save contains old elemental towers we convert them to elemental towers of the same type
                if (tower.towerType === 'water' || tower.towerType === 'fire'  || tower.towerType === 'air'  || tower.towerType === 'earth') {
                    tower.ammoType = tower.towerType + 'Orb';
                    tower.towerType = 'elemental';
                }
                //If our save contains sensor towers convert them to support towers, we can't assume they actually have sensor towers so we just change type.
                if (tower.towerType === 'sensor') {
                    tower.towerType = 'support';
                }
                var index = incTower.core.map.layers[0].data[tileY][tileX].index;
                if (index >= 0 && index <= 4) {
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
            'pathDirty',
            'ignoreChildInput',
            '_exists',
            'shakeWorld'
        ];
        if (typeof obj !== 'object') { return obj; }
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                if (ko.isComputed(obj[prop])) { continue; }
                if (dontSave.indexOf(prop) > -1) { continue; }
                if (ko.isObservable(obj[prop])) {
                    var obsValue = obj[prop]();
                    //console.log("Currently on: " + prop);
                    if (_.isNumber(obsValue) || typeof obsValue === 'string' || typeof obsValue === 'boolean') {
                        save[prop] = obsValue;
                    } else if (_.isArray(obsValue)) {
                        save[prop] = [];
                        for (var i = 0;i < obsValue.length;i++) {
                            var newValue = saveModule.createSaveObj(obsValue[i]);
                            if (newValue) {
                                save[prop][i] = newValue;
                            }
                        }
                    } else {
                        //Should be a big number if we get to ehre
                        if (obsValue.toJSON === undefined) { console.log(prop + " ERROR"); }
                        save[prop] = obsValue.trunc().toJSON();
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
        if (Object.keys(save).length === 0 && save.constructor === Object) {
            return false;
        }
        return save;
    };
    saveModule.createPackagedSave = function (obj) { //If localStore is true it will rotate the localStorage
        var saveObj = JSON.stringify(saveModule.createSaveObj(obj));
        return lzString.compressToBase64(saveObj);
    };
    saveModule.lastSave = 0;
    saveModule.triggerSave = function () {
        saveModule.lastSave = Date.now();
        var saveData = saveModule.createPackagedSave(incTower);
        document.getElementById('b64_save').innerHTML = saveData;
        var prevSave = localStorage.getItem("save");
        if (prevSave) {
            localStorage.setItem("save2", prevSave);
        }
        localStorage.setItem("save",saveData);
    };

    return saveModule;
});
