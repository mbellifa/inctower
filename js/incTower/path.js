define(['incTower/core', 'lib/EasyStar', 'lib/lodash'], function (incTower, EasyStar, _) {
    'use strict';
    var pathModule = {};
    pathModule.tileForbidden = new Array(25);
    for (var i = 0;i < 25;++i) {
        pathModule.tileForbidden[i] = new Array(19);
        for (var j = 0;j < 19;j++) {
            pathModule.tileForbidden[i][j] = false;
        }
    }
    pathModule.path = [{"x":0,"y":0},{"x":1,"y":0},{"x":2,"y":0},{"x":3,"y":0},{"x":4,"y":0},{"x":5,"y":0},{"x":6,"y":0},
        {"x":7,"y":0},{"x":7,"y":1},{"x":8,"y":1},{"x":9,"y":1},{"x":10,"y":1},{"x":11,"y":1},{"x":11,"y":2},
        {"x":11,"y":3},{"x":11,"y":4},{"x":12,"y":4},{"x":12,"y":5},{"x":12,"y":6},{"x":12,"y":7},{"x":12,"y":8},
        {"x":13,"y":8},{"x":13,"y":9},{"x":14,"y":9},{"x":15,"y":9},{"x":15,"y":10},{"x":16,"y":10},{"x":16,"y":11},
        {"x":17,"y":11},{"x":17,"y":12},{"x":17,"y":13},{"x":18,"y":13},{"x":18,"y":14},{"x":19,"y":14},
        {"x":20,"y":14},{"x":21,"y":14},{"x":21,"y":15},{"x":21,"y":16},{"x":22,"y":16},{"x":22,"y":17},
        {"x":23,"y":17},{"x":23,"y":18},{"x":24,"y":18},{"x":24,"y":19}];
    pathModule.flyingPath = [{"x":0,"y":0},{"x":1,"y":1},{"x":2,"y":2},{"x":3,"y":3},{"x":4,"y":4},{"x":5,"y":5},
        {"x":6,"y":6},{"x":7,"y":7},{"x":8,"y":8},{"x":9,"y":9},{"x":10,"y":10},{"x":11,"y":11},{"x":12,"y":12},
        {"x":13,"y":12},{"x":14,"y":13},{"x":15,"y":13},{"x":16,"y":13},{"x":17,"y":13},{"x":18,"y":13},{"x":19,"y":13},
        {"x":20,"y":14},{"x":21,"y":15},{"x":22,"y":16},{"x":22,"y":17},{"x":23,"y":18},{"x":24,"y":18}];
    pathModule.layerToGrid = function (layerNum) {
        var ret = [];
        var data = incTower.core.map.layers[layerNum].data;
        _.forEach(data, function(row) {
            ret.push(_.map(row, function (cell) { return cell.index; }));
        });
        return ret;
    };
    pathModule.recalcPath = function () {
        var walkables = [30];
        var map = incTower.core.map;
        var es = new EasyStar.js();

        es.setGrid(pathModule.layerToGrid(0));
        es.setAcceptableTiles( walkables);


        es.findPath(0,0,24,18,function (p) {
            if (p === null) {
                var block = incTower.blocks.pop();
                map.putTile(30, block.x, block.y, "Ground");
                incTower.incrementObservable(incTower.gold, incTower.blockCost());
                pathModule.recalcPath();
                return;
            }
            pathModule.path = p;
            if (incTower.pathGraphic !== undefined) {
                incTower.pathGraphic.destroy();
            }
            incTower.pathGraphic = incTower.game.add.graphics(0, 0);
            var colour = "0x80080";
            incTower.pathGraphic.beginFill(colour);
            incTower.pathGraphic.lineStyle(2, colour, 0.5);
            for (var i = 0; i < p.length - 1; i++) {
                incTower.pathGraphic.moveTo(p[i].x * 32 + 16, p[i].y * 32 + 16);
                incTower.pathGraphic.lineTo(p[i + 1].x * 32 + 16, p[i + 1].y * 32 + 16);
            }
            incTower.pathGraphic.endFill();
            incTower.game.world.bringToTop(incTower.enemys);
            incTower.enemys.forEachAlive(function (enemy) {
                if (enemy.flying) {
                    return;
                }
                var curTileCoord = enemy.path[enemy.curTile];
                var bestDist = -1;
                var bestIndex = -1;
                _.forEach(p, function (pathEntry, index) {
                    var dist = Math.abs(pathEntry.x - curTileCoord.x) + Math.abs(pathEntry.y - curTileCoord.y);
                    if (bestIndex < 0 || dist < bestDist) {
                        bestIndex = index;
                        bestDist = dist;
                    }
                });

                enemy.path = p.slice(0); //Make a shallow copy of hte array
                enemy.curTile = bestIndex;
            });
//            pathModule.recalcPathFlying();
        });
        es.calculate();
    };
    pathModule.calcProspectivePath = function (x,y, mode) { //Calculates what the new path would be with a block added at x,y
        var walkables = [30];
        var map = incTower.core.map;
        var es = new EasyStar.js();
        var grid = pathModule.layerToGrid(0);
        mode = mode || 'add'; //Mode is whether we are calculating as if we added or removed a block.
        if (mode === 'add') {
            grid[y][x] = 5;
        } else if (mode === 'subtract') {
            grid[y][x] = 30;
        }

        es.setGrid(grid);
        es.setAcceptableTiles( walkables);


        es.findPath(0,0,24,18,function (p) {
            if (p === null) {
                return;
            }

            if (incTower.pathProspectiveGraphic === undefined) {
                incTower.pathProspectiveGraphic = incTower.game.add.graphics(0, 0);
            }
            incTower.pathProspectiveGraphic.clear();
            var colour = "0xcc33ff";
            incTower.pathProspectiveGraphic.beginFill(colour);
            incTower.pathProspectiveGraphic.lineStyle(2, colour, 0.5);
            for (var i = 0; i < p.length - 1; i++) {
                incTower.pathProspectiveGraphic.moveTo(p[i].x * 32 + 16, p[i].y * 32 + 16);
                incTower.pathProspectiveGraphic.lineTo(p[i + 1].x * 32 + 16, p[i + 1].y * 32 + 16);
            }
            incTower.pathProspectiveGraphic.endFill();
            incTower.game.world.bringToTop(incTower.enemys);
        });
        es.calculate();
    };
    //Currently nothing blocks a flying creature so there is no point in calling this again.
    pathModule.recalcPathFlying = function () {
        var es = new EasyStar.js();
        var gridData = pathModule.layerToGrid(0);
        es.setGrid(gridData);
        es.enableDiagonals();
        es.setAcceptableTiles(_.uniq(_.flattenDeep(gridData)));


        es.findPath(0,0,24,18,function (p) {
            if (p === null) {
                console.log("Error couldn't find flying path");
                return;
            }
            pathModule.flyingPath = p;
            console.log(JSON.stringify(p));
        });
        es.calculate();
    };

    return pathModule;
});
