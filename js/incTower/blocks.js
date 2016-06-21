define(['incTower/core', 'lib/knockout', 'incTower/util'], function (incTower, ko, util) {
    'use strict';
    incTower.numBlocks = ko.pureComputed(function () {
        return incTower.blocks().length;
    });
    incTower.blocks = ko.observableArray([{x: 13, y: 9}]);
    incTower.blockCost = function () {
        return util.costCalc(1, incTower.numBlocks(), 1.1);
    };
    //Used to get the cost of the last block we purchased
    incTower.prevBlockCost = function () {
        return util.costCalc(1, Math.max(0, incTower.numBlocks() - 1), 1.1);
    };

});
