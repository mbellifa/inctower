//Module that creates the core incTower object with an instance of Phaser.
define(['incTower/core', 'lib/phaser', 'lib/lodash', 'incTower/path', 'incTower/keybinds-cursors', 'incTower/save', 'incTower/everysecond', 'incTower/help', 'incTower/util', 'incTower/enemies'], function (incTower, Phaser, _, path, keybinds, saveManager) {
    'use strict';
    var incrementObservable = incTower.incrementObservable;
    incTower.shakeWorld = 0;
    function collisionHandler(bullet, enemy) {

        bullet.target = undefined;
        if (!bullet.alive) { return; }
        var firingTower = bullet.tower;
        bullet.tower = undefined;
        bullet.kill();
        var frame = bullet._frame.name;
        if (!(frame in incTower.deadBullets)) { incTower.deadBullets[frame] = []; }
        incTower.deadBullets[frame].push(bullet);
        var damage = bullet.damage;
        if (bullet.ammoType === 'shrapnel') { // Shrapnel rounds cause half the damge up front and automatically cause half of the remaining damage as bleeding.
            damage = damage.times(0.5);
            incrementObservable(enemy.statusEffects.bleeding, damage.times(0.5));
        }

        var towerType = firingTower.towerType;

        var adaptiveSkill = incTower.getEffectiveSkillLevel('adaptiveUpgrades');
        if (adaptiveSkill > 0) {
            incrementObservable(firingTower.remainingUpgradeCost, enemy.goldValue().times(0.001 * adaptiveSkill).neg());
        }
        enemy.assignDamage(damage,towerType);
        if (towerType === 'fire' || towerType === 'water' || towerType === 'air' || towerType === 'earth') {
            var chance = 0.10; //10% base chance of applying a rune
            chance += (0.05 * incTower.getEffectiveSkillLevel(towerType + 'RuneApplication')); //increases by 5% per rank in the relevant skill
            var runesAdded = enemy.addElementalRunesDiminishing(firingTower.towerType, chance);
            if (runesAdded > 0) {
                enemy.addElementalRunesDiminishing(firingTower.towerType,0.05 * incTower.getEffectiveSkillLevel(towerType + 'AdvancedRuneApplication'));
            }
        }





    }

    function preload() {
        incTower.game.load.tilemap('desert', 'assets/maps/tower-defense.json', null, Phaser.Tilemap.TILED_JSON);
        incTower.game.load.atlas('incTower', 'assets/sprites/main.png', 'assets/sprites/main.json');
        incTower.game.load.image('tiles', 'assets/maps/tmw_desert_spacing.png');
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
        incTower.core.map = incTower.game.add.tilemap('desert');
        incTower.core.map.addTilesetImage('Desert', 'tiles');

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
            saveManager.loadSave(save);
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

                var saveData = JSON.stringify(saveManager.createSaveObj(incTower));
                document.getElementById('b64_save').innerHTML = btoa(saveData);
                localStorage.setItem("save",saveData);
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
    return incTower;

});
