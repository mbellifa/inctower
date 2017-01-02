requirejs.config({
    shim: {
        'lib/phaser': {
            deps: [],
            exports: 'Phaser'
        },
        'lib/lodash': {
            deps: [],
            exports: '_'
        },
        'lib/knockout': {
            deps: [],
            exports: 'ko'
        },
        // 'lib/ko.observableDictionary': {
        //     deps: ['knockout']
        //   //  exports: 'ko.observableDictionary'
        // },
        'lib/jquery': {
            deps: [],
            exports: 'jQuery'
        },
        'lib/bignumber': {
            deps: [],
            //exports: 'BigNumber'
        },
        'lib/moment': {
            deps: [],
            exports: 'moment'
        },
        // 'lib/EasyStar': {
        //     deps: [],
        //     exports: 'EasyStar'
        // },
//         'lib/PathFinderPlugin': {
//             deps: ['EasyStar'],
// //            exports: 'Phaser.Plugin.PathFinderPlugin'
//         },
        'lib/jquery-ui': {
            deps: ['lib/jquery']
        },
        'lib/jstree': {
            deps: ['lib/jquery']
        },
    }
});

requirejs(["incTower/core", 'lib/jquery', 'lib/bignumber', 'lib/knockout', 'incTower/tooltips', 'lib/jquery-ui', 'incTower/actions', 'incTower/basic-actions', 'incTower/blocks', 'incTower/cursor', 'incTower/enemies', 'incTower/help', 'incTower/keybinds-cursors', 'incTower/prestige', 'incTower/save', 'incTower/skills', 'incTower/spells', 'incTower/towers', 'incTower/ui', 'incTower/phaser-game', 'incTower/wave'],
    function(incTower, $, BigNumber, ko, tooltips) {
    $(document).ready(function () {
        'use strict';
        BigNumber.config({ ERRORS: false });
        tooltips.init();

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
                check_callback: true,
                'themes': {
                    'name': 'proton',
                    'responsive': true
                }
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
        incTower.incTower = incTower;
        console.log(incTower);
        ko.applyBindings(incTower);
    });
});
