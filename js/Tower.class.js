function TowerInputOver(sprite,pointer) {
    'use strict';
    if (incTower.rangeIndicator !== undefined) {
        return;
    }
    incTower.rangeIndicator = game.add.graphics(0,0);
    incTower.rangeIndicator.x = sprite.x; //+ (tileSquare / 2);
    incTower.rangeIndicator.y = sprite.y; //+ (tileSquare / 2);

    incTower.rangeIndicator.beginFill(0xFF0000,0.3);
    incTower.rangeIndicator.lineStyle(1,0x000000,2);
    incTower.rangeIndicator.drawCircle(0,0,(sprite.range * 2) - 32);


}
function TowerInputOut(sprite,pointer) {
    if (incTower.rangeIndicator !== undefined) {
        incTower.rangeIndicator.destroy();
        incTower.rangeIndicator = undefined;

    }

}
function UpgradeTower(tower) {
    incrementObservable(tower.level);
    if (tower.level() % 10 === 0) {
        incrementObservable(tower.damage,tower.damage());
        if (!incTower.dialogTowerUpgradeDouble) {
            incTower.dialogTowerUpgradeDouble = true;
            vex.dialog.alert({
                message: "Each time you upgrade a tower to a level that's a multiple of ten, its damage doubles.",
                overlayClosesOnClick: false
            });
        }
    } else {
        incrementObservable(tower.damage,incTower.towerAttributes[tower.towerType].damagePerLevel);
    }


    tower.fireTime *= 0.99;
    tower.range += 2;
    TowerInputDown(tower);
}
function SellTower(tower) {
    incrementObservable(incTower.gold,tower.goldSpent().times(incTower.sellTowerPer()));
    incrementObservable(incTower.numTowers,-1);
    var index = incTower.towers.indexOf(tower);
    if (index >= 0) { incTower.towers.splice(index, 1); }

    tileForbidden[tower.tileX][tower.tileY] = false;
    tower.destroy();
    if (tower.icon) {
        tower.icon.destroy();
    }
    incTower.currentlySelected(null);
}
function PayToUpgradeTower(tower) {
    if (tower === null) { return; }
    var cost = tower.upgradeCost();
    if (incTower.gold().gte(cost)) {
        incrementObservable(tower.goldSpent,cost);
        incrementObservable(incTower.gold, new BigNumber(-1).times(cost));
        UpgradeTower(tower);
    }

}
function TowerInputDown(sprite,pointer) {
    console.log("TOWER CLICKED");
    incTower.currentlySelected(sprite);
}
Tower = function(opt) {
    if (opt === undefined) {
        opt = {};
    }
    var worldX = opt.worldX;
    var worldY = opt.worldY;
    var tileX = opt.tileX;
    var tileY = opt.tileY;
    var tile = opt.tile;

    if (!tileForbidden[tileX][tileY]) {
        Phaser.Sprite.call(this, game, worldX+tileSquare/2, worldY+tileSquare/2, 'incTower', 'Tower-32.png');

        //this.tower = game.add.sprite(worldX+tileSquare/2, worldY+tileSquare/2, 'incTower', 'Tower-32.png');
        this.towerType = opt.towerType;
        if ('icon' in incTower.towerAttributes[this.towerType]) {
             this.icon = game.add.sprite(worldX+tileSquare/2, worldY+tileSquare/2, 'incTower', incTower.towerAttributes[this.towerType].icon);
        }
        this.goldSpent = ko.observable(new BigNumber(opt.goldSpent || opt.cost || 0));
        this.worldX = worldX;
        this.worldY = worldY;
        this.tileX = tileX;
        this.tileY = tileY;
        this.tower = true;

        this.totalDamage = ko.pureComputed(function () {

            var ret = this.damage();
            if (this.towerType === 'kinetic') {
                ret = ret.times(1 + 0.01 * incTower.getSkillLevel('kineticTowers'));
            }
            //console.log(this.towerType);
            return ret;
        },this);
        this.anchor.setTo(0.5,0.5);
        this.tile = tile;
        var defaultDamage = 1 * Math.pow(10, incTower.getSkillLevel('towerTemplates'));

        defaultDamage *= 1 + 0.01 * incTower.getSkillLevel('initialEngineering');
        defaultDamage *= 1 + 0.01 * incTower.getSkillLevel('refinedBlueprints');
        this.damage = ko.observable(new BigNumber(opt.damage || defaultDamage));
        this.level = ko.observable(opt.level || 1);
        var defaultFireRate = 2000;
        if ('startingFireRate' in incTower.towerAttributes[this.towerType]) {
            defaultFireRate = incTower.towerAttributes[this.towerType].startingFireRate;
        }
        defaultFireRate *= 1 - 0.01 * incTower.getSkillLevel('initialEngineering');
        this.fireTime = opt.fireTime || defaultFireRate;
        var defaultRange = 100;
        defaultRange *= 1 + 0.01 * incTower.getSkillLevel('initialEngineering');
        this.range = opt.range || defaultRange;

        this.inputEnabled = true;
        this.events.onInputOver.add(TowerInputOver,this);
        this.events.onInputOut.add(TowerInputOut,this);
        this.events.onInputDown.add(TowerInputDown,this);
        this.fireLastTime = game.time.now + this.fireTime;
        towers.add(this);
        incTower.towers.push(this);
        tileForbidden[tileX][tileY] = true;
        incrementObservable(incTower.numTowers);
    }
};
Tower.prototype = Object.create(Phaser.Sprite.prototype);
Tower.prototype.constructor = Tower;
Tower.prototype.add = function(pointer) {
    game.input.onDown.add(Tower.prototype.posit, this);
};
Tower.prototype.upgradeCost = function () {
    'use strict';
    var amount = costCalc(incTower.towerAttributes[this.towerType].baseCost,this.level(),1.2);
    amount = amount.times(1 - (incTower.getSkillLevel('construction') * 0.01));
    amount = amount.times(1 - (incTower.getSkillLevel('modularConstruction') * 0.01));
    return amount;
},

Tower.prototype.posit = function(pointer,opt) {
    opt.worldX = pointer.worldX - (pointer.worldX % tileSquare);
    opt.worldY = pointer.worldY - (pointer.worldY % tileSquare);
    opt.tileX = Math.floor(pointer.worldX / tileSquare);
    opt.tileY = Math.floor(pointer.worldY / tileSquare);
    opt.tile = 'tower';
    //towers.add();
    new Tower(opt);
};
Tower.prototype.update = function () {
    this.fire();
};

Tower.prototype.fire = function() {
    'use strict';
    if (game.time.now > this.fireLastTime) {
        var enemiesInRange = [];
        for (var i = 0;i < enemys.children.length;i++) {
            if (!enemys.children[i].alive) { continue; }
            //
            //var dx = (enemys.children[i].x + 16) - (tower.x + 16);
            //var dy = (enemys.children[i].y + 16) - (tower.y + 16);
            if (enemys.children[i].x < 0 || enemys.children[i].y < 0) { continue; }
            if (game.physics.arcade.distanceBetween(enemys.children[i],this) < this.range) {
                enemiesInRange.push(enemys.children[i]);
            }
        }
        if (enemiesInRange.length > 0) {
            var chosenEnemy = enemiesInRange[(Math.random()*enemiesInRange.length) | 0];
            var sprite = 'bullet.png';
            //if (this.towerType === 'science') {
            //    sprite = 'blue-bullet.png';
            //}
            //var bullet = bullets.getFirstDead();
            if (!(sprite in incTower.deadBullets)) { incTower.deadBullets[sprite] = []; }
            var bullet = incTower.deadBullets[sprite].shift();
            if (bullet !== undefined) {
                bullet.revive();
                bullet.reset(this.x,this.y);
            } else {
                bullet = bullets.create(this.x,this.y, 'incTower', sprite, true);
                game.physics.enable(bullet, Phaser.Physics.ARCADE);
            }
            bullet.damage = this.totalDamage();
            bullet.tower = this;
            bullet.target = chosenEnemy;
            //bullet.rotation = parseFloat(game.physics.arcade.angleToXY(bullet, enemys.children[i].x, enemys.children[i].y)) * 180 / Math.PI;
            this.fireLastTime = game.time.now + this.fireTime;
            game.physics.arcade.moveToObject(bullet, chosenEnemy, 300);
            bullet.fired = game.time.now;
        }
    }
};
