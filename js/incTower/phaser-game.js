//Module that creates the core incTower object with an instance of Phaser.
define(['incTower/core', 'lib/phaser', 'lib/lodash', 'incTower/path', 'incTower/keybinds-cursors', 'incTower/save', 'lib/knockout', 'incTower/everysecond', 'incTower/help', 'incTower/util', 'incTower/enemies'], function (incTower, Phaser, _, path, keybinds, saveManager, ko) {
    'use strict';
    var incrementObservable = incTower.incrementObservable;
    incTower.shakeWorld = 0;
    incTower.core.sounds = {};
    incTower.core.sounds.music = {};
    incTower.core.sounds.musicList = ko.observableArray(incTower.shuffle([
        'Ove Melaa - Dark.ogg',
        'Ove Melaa - Earth Is All We Have.ogg',
        'Ove Melaa - Heaven Sings.mp3',
        'Ove Melaa - High Stakes, Low Chances.mp3',
        'Ove Melaa - Theme Crystalized.mp3',
        'cynicmusic - Crystal Cave.mp3',
        'cynicmusic - Battle Theme A.mp3',
        'yd - Observing The Star.ogg',
        'Alexandr Zhelanov - Mystical Theme.mp3',
        'Alexandr Zhelanov - Heroic Minority.mp3',
        'HorrorPen - Winds Of Stories.ogg',
        'HorrorPen - No More Magic.mp3',
        'Joth - Cyberpunk Moonlight Sonata.mp3',
        'Bensound - Sci-Fi.mp3',
        'Nico Maximilian - We\'re Leaving Now.mp3'
    ]));
    incTower.core.sounds.currentMusic = ko.pureComputed(function () {
        if (incTower.core.sounds.musicList().length === 0) {
            return false;
        }
        return incTower.core.sounds.musicList()[0];
    });
    incTower.currentMusic = incTower.core.sounds.currentMusic;
    incTower.core.sounds.nextMusic = ko.pureComputed(function () {
        if (incTower.core.sounds.musicList().length === 0) {
            return false;
        }
        return incTower.core.sounds.musicList()[1];
    });
    function collisionHandler(bullet, enemy) {

        bullet.target = undefined;
        if (!bullet.alive) { return; }
        var firingTower = bullet.tower;
        bullet.tower = undefined;
        bullet.kill();
        var frame = bullet._frame.name;
        if (!(frame in incTower.deadBullets)) { incTower.deadBullets[frame] = []; }
        incTower.deadBullets[frame].push(bullet);
        if (bullet.ammoType !== false) {
            incTower.ammoAttributes[bullet.ammoType].collision(firingTower, bullet, enemy);
        } else {
            enemy.assignDamage(bullet.damage, firingTower.towerType);
        }
        var adaptiveSkill = incTower.getEffectiveSkillLevel('adaptiveUpgrades');
        if (adaptiveSkill > 0) {
            incrementObservable(firingTower.remainingUpgradeCost, enemy.goldValue().times(0.001 * adaptiveSkill).neg());
        }
    }

    function preload() {
        incTower.game.load.tilemap('tower-defense-tiles', 'assets/maps/tower-defense2.json', null, Phaser.Tilemap.TILED_JSON);
        incTower.game.load.atlas('incTower', 'assets/sprites/main.png', 'assets/sprites/main.json');
        incTower.game.load.image('tower-defense-tiles', 'assets/maps/tower-defense-tiles.png');
        incTower.game.load.audio('positive', 'assets/audio/sound-effects/positive.ogg');
    }
    incTower.convergeUpdate = function () {
        var lastRealTime = incTower.lastUpdateRealTime;
        incTower.updateRealTime();
        var ticks = ((incTower.lastUpdateRealTime - lastRealTime) / 16) | 0;
        var baseTime = incTower.game.time.now;
        for (var i = 0;i < ticks;i++) {
            incTower.game.update(baseTime + 16 * i);
        }
    };
    incTower.updateRealTime = function () {
        if (performance !== undefined) {
            incTower.lastUpdateRealTime = performance.now();
        } else {
            incTower.lastUpdateRealTime = Date.now();
        }
    };
    function create() {
        keybinds.setInputHandlers(incTower.game);

        incTower.updateRealTime();
        incTower.game.physics.startSystem(Phaser.Physics.ARCADE);
        incTower.game.stage.disableVisibilityChange = true;
        incTower.core.map = incTower.game.add.tilemap('tower-defense-tiles');
        incTower.core.map.addTilesetImage('tower-defense-tiles', 'tower-defense-tiles');
        incTower.core.sounds.effects = {
            positive: incTower.game.add.audio('positive')
        };
        incTower.core.layer = incTower.core.map.createLayer('Ground');
        incTower.core.layer.resizeWorld();
        path.recalcPath();
        incTower.towers_group = incTower.game.add.group();
        incTower.bullets = incTower.game.add.group();
        incTower.enemys = incTower.game.add.group();

        if (true || Worker === undefined) {
            setInterval(function () {
                incTower.convergeUpdate();
            },1000);
        } else { //TODO: Fully remove this.
            var worker = new Worker('incTower-Worker.js');
            worker.postMessage({'cmd':'start'});
            worker.addEventListener('message', function(e) {
                if (e.data === "update") {
                    console.log("RECEIVED UPDATE EVENT");
                    incTower.convergeUpdate();
                }
            }, false);
        }
        var save = localStorage.getItem("save");
        if (save !== null) {
            setTimeout(function () {saveManager.loadSave(save);}, 100);
        }

        //We need a load function here for this to really make sense
        incTower.checkHelp('welcome');
        this.time.events.loop(Phaser.Timer.SECOND, incTower.everySecond, this);
        //this.add.plugin(Phaser.Plugin.Debug);
        var startZone = incTower.game.add.graphics(0,0);
        var colour = "0x00FF00";
        var tileSquare = 32;
        startZone.beginFill(colour);
        startZone.lineStyle(5, colour, 1);
        startZone.lineTo(0, tileSquare);
        startZone.moveTo(0, 0);
        startZone.lineTo(tileSquare, 0);
        startZone.endFill();

        var endZone = incTower.game.add.graphics(800,608);
        colour = "0xFF0000";
        endZone.beginFill(colour);
        endZone.lineStyle(5, colour, 1);
        endZone.lineTo(0, -tileSquare);
        endZone.moveTo(0, 0);
        endZone.lineTo(-tileSquare, 0);
        endZone.endFill();
        incTower.game.world.bringToTop(endZone);

    }
    function update() {
        var currentTime = incTower.game.time.now;
        incTower.updateRealTime();

        if ((!incTower.generatingEnemies) && (incTower.enemys.countLiving() === 0)) {
            if (incTower.wave() > 0) {
                //Save state
                saveManager.triggerSave();

            }
            incTower.nukeEnemies();
            if (incTower.wave() > 0 && incTower.wave() % 5 === 0) {
                incTower.checkHelp('bosses');
            }
            if (!incTower.farmMode()) {
                incrementObservable(incTower.wave);
            }

            //generateEnemy(Math.pow(incTower.wave * 5,1.35));
            incTower.generateEnemy(incTower.costCalc(5,incTower.wave(),1.2));
        }

        //So lame that I even need this check. This is to make sure the indicator is not on a dead enemy.
        if (incTower.currentlySelected() !== null && incTower.currentlySelected().enemy && !incTower.currentlySelected().alive) {
            incTower.currentlySelected(null);
        }
        //Check to see if we're auto upgrading
        if (incTower.autoUpgrade === true) {
            for (var i = 0;i < 20;i++) {
                if (incTower.autoUpgrade === false) { break; }
                var cheapestTower = incTower.cheapestUpgradeCostTower();
                if (cheapestTower !== undefined && cheapestTower.upgradeCost().lte(incTower.gold())) {
                    cheapestTower.payToUpgrade();
                } else {
                    incTower.autoUpgrade = false;
                }
            }
        }
        if (incTower.shakeWorld > 0) {
            if (incTower.game.rnd.frac() > 0.5) {
                var rand1 = incTower.game.rnd.integerInRange(-5,5);
                var rand2 = incTower.game.rnd.integerInRange(-5,5);
                incTower.game.world.setBounds(rand1, rand2, incTower.game.width + rand1, incTower.game.height + rand2);
            }
            incTower.shakeWorld--;
            if (incTower.shakeWorld === 0) {
                incTower.game.world.setBounds(0, 0, incTower.game.width, incTower.game.height);
            }
        }
        incTower.bullets.forEachAlive(function (bullet) {
            var range = bullet.tower.trueRange();
            var timeSinceFired = incTower.game.time.now - bullet.fired;
            //The default speed is hardcoded at 300px/s, or 300px/1000ms we can use this ratio to see if we've gone past our range.
            if (timeSinceFired > ((range + 25) * 3.333)) { // Equivalent to (range / 300) * 1000
                bullet.target = undefined;
                bullet.tower = undefined;
                bullet.kill();
                var frame = bullet._frame.name;
                if (!(frame in incTower.deadBullets)) { incTower.deadBullets[frame] = []; }
                incTower.deadBullets[frame].push(bullet);
                return;
            }
            //console.log(bullet.target);
            if (bullet.target.alive) {
                incTower.game.physics.arcade.moveToObject(bullet, bullet.target, 300);
            }

        });
        if (incTower.currentlySelectedIndicator !== null) {
            var selected = incTower.currentlySelected();
            incTower.currentlySelectedIndicator.x = selected.x;
            incTower.currentlySelectedIndicator.y = selected.y;
        }

        incTower.game.physics.arcade.overlap(incTower.bullets, incTower.enemys, collisionHandler, null, this);
    }

    var mode = Phaser.AUTO;
    if (navigator.userAgent.match(/Trident.*rv\:11\./) || navigator.userAgent.indexOf("Edge/") > -1 || navigator.userAgent.indexOf("MSIE ") > -1) {
        mode = Phaser.CANVAS; // IE has a memory leak with WebGL for some reason so we force it to use Canvas in this case.
    }
    incTower.game = new Phaser.Game(800, 608, mode, 'gameContainer', {preload: preload, create: create, update: update}, false, false);
    document.addEventListener("visibilitychange", function() {
        if (document.hidden && !incTower.backgroundSound()) {
            incTower.core.sounds.currentMusicObj.volume = 0;
        } else {
            incTower.core.sounds.currentMusicObj.volume = parseInt(incTower.musicVolume()) * 0.1;
        }
        // Modify behavior...
    });
    incTower.playSoundEffect = function (sound) {
        if (!incTower.core.sounds) { return; }
        var volume = parseInt(incTower.sfxVolume()) * 0.1;
        if (document.hidden && !incTower.backgroundSound()) {
            return;
        }
        if (volume === 0) { return; }
        incTower.core.sounds.effects[sound].volume = volume;
        incTower.core.sounds.effects[sound].play();
    };
    incTower.checkMusic = function () {
        if (document.hidden && !incTower.backgroundSound()) {
            return;
        }
        if (incTower.core.sounds.currentMusicObj && incTower.core.sounds.currentMusicObj.isPlaying) {
            return;
        }
        if (incTower.core.sounds.currentMusicObj && incTower.core.sounds.currentMusicObj.isDecoding) {
            return;
        }
        if (!incTower.musicVolume) { return; }
        if (incTower.core.sounds.currentMusicObj && incTower.core.sounds.currentMusicObj.key === incTower.core.sounds.currentMusic()) {
            incTower.core.sounds.currentMusicObj.play();
        }

        if (incTower.game.load.hasLoaded) {
            if (!incTower.game.cache.checkSoundKey(incTower.core.sounds.currentMusic())) {
                incTower.game.load.audio(incTower.core.sounds.currentMusic(), 'assets/audio/music/' + incTower.core.sounds.currentMusic());
            } else if (!incTower.core.sounds.currentMusicObj || !incTower.core.sounds.currentMusicObj.isPlaying || incTower.core.sounds.currentMusicObj.key !== incTower.core.sounds.currentMusic()) {
                //console.log("Adding music " + incTower.core.sounds.currentMusic());
                incTower.core.sounds.currentMusicObj = incTower.game.add.audio(incTower.core.sounds.currentMusic());

                incTower.core.sounds.currentMusicObj.volume = parseInt(incTower.musicVolume()) * 0.1;
                incTower.core.sounds.currentMusicObj.onStop.add(function () {
                    //Take the first item off hte list and put it at the end
                    incTower.core.sounds.musicList.push(incTower.core.sounds.musicList.shift());

                    // incTower.core.sounds.currentMusicObj.onStop.dispose();
                    // incTower.core.sounds.currentMusicObj.destroy();

                    incTower.checkMusic();
                });
                if (!incTower.core.sounds.currentMusicObj.isDecoding) {
                    incTower.core.sounds.currentMusicObj.play();
                }

            }
            if (!incTower.game.cache.checkSoundKey(incTower.core.sounds.nextMusic())) {
                incTower.game.load.audio(incTower.core.sounds.nextMusic(), 'assets/audio/music/' + incTower.core.sounds.nextMusic());
            }
            incTower.game.load.start();
            incTower.game.load.onLoadComplete.add(incTower.checkMusic);
        }



    };
    return incTower;

});
