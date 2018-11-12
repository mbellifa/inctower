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
            if (!incTower.UIselectedSkill()) {
                e.preventDefault();
                return;
            }
            var prereqs = incTower.skillGetPrereqs(incTower.UIselectedSkill());
            var index = prereqs.pairs.length;
            while (index > 0) {
                index--;
                var skill = prereqs.pairs[index][0];
                var level = prereqs.pairs[index][1];
                var currentLevel = incTower.getSkillLevel(skill);
                if (currentLevel < level) {
                    _.forEach(_.range(currentLevel, level), function (rank) {
                        var queueRank = incTower.directlyQueueable(skill);
                        if (queueRank && queueRank <= rank + 1) {
                            incTower.enqueueSkill(skill);
                        }
                    });
                }
            }
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
                var valid = incTower.checkPotentialQueue(potentialList);
                if (!valid) { return false; }
                incTower.skillQueue(potentialList);
            }
        });
        incTower.incTower = incTower;
//        console.log(incTower);
        ko.options.deferUpdates = true;

        ko.applyBindings(incTower);
    });
});
