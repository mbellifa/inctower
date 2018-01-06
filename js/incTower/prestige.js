define(['incTower/core', 'lib/knockout', 'lib/bignumber', 'incTower/path', 'incTower/basic-actions'], function (incTower, ko, BigNumber, pathModule) {
    'use strict';
    //Stolen from http://lostsouls.org/grimoire_diminishing_returns
    function diminishingReturns(val, scale) {
        if(val < 0) {
            return -diminishingReturns(-val, scale);
        }
        var mult = val / scale;
        var trinum = (Math.sqrt(8.0 * mult + 1.0) - 1.0) / 2.0;
        return trinum * scale;
    }
    function prestigeDiminished(val) {
        return diminishingReturns(val, 100);
    }
    incTower.describePrestige  = function (points, next) {
            if (next) {
                return 'On your next prestige reset your prestige points will be increased by ' + points + ' which, combined with your current prestige points if any, will increase your learning rate by ' + incTower.humanizeNumber(prestigeDiminished(points + incTower.prestigePoints())) + '%. Potential points are earned by defeating bosses after wave 100.';
            }
            return 'Increases your skill learning rate by ' + incTower.humanizeNumber(prestigeDiminished(points)) + '%.';
        };
    incTower.prestigePoints = ko.observable(0);
    incTower.prestigePointsEffective = ko.pureComputed(function () {
       return prestigeDiminished(incTower.prestigePoints());
    });
    incTower.prestigePointsNext = ko.pureComputed(function () {
            var wave = incTower.wave();
            if (wave <= 100) {
                return 0;
            }
            var points = 1;
            var hundreds = Math.floor((wave - 1) / 100);
            wave -= 101;
            while (wave > 0) {
                points += Math.floor((wave / 25) + 1);
                wave -= 5;
            }
            points *= hundreds;
            return points;
        });
    incTower.prestigePointsNext.subscribe(function (newVal) {
       if (newVal > 0) {
           incTower.checkHelp('prestige');
       }
    });
    incTower.prestigeReset = function () {
            incTower.incrementObservable(incTower.prestigePoints, incTower.prestigePointsNext());
            incTower.gold(new BigNumber(150));
            incTower.wave(0);
            incTower.maxWave(0);
            incTower.spellLevel(new BigNumber(0));
            incTower.farmMode(false);
            incTower.skillPoints(new BigNumber(0));
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
            incTower.rawMaxMana(new BigNumber(0));
            incTower.mana(new BigNumber(0));
            incTower.currentlySelected(false);
            incTower.emptyObsArray(incTower.availableTowers);
            incTower.emptyObsArray(incTower.availableSpells);
            incTower.emptyObsArray(incTower.availableActions);
            incTower.availableTowers.push('kinetic');


            incTower.towers_group.forEach(function (tower) {
                if (tower.icon) {
                    tower.icon.destroy();
                }
                tower.kill();
            });
            incTower.towers_group.removeAll(true);
            pathModule.tileForbidden = pathModule.createCoordArray(false);
            _.forEach(incTower.blocks(), function (block) {
                pathModule.mutateTile(block.x, block.y);
            });
            incTower.blocks([{x: 13, y: 9}, {x: 9, y: 9}]);

            incTower.core.map.putTile(incTower.game.rnd.integerInRange(1, 4), 13, 9);
            incTower.core.map.putTile(incTower.game.rnd.integerInRange(1, 4), 9, 9);
            incTower.nukeEnemies();

            incTower.towers.removeAll(true);
            incTower.towers([]);
            incTower.selectedBossPack = false;
            _.mapValues(incTower.towerBlueprints, function (val) {
                val(new BigNumber(0));
            });
            //incTower.towerBlueprints = {};
            pathModule.recalcPath();


        };

});
