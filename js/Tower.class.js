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
    incrementObservable(incTower.gold,tower.sellValue());
    DestroyTower(tower);

}
function PayToUpgradeTower(tower, byLevel, cost) {
    if (tower === null) { return; }
    if (byLevel === undefined) {
        byLevel = 1;
    }
    if (cost === undefined) {
        cost = tower.upgradeCost(byLevel);
    }
    //console.log("Cost to upgrade " + byLevel + " is " + humanizeNumber(cost));
    if (incTower.gold().gte(cost)) {
        incrementObservable(tower.goldSpent, cost);
        incrementObservable(incTower.gold, cost.neg());
        tower.upgrade(byLevel);
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
        if (incTower.towerMaxDamage[this.towerType] === undefined) {
            incTower.towerMaxDamage[this.towerType] = ko.observable(new BigNumber(0));
        }
        if ('icon' in incTower.towerAttributes[this.towerType]) {
             this.icon = game.add.sprite(worldX+tileSquare/2, worldY+tileSquare/2, 'incTower', incTower.towerAttributes[this.towerType].icon);
        }
        this.goldSpent = ko.observable(new BigNumber(opt.goldSpent || opt.cost || 0));
        this.worldX = worldX;
        this.worldY = worldY;
        this.tileX = tileX;
        this.tileY = tileY;
        this.tower = true;
        this.powerBar = game.add.graphics(0,0); //This bar represents relative power
        this.addChild(this.powerBar);


        this.anchor.setTo(0.5,0.5);
        this.tile = tile;
        if (opt.damage) {
            this.damage = ko.observable(new BigNumber(opt.damage));
        } else {
            var defaultDamage = incTower.towerAttributes[this.towerType].blueprintPoints().plus(5);
            defaultDamage = defaultDamage.times(1 + 0.05 * incTower.getEffectiveSkillLevel('initialEngineering'));
            this.damage = ko.observable(defaultDamage);

        }
        this.totalDamage = ko.pureComputed(function () {

            var ret = this.damage();
            if (this.towerType === 'kinetic') {
                ret = ret.times(1 + 0.05 * incTower.getEffectiveSkillLevel('kineticTowers'));
                ret = ret.times(1 + 0.05 * incTower.getEffectiveSkillLevel('kineticAmmo'));
            }
            return ret;
        },this);
        var totalDamageSubscription = function (newDamage) {
            if (newDamage === undefined) { return; }
            if (newDamage.gt(incTower.towerMaxDamage[this.towerType]())) {
                incTower.towerMaxDamage[this.towerType](newDamage);
            }
        };
        this.totalDamage.subscribe(totalDamageSubscription, this);


        this.relativeTowerPower = ko.computed(function () {
            if (this.totalDamage() === undefined) { return; }
            var per = this.totalDamage().div(incTower.towerMaxDamage[this.towerType]()) * 1.0;
            return per;
        }, this);
        var relativeTowerPowerSubscription = function (per) {
            if (per === undefined) { return; }
            var colour = '0xFF0000';
            this.powerBar.clear();
            this.powerBar.beginFill(colour);
            this.powerBar.lineStyle(3, colour, 1);
            this.powerBar.moveTo(-16,15);
            this.powerBar.lineTo(-16,-32 * per + 16);
            this.powerBar.endFill();
            game.world.bringToTop(this.powerBar);
        };
        this.relativeTowerPower.subscribe(relativeTowerPowerSubscription, this);

        totalDamageSubscription.call(this, this.totalDamage());
        relativeTowerPowerSubscription.call(this, this.relativeTowerPower());

        this.level = ko.observable(opt.level || 1);
        var defaultFireRate = 2000;
        if ('startingFireRate' in incTower.towerAttributes[this.towerType]) {
            defaultFireRate = incTower.towerAttributes[this.towerType].startingFireRate;
        }
        defaultFireRate *= 1 - 0.05 * incTower.getEffectiveSkillLevel('initialEngineering');
        this.fireTime = Math.min(opt.fireTime || defaultFireRate, defaultFireRate); //opt.fireTime ||
        var defaultRange = 150;
        if ('startingRange' in incTower.towerAttributes[this.towerType]) {
            defaultRange = incTower.towerAttributes[this.towerType].startingRange;
        }
        defaultRange *= 1 + 0.05 * incTower.getEffectiveSkillLevel('initialEngineering');

        this.range = ko.observable(Math.min(opt.range || defaultRange, defaultRange)); // opt.range ||
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
        if (upgradeCost === undefined || isNaN(upgradeCost)) {
            upgradeCost = calculateTowerUpgradeCost(this.towerType, this.level());
        } else {
            upgradeCost = new BigNumber(upgradeCost);
        }
        this.sellValue = function () {
            return this.goldSpent().times(incTower.sellTowerPer());
        };
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
Tower.prototype.upgradeCost = function (byLevel) {
    'use strict';
    if (this.remainingUpgradeCost === undefined) { return new BigNumber(0); }
    if (byLevel === undefined) {
        byLevel = 1;
    }
    var cost = this.remainingUpgradeCost();
    byLevel--;
    var prosLevel = this.level() + 1;
    while (byLevel > 0) {
        prosLevel++;
        byLevel--;
        cost = cost.plus(calculateTowerUpgradeCost(this.towerType, prosLevel));
    }
    return cost;


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
        //console.log("Now: " + game.time.now + " Last Fired:" + this.fireLastTime);
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
Tower.prototype.upgrade = function (byLevel) {
    'use strict';
    if (byLevel === undefined) {
        byLevel = 1;
    }
    var curLevel = this.level();
    var goalLevel = curLevel + byLevel;
    var damage = this.damage();
    var damagePerLevel = incTower.towerAttributes[this.towerType].damagePerLevel;
    while (curLevel < goalLevel) {
        curLevel++;
        if (curLevel % 10 === 0) {
            damage = damage.times(2);
        } else {
            damage = damage.plus(damagePerLevel);
        }
    }
    this.level(curLevel);
    this.damage(damage);
    incTower.checkHelp('towerUpgrades');
    this.remainingUpgradeCost(calculateTowerUpgradeCost(this.towerType, curLevel));
};