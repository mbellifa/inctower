define(['incTower/core', 'lib/EasyStar', 'lib/lodash', 'lib/csp'], function (incTower, EasyStar, _, csp) {
    'use strict';
    var pathModule = {};

    pathModule.createCoordArray = function (fillVal) { // Creates an array that's 25x18 filled with fillval
        var arr = new Array(25);
        for (var i = 0; i < 25; ++i) {
            arr[i] = new Array(19);
            for (var j = 0; j < 19; j++) {
                arr[i][j] = fillVal;
            }
        }
        return arr;
    };

    pathModule.tileForbidden = pathModule.createCoordArray(false);
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
    pathModule.allCoords = [];
    for (var x = 0; x < 25; x++) {
        for (var y = 0; y < 19; y++) {
            pathModule.allCoords.push([x,y]);
        }
    }
    pathModule.tileAge = pathModule.createCoordArray(0);
    pathModule.allCoords = _.shuffle(pathModule.allCoords); // This is used as a list of which coords to mutate so it covers the whole map evenly
    pathModule.layerToGrid = function (layerNum) {
        var ret = [];
        var data = incTower.core.map.layers[layerNum].data;
        _.forEach(data, function(row) {
            ret.push(_.map(row, function (cell) { return cell.index; }));
        });
        return ret;
    };
    var desertTiles = [36, 37, 46, 48, 59, 101, 102];
    var grassTiles = [16, 17, 21, 22, 79];
    pathModule.desertRules = {
        n: _.concat(desertTiles, [27, 52, 53]),
        s: _.concat(desertTiles, [50, 40, 41]),
        e: _.concat(desertTiles, [39, 40, 52]),
        w: _.concat(desertTiles, [38, 41, 53])
    };
    pathModule.grassRules = {
        n: _.concat(grassTiles, [49, 51, 50]),
        s: _.concat(grassTiles, [26, 27, 28]),
        e: _.concat(grassTiles, [49, 38, 26]),
        w: _.concat(grassTiles, [51, 39, 28])
    };
    pathModule.tileRules = {
        1: { block: true },
        2: { block: true },
        3: { block: true },
        4: { block: true },
        /* Transition from desert to grass */
        26: {
            w: pathModule.grassRules.w,
            n: pathModule.grassRules.n,
            e: [27, 28, 53],
            s: [38, 49, 53]
        },
        27: {
            n: pathModule.grassRules.n,
            w: [26, 52, 27],
            e: [28, 53, 27],
            s: pathModule.desertRules.s
        },
        28: {
           n: pathModule.grassRules.n,
           e: pathModule.grassRules.e,
           s: [39, 51, 52],
           w: [27, 26, 52]
        },
        38: {
            n: [26, 41, 38],
            w: pathModule.grassRules.w,
            e: pathModule.desertRules.e,
            s: [49, 53, 38]
        },
        39: {
            n: [28, 40, 39],
            w: pathModule.desertRules.w,
            e: pathModule.grassRules.e,
            s: [51, 52, 39]
        },
        40: {
            n: pathModule.desertRules.n,
            w: pathModule.desertRules.w,
            e: [50, 41, 51],
            s: [39, 52, 51]

        },
        41: {
            n: pathModule.desertRules.n,
            w: [50, 40, 49],
            e: pathModule.desertRules.e,
            s: [38, 51, 53, 49]
        },
        49: {
            n: [38, 26, 41],
            e: [51, 41, 50],
            s: pathModule.grassRules.s,
            w: pathModule.grassRules.w
        },
        50: {
            n: pathModule.desertRules.n,
            e: [51, 41, 50],
            s: pathModule.grassRules.s,
            w: [49, 40, 50]
        },
        51: {
            n: [39, 28, 40, 41],
            s: pathModule.grassRules.s,
            w: [50, 49, 40],
            e: pathModule.grassRules.e
        },
        52: {
            n: [39, 40, 28],
            s: pathModule.desertRules.s,
            e: [27, 53, 28],
            w: pathModule.desertRules.w
        },
        53: {
            n: [38, 41, 26],
            s: pathModule.desertRules.s,
            e: pathModule.desertRules.e,
            w: [27, 52, 26]
        }



    };
    pathModule.lastMutate = 0;
    // Set each desert tile as allowable next to another and connecting tiles

    _.forEach(desertTiles, function(tileNum) {
       pathModule.tileRules[tileNum] = pathModule.desertRules;
    });
    // Set each grass tile as allowable next to another
    _.forEach(grassTiles, function(tileNum) {
        pathModule.tileRules[tileNum] = pathModule.grassRules;
    });
    pathModule.walkables = [];


    pathModule.coreTiles = _.concat(desertTiles, grassTiles);
    pathModule.blockTiles = [1, 2, 3, 4];
    pathModule.getTileIndex = function (x, y) {
        return incTower.core.map.layers[0].data[y][x].index;
    };
    pathModule.getTileNeighbor = function (x, y, dir) {
        var testX = x;
        var testY = y;
        if (dir === 'w' || dir === 'nw' || dir === 'sw') { testX--; }
        if (dir === 'n' || dir === 'nw' || dir === 'ne') { testY--; }
        if (dir === 'e' || dir === 'ne' || dir === 'se') { testX++; }
        if (dir === 's' || dir === 'sw' || dir === 'se') { testY++; }
        if (!pathModule.validCoord(testX, testY)) { return false; }
        return [testX, testY];

    };
    pathModule.getAcceptableTiles = function (x, y, dir) {
        var tileIndex = incTower.core.map.layers[0].data[y][x].index;
        return pathModule.getAcceptableTilesFromIndex(tileIndex, dir);
    };
    pathModule.acceptableTilesCache = {};
    pathModule.getAcceptableTilesFromIndex = function (tileIndex, dir) {
        if (!pathModule.acceptableTilesCache[tileIndex]) {
            pathModule.acceptableTilesCache[tileIndex] = {};
        }
        if (pathModule.acceptableTilesCache[tileIndex][dir]) {
            return pathModule.acceptableTilesCache[tileIndex][dir];
        }
        var tileRules = pathModule.tileRules[tileIndex];
        var testRules = [];
        if (tileRules[dir]) { testRules = tileRules[dir]; }
        if (tileRules.block) { testRules = pathModule.walkables; }
        var result =  _.sortBy(_.concat(testRules, [1, 2, 3, 4]));
        pathModule.acceptableTilesCache[tileIndex][dir] = result;
        return result;
    };
    pathModule.reverseDir = function (dir) {
        if (dir === 'n') { return 's'; }
        if (dir === 's') { return 'n'; }
        if (dir === 'w') { return 'e'; }
        if (dir === 'e') { return 'w'; }
        if (dir === 'ne') { return 'sw'; }
        if (dir === 'nw') { return 'se'; }
        if (dir === 'se') { return 'nw'; }
        if (dir === 'sw') { return 'ne'; }
    };
    pathModule.testedTiles = [];
    pathModule.validCoord = function (x, y) {
        if (x < 0 || x > 24) { return false; }
        if (y < 0 || y > 18) { return false; }
        return true;
    };
    pathModule.mutateNextTile = function () {
        pathModule.lastMutate = Date.now();
        var first = pathModule.allCoords.shift();
        var x = first[0];
        var y = first[1];
        pathModule.allCoords.push(first);
        if (incTower.core.map.layers[0].data[y][x].index > 4) { pathModule.mutateTile(x,y); }
    };
    pathModule.isBlock = function (x, y) {
        var index = pathModule.getTileIndex(x, y);
        return index > 0 && index < 5;
    };
    pathModule.coordToNum = function (x, y) {
        return y * 20 + x;
    };

    _.forOwn(pathModule.tileRules, function (rules, index) {
        if (!rules.block) {
            pathModule.walkables.push(parseInt(index));
        }
        //Test for reverse connectedness
        _.forEach(['n','s','e','w'], function (dir) {
            var reverseDir = pathModule.reverseDir(dir);

            _.forEach(rules[dir] || [], function (otherIndex) {
                var result = _.includes(pathModule.tileRules[otherIndex][reverseDir] || [], parseInt(index));
                if (!result) {
                    console.log("Error: " + index + " " + dir + " " + otherIndex);
                }
            });
        });
    });
    pathModule.uniqWalkables = _.clone(pathModule.walkables);
    pathModule.uniqWalkables = _.pullAll(pathModule.uniqWalkables, _.slice(grassTiles, 1));
    pathModule.uniqWalkables = _.pullAll(pathModule.uniqWalkables, _.slice(desertTiles, 1));


    pathModule.mutateTile = function (x, y, radius) {
        var placeIndex = _.sample(pathModule.walkables);
        incTower.core.map.putTile(placeIndex, x, y); // Go ahead and place the tile in question in case we are trying to replace a block.
        var puzzleObj = {};
        var variables = {};
        var northConstraint = function (core, other) {
            return _.sortedIndexOf(pathModule.getAcceptableTilesFromIndex(core, 'n'), other) > 0;
        };
        var eastConstraint = function (core, other) {
            return _.sortedIndexOf(pathModule.getAcceptableTilesFromIndex(core, 'e'), other) > 0;
        };
        var southConstraint = function (core, other) {
            return _.sortedIndexOf(pathModule.getAcceptableTilesFromIndex(core, 's'), other) > 0;
        };
        var westConstraint = function (core, other) {
            return _.sortedIndexOf(pathModule.getAcceptableTilesFromIndex(core, 'w'), other) > 0;
        };
        radius = radius || 3;
        var simpleDist = function (x, y, i, j) {
            return Math.abs(i-x) + Math.abs(j-y);
        };

        //return;
        function includedVal(i, j) {
            return simpleDist(x, y, i, j) <= radius && !pathModule.isBlock(i, j);
        }
        var constraints = [];
        for (var i = 0; i < 25; ++i) {
            for (var j = 0; j < 19; j++) {
                if (simpleDist(x, y, i, j) > radius) {
                    continue;
                }
                if (pathModule.isBlock(i,j)) { //If we're a block we don't need to add a variable and we don't need to add any constraints
                    continue;

                }
                if (i === x && j === y) {
                    if (radius > 7) { //If our radius is getting large and we're nto finding results then we'll relax the core index
                        variables[[i, j]] = _.clone(pathModule.uniqWalkables);
                    } else {
                        variables[[i, j]] = [placeIndex];
                    }

                } else if (pathModule.isBlock(i,j)) {
                    variables[[i, j]] = [pathModule.getTileIndex(i, j)];
                } else if (simpleDist(x,y,i,j) === radius) {
                    variables[[i, j]] = [pathModule.getTileIndex(i, j)];
                } else {
                    variables[[i, j]] = _.clone(pathModule.uniqWalkables);
                }
                //Directional constraints
                //North:
                if (j > 0 && includedVal(i, j-1)) {
                    constraints.push([[i, j], [i, j-1], northConstraint]);
                }
                // East:
                if (i < 24  && includedVal(i+1, j)) {
                    constraints.push([[i, j], [i+1, j], eastConstraint]);
                }
                // South:
                if (j < 18 && includedVal(i, j+1)) {
                    constraints.push([[i, j], [i, j+1], southConstraint]);
                }
                //West:
                if (i > 0 && includedVal(i-1, j)) {
                    constraints.push([[i, j], [i-1, j], westConstraint]);
                }
            }
        }
        puzzleObj.variables = variables;
        puzzleObj.constraints = constraints;
        // console.log(puzzleObj.variables);
        // console.log(puzzleObj.constraints);
/*        puzzleObj.cb = function (assigned, unassigned) {
            console.log("Radius: " + radius + " x: " + x + " y: " + y);
            console.log("Assigned: ");
            console.log(assigned);
            console.log("UnAssigned: ");
            console.log(unassigned);
        }*/
        var result = csp.solve(puzzleObj);

        //console.log("Radius: " + radius + " x: " + x + " y: " + y + " " + (endTime - start));

        if (result === 'FAILURE') {
            if (radius > 20) {
                console.log("FAIL: " + " x: " + x + " y: " + y);
                return {};
            }
            return pathModule.mutateTile(x, y, radius + 1);
        }

        //console.log(result);
        _.forOwn(result, function (tile, coords) {
            coords = coords.split(',');
            if (tile === grassTiles[0]) { tile = _.sample(grassTiles); }
            if (tile === desertTiles[0]) { tile = _.sample(desertTiles); }
            incTower.core.map.putTile(tile, parseInt(coords[0]), parseInt(coords[1]));

        });
        return result;


    };


    pathModule.recalcPath = function () {
        var walkables = pathModule.walkables;
        var map = incTower.core.map;
        var es = new EasyStar.js();

        es.setGrid(pathModule.layerToGrid(0));
        es.setAcceptableTiles( walkables);


        es.findPath(0,0,24,18,function (p) {
            if (p === null) {
                var block = incTower.blocks.pop();
                pathModule.mutateTile(block.x, block.y);
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
        var walkables = pathModule.walkables;
        var map = incTower.core.map;
        var es = new EasyStar.js();
        var grid = pathModule.layerToGrid(0);
        mode = mode || 'add'; //Mode is whether we are calculating as if we added or removed a block.
        if (mode === 'add') {
            grid[y][x] = 4;
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
