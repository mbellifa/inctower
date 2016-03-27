function TowerInputOver(sprite,pointer) {
    'use strict';
    if (incTower.rangeIndicator !== undefined) {
        return;
    }
    if (incTower.cursor()) {
        return;
    }
    incTower.rangeIndicator = game.add.graphics(0,0);
    incTower.rangeIndicator.x = sprite.x; //+ (tileSquare / 2);
    incTower.rangeIndicator.y = sprite.y; //+ (tileSquare / 2);

    incTower.rangeIndicator.beginFill(0xFF0000,0.3);
    incTower.rangeIndicator.lineStyle(1,0x000000,2);
    incTower.rangeIndicator.drawCircle(0,0,(sprite.trueRange() * 2) - 32);


}
function TowerInputOut(sprite,pointer) {
    if (incTower.rangeIndicator !== undefined) {
        incTower.rangeIndicator.destroy();
        incTower.rangeIndicator = undefined;

    }

}
function UpgradeTower(tower) {
    tower.upgrade();
}
function DestroyTower(tower, updateArray) {
    if (updateArray === undefined) { updateArray = true; }
    if (updateArray) {
        var index = incTower.towers.indexOf(tower);
        if (index >= 0) { incTower.towers.splice(index, 1); }
    }

    tileForbidden[tower.tileX][tower.tileY] = false;
    if (tower.icon) {
        tower.icon.destroy();
    }
    tower.destroy();

    incTower.currentlySelected(null);
}
function SellTower(tower) {
    incrementObservable(incTower.gold,tower.goldSpent().times(incTower.sellTowerPer()));
    DestroyTower(tower);

}
function PayToUpgradeTower(tower) {
    if (tower === null) { return; }
    var cost = tower.upgradeCost();
    if (incTower.gold().gte(cost)) {
        incrementObservable(tower.goldSpent,cost);
        incrementObservable(incTower.gold, new BigNumber(-1).times(cost));
        tower.upgrade();
    }
}
function TowerInputDown(sprite,pointer) {
    if (incTower.cursor() !== false) {
        return false;
    }
    console.log("TOWER CLICKED");
    incTower.currentlySelected(sprite);
}
function calculateTowerUpgradeCost(towerType, level) {
    var amount = costCalc(incTower.towerAttributes[towerType].baseCost,level,1.2);
    amount = amount.times(1 - (incTower.getEffectiveSkillLevel('construction') * 0.01));
    amount = amount.times(1 - (incTower.getEffectiveSkillLevel('modularConstruction') * 0.05));
    return amount;
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
                ret = ret.times(1 + 0.05 * incTower.getEffectiveSkillLevel('kineticTowers'));
                ret = ret.times(1 + 0.05 * incTower.getEffectiveSkillLevel('kineticAmmo'));
            }
            //ret = ret.times(1 + 0.1 * incTower.prestigePoints());
            //console.log(this.towerType);
            return ret;
        },this);

        this.anchor.setTo(0.5,0.5);
        this.tile = tile;
        var defaultDamage = 5 * Math.pow(10, incTower.getEffectiveSkillLevel('towerTemplates'));

        defaultDamage *= 1 + 0.05 * incTower.getEffectiveSkillLevel('initialEngineering');
        defaultDamage *= 1 + 0.05 * incTower.getEffectiveSkillLevel('refinedBlueprints');
        this.damage = ko.observable(new BigNumber(opt.damage || defaultDamage));
        this.level = ko.observable(opt.level || 1);
        var defaultFireRate = 2000;
        if ('startingFireRate' in incTower.towerAttributes[this.towerType]) {
            defaultFireRate = incTower.towerAttributes[this.towerType].startingFireRate;
        }
        defaultFireRate *= 1 - 0.05 * incTower.getEffectiveSkillLevel('initialEngineering');
        this.fireTime = opt.fireTime || defaultFireRate;
        var defaultRange = 150;
        if ('startingRange' in incTower.towerAttributes[this.towerType]) {
            defaultRange = incTower.towerAttributes[this.towerType].startingRange;
        }
        defaultRange *= 1 + 0.05 * incTower.getEffectiveSkillLevel('initialEngineering');
        this.range = ko.observable(opt.range || defaultRange);
        this.trueRange = ko.pureComputed(function () {
            //var ret = this.range;
            return this.range() * (1 + 0.05 * incTower.getEffectiveSkillLevel('sensors'));
        }, this);
        this.inputEnabled = true;
        this.events.onInputOver.add(TowerInputOver,this);
        this.events.onInputOut.add(TowerInputOut,this);
        this.events.onInputDown.add(TowerInputDown,this);
        this.fireLastTime = game.time.now + this.fireTime;
        var upgradeCost = opt.remainingUpgradeCost;
        if (upgradeCost === undefined || isNaN(upgradeCost)) { upgradeCost = calculateTowerUpgradeCost(this.towerType, this.level()); }
        else {
            upgradeCost = new BigNumber(upgradeCost);
        }
        this.remainingUpgradeCost = ko.observable(upgradeCost);
        this.remainingUpgradeCost.subscribe(function (newVal) {
            if (newVal.lte(0)) {
                this.upgrade();
            }
        }, this);
        towers.add(this);
        incTower.towers.push(this);
        tileForbidden[tileX][tileY] = true;
    }
};
Tower.prototype = Object.create(Phaser.Sprite.prototype);
Tower.prototype.constructor = Tower;
Tower.prototype.add = function(pointer) {
    game.input.onDown.add(Tower.prototype.posit, this);
};
Tower.prototype.upgradeCost = function () {
    'use strict';
    if (this.remainingUpgradeCost === undefined) { return new BigNumber(0); }
    return this.remainingUpgradeCost();
};

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
    if (game.time.now >= this.fireLastTime) {
        var enemiesInRange = [];
        for (var i = 0;i < enemys.children.length;i++) {
            if (!enemys.children[i].alive) { continue; }
            if (enemys.children[i].x < 0 || enemys.children[i].y < 0) { continue; }
            if (game.physics.arcade.distanceBetween(enemys.children[i],this) <= this.trueRange()) {
                enemiesInRange.push(enemys.children[i]);
            }
        }
        if (enemiesInRange.length > 0) {
            var chosenEnemy = enemiesInRange[(Math.random()*enemiesInRange.length) | 0];
            var sprite = 'bullet.png';
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
            this.fireLastTime = game.time.now + this.fireTime;
            game.physics.arcade.moveToObject(bullet, chosenEnemy, 300);
            bullet.fired = game.time.now;
        }
    }
};
Tower.prototype.upgrade = function () {
    incrementObservable(this.level);
    incTower.checkHelp('towerUpgrades');
    if (this.level() % 10 === 0) {
        incrementObservable(this.damage,this.damage());
    } else {
        incrementObservable(this.damage,incTower.towerAttributes[this.towerType].damagePerLevel);
    }
    //this.fireTime *= 0.99;
    //incrementObservable(this.range, 2);
    this.remainingUpgradeCost(calculateTowerUpgradeCost(this.towerType, this.level()));
    //TowerInputDown(tower);
}