define(['incTower/core', 'lib/knockout', 'lib/bignumber'], function (incTower, ko, BigNumber) {
    'use strict';
    incTower.availableHelp = ko.observableArray([]); //Stores help files that are available for viewing
    incTower.readHelp = ko.observableArray([]);  //Stores help files that have been read by
    incTower.selectedHelp = ko.observable('none');
    incTower.unreadHelps = ko.computed(function () {
        var unread = 0;
        ko.utils.arrayForEach(this.availableHelp(), function(topic) {
            if (incTower.readHelp.indexOf(topic) < 0) {
                unread++;
            }
        });
        return unread;
    }, incTower);
    incTower.selectedHelp.subscribe(function (value) {
        incTower.addToObsArray(incTower.readHelp, value);
    });
    incTower.checkHelp = function (topic) {
        if (incTower.availableHelp.indexOf(topic) < 0) {
            incTower.addToObsArray(incTower.availableHelp, topic);
        }
    };
    incTower.haveReadHelpTopic = function (topic) {
        if (incTower.readHelp.indexOf(topic) < 0) {
            return false;
        }
        return true;
    };

    incTower.helpTopics = {
        welcome: {
            title: "Welcome",
                body: "Welcome to Incremental Tower Defense. Your goal is to build towers and kill your enemies to progress to further waves. In the beginning you can build the following things: " +
            "<ul>" +
            "<li><b>Blocks</b>: Reroutes enemy movement and required for tower placement. The purple line shows the way in which most enemies will move toward the red zone.</li>" +
            "<li><b>Kinetic Towers</b>: Deals damage to enemies, upgrading these is the main way to progress through the game.</li>" +
            "</ul>"
        },
        regularEdge: {
            title: "Regular Enemies",
                body: "Every wave that isn't a multiple of five is filled with regular enemies, meaning they aren't bosses. " +
            "When regular enemies run off the edge they cycle back through your defenses. " +
            "Each time this is allowed to happen the monster loses 10% of its gold value."

        },
        bosses: {
            title: 'Bosses',
                body: "Bosses come every five waves. They distinguish themselves from regular enemies in two ways:" +
            "<ul>" +
            "<li>Bosses have one or more powers. You can see these powers by selecting the bosses. Hovering over the powers will describe what they do in more detail. Every 25 waves bosses gain more/stronger powers.</li>" +
            "<li>Unlike regular enemies if a boss reaches the end of your maze without dying you will not be allowed to proceed to the next wave.</li>" +
            "</ul>"
        },
        towerUpgrades: {
            title: 'Tower Upgrades',
                body: "<p>Upgrading a tower increases its damage by one point (before skills come into play). Every tenth level the damage is doubled instead.</p>" +
            "<p>Each tower has a red bar to the left of it, this shows the relative power of that tower versus others of its type. A full bar means that this tower has the highest damage of that type or is tied for the highest damage. A low bar may indicate that the tower needs to be upgraded, or that a skill has since increased the damage of other towers.</p>"
        },
        skills: {
            title: 'Skills',
                body: "Skills allow you to increase various aspects of your performance in the game, either increasing damage, allowing new types of buildings, or allowing you to cast magical spells. Some skills have no maximum rank, which means that they can be learned infinitely many times (although each instance will take longer than the last). Skills which have no maximum-rank double in effectiveness every twenty ranks."
        },
        prestige: {
            title: 'Prestige',
            body: '<p>Prestige allows you to restart your game after reaching wave 100 with a certain number of prestige points based on how many waves you have completed. Prestige points increase the amount of a skill you can learn each second by 10% per point (e.g. at 10 prestige points you receive 100% bonus which doubles your learning rate).</p>' +
            '<p>Prestige does not alter any other aspect of the game.</p>'
        }

    };

});
