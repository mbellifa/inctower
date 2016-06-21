define(['incTower/core', 'lib/knockout'], function (incTower, ko) {
    incTower.paused = ko.observable(false);
    incTower.resumeGame = function () {
        incTower.paused(false);
    };
    incTower.pauseGame = function () {
        incTower.paused(true);
    };

});
