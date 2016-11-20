define(['incTower/core', 'lib/bignumber', 'lib/lodash'], function (incTower, BigNumber, _) {
    'use strict';
    var utilModule = {};
    incTower.numSuffixes = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', //Directly stolen from Swarm Simulator
        'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'ODc', 'NDc',
        'Vi', 'UVi', 'DVi', 'TVi', 'QaVi', 'QiVi', 'SxVi', 'SpVi', 'OVi', 'NVi',
        'Tg', 'UTg', 'DTg', 'TTg', 'QaTg', 'QiTg', 'SxTg', 'SpTg', 'OTg', 'NTg',
        'Qd', 'UQd', 'DQd', 'TQd', 'QaQd', 'QiQd', 'SxQd', 'SpQd', 'OQd', 'NQd',
        'Qq', 'UQq', 'DQq', 'TQq', 'QaQq', 'QiQq', 'SxQq', 'SpQq', 'OQq', 'NQq',
        'Sg', 'USg', 'DSg', 'TSg', 'QaSg', 'QiSg', 'SxSg', 'SpSg', 'OSg', 'NSg',
        'St', 'USt', 'DSt', 'TSt', 'QaSt', 'QiSt', 'SxSt', 'SpSt', 'OSt', 'NSt',
        'Og', 'UOg', 'DOg', 'TOg', 'QaOg', 'QiOg', 'SxOg', 'SpOg', 'OOg', 'NOg'
    ];
    incTower.humanizeBigNumber = function (number, precision) {
        if (precision === undefined) { precision = 1;}
        if (typeof(number.abs) !== 'function') { number = new BigNumber(number); }
        if (number.e < 4) { return number.toFixed(precision).replace('.0',''); }
        var index = Math.floor(number.e / 3) - 1;
        number = number.div(new BigNumber(10).pow((index+1)*3));
        return number.toFixed(precision).replace('.0','')+incTower.numSuffixes[index];
    };
    utilModule.humanizeBigNumber = incTower.humanizeBigNumber;

    incTower.humanizeNumber = function (number, precision) {
        'use strict';
        if (precision === undefined) { precision = 1;}
        if (!_.isNumber(number)) { return incTower.humanizeBigNumber(number,precision); }
        var thresh = 1000;
        //number = 3;
        if (Math.abs(number) < thresh) { return parseFloat(number.toFixed(precision)); }
        var u = -1;
        do {
            number /= thresh;
            ++u;
        } while(Math.abs(number) >= thresh);
        return parseFloat(number.toFixed(precision))+incTower.numSuffixes[u];
    };
    utilModule.humanizeNumber = incTower.humanizeNumber;
    incTower.costCalc = function (base,number,growth) {
        return new BigNumber(growth).pow(number).times(base);
        //return base * Math.pow(growth,number) | 0;
    };
    utilModule.costCalc = incTower.costCalc;

    incTower.addToObsArray = function (arr, value) {
        //Adds a value to an observable array (or regular array) if it doesn't already exist.
        if (arr.indexOf(value) < 0) { arr.push(value); }
    };
    utilModule.addToObsArray = incTower.addToObsArray;
    incTower.emptyObsArray = function (arr) {
        while (arr().length > 0) {
            arr.shift();
        }
    };
    utilModule.emptyObsArray = incTower.emptyObsArray;
    incTower.incrementObservable = function (observable,amount) {
        'use strict';
        if (amount === undefined) {
            amount = 1;
        }
        var currentObs = observable();
        if (_.isNumber(currentObs)) {
            observable(currentObs + amount);
        } else { //Should be a big number object in this case


            /*console.log(incrementObservable.caller);*/
            if (typeof currentObs.add === 'undefined') {
                console.trace();
                console.log(currentObs);
            }
            observable(currentObs.add(amount));
        }

    };
    utilModule.incrementObservable = incTower.incrementObservable;
    incTower.okDialog = function (opts) {
        $('<div>' + opts.message + '</div>').dialog({
            modal: true,
            width: 600,
            buttons: {
                Ok: function () {
                    $(this).dialog("close");
                }
            },
            title: opts.title
        });
    };
    utilModule.okDialog = incTower.okDialog;
    incTower.prettyCommaList = function (arr) {
        if (arr.length === 1) {
            return arr[0];
        }
        if (arr.length === 2) {
            return arr[0] + ' and ' + arr[1];
        }
        return (arr.slice(0,arr.length - 1).join(', ')) + ', and ' + arr[arr.length - 1];
    };
    utilModule.prettyCommaList = incTower.prettyCommaList;
    incTower.shuffle = function (o){ //Shuffles an array
        for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
        return o;
    };
    utilModule.shuffle = incTower.shuffle;
    incTower.floatingTexts = [];
    incTower.createFloatingText = function (opt) {
        if (opt === undefined) {
            opt = {};
        }
        var text;
        var unusedIndex;
        for (var i = 0; i < incTower.floatingTexts.length; ++i) {
            if (incTower.floatingTexts[i].alpha === 0) {
                unusedIndex = i;
                break;
            }
        }
        var x, y;
        if ('x' in opt) {
            x = opt.x;
        }
        if ('y' in opt) {
            y = opt.y;
        }


        if (unusedIndex === undefined) {
            incTower.floatingTexts.push(incTower.game.add.text(0, 0, "", {
                font: "14px Arial",
                stroke: 'white',
                strokeThickness: 1,
                fontWeight: "bold",
                fill: "#ff0033",
                align: "center"
            }));
            incTower.floatingTexts[incTower.floatingTexts.length - 1].anchor.set(0.5);
            unusedIndex = incTower.floatingTexts.length - 1;
        }
        var floatText = incTower.floatingTexts[unusedIndex];
        var amount = new BigNumber(0);
        if ('amount' in opt) {
            amount = new BigNumber(opt.amount);
        }
        if (opt.around !== undefined) {
            x = opt.around.x;
            y = opt.around.y;
            if (opt.around.floatText === undefined) {
                opt.around.floatText = {};
            }
            if (opt.around.floatText[opt.type] !== undefined && opt.around.floatText[opt.type].alpha > 0.7) {
                floatText = opt.around.floatText[opt.type];
                if (floatText.amount !== undefined) {
                    amount = amount.add(floatText.amount);
                }
            } else {
                opt.around.floatText[opt.type] = floatText;
            }
            opt.around.floatText[opt.type].amount = amount;
        }
        if ('text' in opt) {
            text = opt.text;
        } else {
            text = incTower.humanizeNumber(amount);
            if (amount > 0) {
                text = "+" + text;
            }
        }
        var scatter = opt.scatter || 0;
        if (scatter > 0) {
            floatText.x = incTower.game.rnd.integerInRange(x - scatter, x + scatter);
            floatText.y = incTower.game.rnd.integerInRange(y - scatter, y + scatter);
        } else {
            floatText.x = x;
            floatText.y = y;
        }
        var color = opt.color || "#ff0033";
        var duration = opt.duration || 1000;

        var tweenTo = {alpha: 0};
        if (opt.noFloat !== true) {
            tweenTo.y = floatText.y - 30;
        }
        floatText.fill = color;
        floatText.font = opt.font || "Arial";
        floatText.fontSize = opt.fontSize || "14px";
        floatText.strokeThickness = opt.strokeThickness || 1;
        floatText.setShadow();
        if (opt.shadowed) {
            floatText.setShadow(3, 3);
        }
        floatText.stroke = opt.stroke || "white";
        floatText.alpha = 1;
        floatText.text = text;
        var delay = opt.delay || 0;
        
        var floatTween = incTower.game.add.tween(floatText).to(tweenTo, duration, "Linear", true, delay);
        floatTween.onComplete.add(function () {
            this.amount = undefined;
            //incTower.game.tweens.removeFrom(floatText);
        }, floatText);
    };
    incTower.rgbToHex = function (r, g, b) {
        return "0x" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    };
    return utilModule;
});
