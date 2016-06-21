define(['incTower/core', 'lib/knockout', 'lib/bignumber', 'incTower/path', 'incTower/basic-actions'], function (incTower, ko, BigNumber, pathModule) {
    'use strict';
    incTower.describePrestige  = function (points, next) {
            if (next) {
                return 'On your next prestige reset your prestige points will be increased by ' + points + ' which will increase your learning rate by ' + (points * 10) + '%. Potential points are earned by defeating bosses after wave 100.';
            }
            return 'Increases your skill learning rate by ' + (points * 10) + '%.';
        };
    incTower.prestigePoints = ko.observable(0);
    incTower.prestigePointsNext = ko.pureComputed(function () {
            var wave = incTower.wave();
            if (wave <= 100) {
                return 0;
            }
            var points = 1;
            wave--;
            while (wave >= 100) {
                points += Math.floor((wave / 25) + 1);
                wave -= 5;
            }
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
            incTower.spellLevel(new BigNumber(0));
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
            pathModule.tileForbidden = new Array(25);
            for (var i = 0; i < 25; ++i) {
                pathModule.tileForbidden[i] = new Array(19);
                for (var j = 0; j < 19; j++) {
                    pathModule.tileForbidden[i][j] = false;
                }
            }
            _.forEach(incTower.blocks(), function (block) {
                incTower.core.map.putTile(30, block.x, block.y, "Ground");
            });
            incTower.blocks([{x: 13, y: 9}]);
            incTower.core.map.putTile(incTower.game.rnd.integerInRange(5, 8), 13, 9, "Ground");
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
