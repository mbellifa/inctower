define(['incTower/core', 'lib/knockout', 'incTower/save'], function (incTower, ko, saveModule) {
    'use strict';
    incTower.currentlySelected = ko.observable(null);
    incTower.currentlySelected.subscribe(function (value) {
        if (value === null) {
            //Hide all tooltips in case we were looking at a boss power.
            incTower.checkTooltips();
            incTower.currentlySelectedIndicator.destroy();
            incTower.currentlySelectedIndicator = null;
            return;
        }
        if (incTower.currentlySelectedIndicator === null) {
            incTower.currentlySelectedIndicator = incTower.game.add.graphics(0,0);
            incTower.currentlySelectedIndicator.lineStyle(2, 0x66cc00, 3);
            incTower.currentlySelectedIndicator.drawCircle(0,0,40);
        }
        incTower.currentlySelectedIndicator.x = value.x; //+ (tileSquare / 2);
        incTower.currentlySelectedIndicator.y = value.y; //+ (tileSquare / 2);
    });

    incTower.currentlySelectedIndicator = null; //Holds the graphic we'll use to show what we have selected.
    incTower.farmMode = ko.observable(false);
    incTower.masterVolume = ko.observable("5");
    incTower.sfxVolume = ko.observable("5");
    incTower.musicVolume = ko.observable("3");
    incTower.backgroundSound = ko.observable(false);

    //Play a sound when we change this to know what we set it to.
    incTower.sfxVolume.subscribe(function (newVolume) {
        incTower.playSoundEffect('positive');
    });
    //Adjust the music volume on change
    incTower.musicVolume.subscribe(function (newVolume) {
        if (incTower.core.sounds.currentMusicObj) {
            incTower.core.sounds.currentMusicObj.volume = parseInt(newVolume) * 0.1;
        }
    });

    incTower.masterVolume.subscribe(function (newVolume) {
            incTower.game.sound.volume = parseInt(newVolume) * 0.1;
    });


    incTower.prevWave = function () {
        //We subtract 2 because once the enemies are gone it will increment the wave by one.
        var waveAmount = -2;
        if (incTower.farmMode()) {
            waveAmount = -1;
        }
        incTower.incrementObservable(incTower.wave, waveAmount);
        incTower.nukeEnemies();
    };
    incTower.toMaxWave = function () {
        var wave = incTower.maxWave();
        if (!incTower.farmMode()) {
            wave--;
        }

        incTower.wave(wave);
        incTower.nukeEnemies();
    };
    incTower.showReddit = function () {
        var win = window.open('http://incTower.reddit.com/', '_blank');
    };
    incTower.showChangelog = function () {
        $('#changelog').dialog({
            width: 600,
            height: 500
        });
    };
    incTower.showHelp = function () {
        $('#help').dialog({
            width: 600,
            height: 500
        });
    };
    incTower.showSkills = function () {
        incTower.checkSkills();
        $('#skills').dialog({
            width: 800,
            height: 500
        });
    };
    incTower.showCredits = function () {
        $('#credits').dialog({
            width: 500,
            height: 500
        });
    };
    incTower.showOptions = function () {
        $('#options').dialog({
            width: 500,
            height: 500,
            close: function( event, ui ) {
                saveModule.triggerSave();
            }
        });
    };
    incTower.showSaves = function () {
        $('#save').dialog({
            width: 500,
            height: 500,
            buttons: {
                Ok: function () {
                    $(this).dialog("close");
                },
                Load: function () {
                    var save;
                    try {
                        save = $('#b64_load').val();
                        saveModule.loadSave(save);
                    } catch (e) {
                        incTower.okDialog({
                            title: "Save Game",
                            message: "There was an issue with your save game. It cannot be loaded."
                        });
                        console.log(e);
                        console.trace();
                    }
                }
            }
        });

    };


    incTower.towerIconCSS = function (tower) {
        return 'url(img/towers/' + tower + '.png)';
    };
    incTower.spellIconCSS = function (spell) {
        return 'url(img/spells/' + spell + '.png)';
    };
    incTower.actionIconCSS = function (action) {
        return 'url(img/actions/' + action + '.png)';
    };

    incTower.tooltipUpgradeLeast = function () {
        return 'Upgrade the tower with the lowest upgrade-cast. Currently the cost to do this is ' + incTower.humanizeNumber(incTower.cheapestUpgradeCost()) + 'g';
    };
    incTower.towerKeybindLetter = function (i) {
        // Towers start at w because blocks are Q
        return ['W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O'][i];
    };
    incTower.spellKeybindLetter = function (i) {
        // Towers start at w because blocks are Q
        return ['1', '2', '3', '4', '5', '6', '7', '8', '9'][i];
    };
    incTower.goldPerWave = function (wave) {
        return incTower.costCalc(30, wave, 1.2).times(1 + (0.01 * incTower.getEffectiveSkillLevel('marketConnections')));
    };

//    console.log(incTower);
});