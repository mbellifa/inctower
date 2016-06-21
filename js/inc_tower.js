/**
 * Created by Mo on 2/21/2015.
 */

//define(['phaser','bignumber'], function (Phaser, BigNumber) {






//Stolen from http://lostsouls.org/grimoire_diminishing_returns
/*    function diminishingReturns(val, scale) {
        'use strict';
        if (val < 0) {
            return -diminishingReturns(-val, scale);
        }
        var mult = val / scale;
        var trinum = (Math.sqrt(8.0 * mult + 1.0) - 1.0) / 2.0;
        return trinum * scale;
    }*/

    var game;

requirejs(['knockout', 'bignumber', 'moment'], function (ko, BigNumber, moment) {

    window.incTower = {





        

    };


    incTower.self = incTower;





});

requirejs(['bignumber', 'knockout'], function (BigNumber, ko) {

});




    










// function memoryReport(obj, visited, verbose) {
//     if (verbose === undefined) { verbose = true; }
//     if (visited === undefined) { visited = {}; }
//     if (!_.has(visited, obj)) {
//         visited[obj] = true;
//     }
//     var count = 1;
//     _.forEach(_.keys(obj), function (key) {
//         var val = obj[key];
//         count += 1;
//         var rescount = 0;
//         if (_.isObject(val)) {
//             if (_.has(visited, val)) {
//                 console.log("Key Visited: " + key );
//                 return;
//             }
//
//             try {
//                 if (_.isArray(val)) {
//                     rescount = val.length;
//                 } else {
//                     rescount = memoryReport(val, visited, false);
//                 }
//
//             }
//             catch (err) {
//                 rescount = 0;
//                 console.log("Error on key" + key);
//             }
//
//             //console.log(verbose);
//             if (verbose) {
//                 console.log("Key: " + key + " " + rescount);
//             }
//             count += rescount;
//         }
//     });
//     return count;
// }

/*    function memoryReport(obj, verbose, objName, visited, arrays) {
        if (verbose === undefined) { verbose = true; }
        if (visited === undefined) { visited = []; }
        if (arrays === undefined) { arrays = {}; }
        if (objName === undefined) { objName = 'root';  }

        if (!_.has(visited, obj)) {
            visited.push(obj);
        }
        var count = 1;
        _.forEach(_.keys(obj), function (key) {
            var val = obj[key];
            count += 1;
            var rescount = 0;
            // if (visited.indexOf(val) >= 0) {
            //     console.log("Visited Key: " + key);
            //     console.log(visited);
            //     console.log(val);
            // }
            if (_.isObject(val) && visited.indexOf(val) < 0) {
                try {
                    if (_.isArray(val)) {
                        arrays[objName + '.' + key] = val.length;
                        rescount = val.length;
                    } else {
                        rescount = memoryReport(val, false, objName + '.' + key, visited, arrays);
                    }

                }
                catch (err) {
                    rescount = 0;
                    console.log("Error on key" + key);
                }

                //console.log(verbose);
                if (verbose) {
                    console.log("Key: " + key + " " + rescount);
                }
                count += rescount;
            }
        });
        console.log(arrays);
        return count;
    }*/
//});
