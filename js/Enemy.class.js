function EnemyInputDown(sprite,pointer) {
    incTower.currentlySelected(sprite);
}
function chilledUpdate(value) {
    if (value > 100) {
        value = 100;
        this.animations.paused = true;
    } else {
        this.animations.paused = false;
    }
    this.animations.currentAnim.speed = this.realSpeed() * 10;
    var others = 255 - value;
    this.tint = rgbToHex(others,others,255);
}

var Enemy = function(x, y, opts) {
    var anim = incTower.enemyAnimations[opts.name];
    Phaser.Sprite.call(this, game, x, y, 'incTower', anim[0]);
    game.physics.enable(this, Phaser.Physics.ARCADE);
    this.animations.add('walk', anim, 10, true, false);
    this.animations.play('walk');
    this.anchor.setTo(0.5, 0.5);
    this.speed = 1;
    this.enemy = true;
    this.knockback = false; //Only shows whether we are currently being knocked back orn ot.
    this.statusEffects = {
        chilled: ko.observable(new BigNumber(0)),
        sensitivity: ko.observable(new BigNumber(0)),
        burning: ko.observable(new BigNumber(0)),
        bleeding: ko.observable(new BigNumber(0))
    };
    this.events.onKilled.add(function () {


        if (incTower.currentlySelected() === this) {
            incTower.currentlySelected(null);
        }

        this.healthbar.destroy();
    },this);
    this.realSpeed = ko.computed(function () {
        var speed = this.speed;
        speed -= speed * (this.statusEffects.chilled() * 0.01);
        return Math.max(0,speed);
    }, this);
    this.statusEffects.chilled.subscribe(chilledUpdate,this);
    this.speedX = 0;
    this.speedY = 0;


    this.goldValue = ko.observable(opts.goldValue);
    this.healthbar = game.add.graphics(0,0);
    this.addChild(this.healthbar);

    this.curTile = -1;
    for (var opt in opts) {
        if (opts.hasOwnProperty(opt)) {
            if (opt === "scale") {
                //this.scale.set( opts[opt], opts[opt]);
                this.scale.x = opts[opt];
                this.scale.y = opts[opt];
                this.healthbar.scale.x = opts[opt];
                this.healthbar.scale.y = opts[opt];
            } else if (opt === "speed") {
                this.speed = opts[opt];
            } else if (!(opt in this)) {
                this[opt] = opts[opt];
                if (opt === 'powers') {
                    var powers = opts[opt];
                    var ret = [];
                    _.forEach(_.keys(powers), function (power) {
                        ret.push({'power': power, 'level': powers[power]});
                    });
                    ret = _.sortBy(ret, 'level');
                    this.sortedPowers = ret.reverse();
                }
            }
        }
    }
    if (this.shielding > 0) {
        this.shieldSprite = game.add.sprite(0, 0, 'incTower', 'bubble.png');
        this.shieldSprite.anchor.setTo(0.5,0.5);
        this.addChild(this.shieldSprite);
    }
    enemys.add(this);
    this.inputEnabled = true;
    this.events.onInputDown.add(EnemyInputDown,this);
    this.path = path.slice(0);
    this.nextTile();
    this.moveElmt();
    this.health = ko.observable();

    this.health.subscribe(function (newHealth) {
        this.healthbar.clear();
        var per = newHealth.div(this.maxHealth);
        var x = (per) * 100;
        var colour = rgbToHex((x > 50 ? 1-2*(x-50)/100.0 : 1.0) * 255, (x > 50 ? 1.0 : 2*x/100.0) * 255, 0);
        this.healthbar.beginFill(colour);
        this.healthbar.lineStyle(5, colour, 1);
        this.healthbar.moveTo(-16,-21);
        this.healthbar.lineTo(32 * per - 16, -21);
        this.healthbar.endFill();
        game.world.bringToTop(this.healthbar);
    }, this);
    this.maxHealth = opts.health;
    this.health(new BigNumber(opts.health));
    this.elementalInstability = ko.observable(new BigNumber(0));
    this.elementalRunes = [];
    this.elementalRuneCounts = {};
    this.elementalRuneDiminishing = {};



};

Enemy.prototype = Object.create(Phaser.Sprite.prototype);
Enemy.prototype.constructor = Enemy;

Enemy.prototype.assignDamage = function (damage, type) {
    'use strict';
    if (damage.times === undefined) { console.trace(); }
    if (type === undefined) { type = "normal"; }
    var sensitivity = this.statusEffects.sensitivity();
    if (sensitivity > 0) { damage = damage.times(1 + (this.statusEffects.sensitivity() * 0.01)); }
    if (type in this.elementalRuneCounts) {
        damage = damage.times(1 + (this.elementalRuneCounts[type] * 0.20));
    }
    if (type === 'water') {
        damage = damage.times(1 + 0.1 * incTower.getEffectiveSkillLevel('waterMastery'));
        damage = damage.times(1 - 0.2 * (this['water-resistant'] || 0));
    } else if (type === 'air') {
        damage = damage.times(1 + 0.1 * incTower.getEffectiveSkillLevel('airMastery'));
        damage = damage.times(1 - 0.2 * (this['air-resistant'] || 0));
    } else if (type === 'fire') {
        damage = damage.times(1 + 0.1 * incTower.getEffectiveSkillLevel('fireMastery'));
        damage = damage.times(1 - 0.2 * (this['fire-resistant'] || 0));
    } else if (type === 'earth') {
        damage = damage.times(1 + 0.1 * incTower.getEffectiveSkillLevel('earthMastery'));
        damage = damage.times(1 - 0.2 * (this['earth-resistant'] || 0));
    } else if (type === 'arcane') {
        damage = damage.times(1 - 0.2 * (this['arcane-resistant'] || 0));
    }


    if (this.shielded) {
        damage = BigNumber(0);
        this.shieldSprite.visible = false;
        this.shielded = false;
    }
    incrementObservable(this.health, damage.negated());
    incTower.createFloatingText({'scatter':0,'around':this,'amount':damage.negated(), 'type':'damage'});
    if (this.health().lte(0)) {
        incTower.gainGold(this.goldValue(), this);
        this.kill();
    }
};
Enemy.prototype.moveElmt = function() {
    'use strict';
    if (this.knockback) { return; }
    this.x += this.speedX * this.realSpeed();
    this.y += this.speedY * this.realSpeed();
    console.log([this.x, this.y, this.speedX, this.speedY, this.nextX, this.nextY]);
    if (this.speedX > 0 && this.x >= this.nextX) {
        this.x = this.nextX;
        this.nextTile();
    }
    else if (this.speedX < 0 && this.x <= this.nextX) {
        this.x = this.nextX;
        this.nextTile();
    }
    else if (this.speedY > 0 && this.y >= this.nextY) {
        this.y = this.nextY;
        this.nextTile();
    }
    else if (this.speedY < 0 && this.y <= this.nextY) {
        this.y = this.nextY;
        this.nextTile();
    } else if (this.speedX  === 0 && this.speedY === 0 && this.realSpeed() > 0.5) {
        this.nextTile();
    }

};
Enemy.prototype.nextTile = function () {
    this.curTile++;
    if (this.curTile === 0 && this.x < 0) {
        this.speedX = 1;
        this.speedY = 0;
        this.angle = 0;
        this.nextX = this.path[this.curTile].x * tileSquare + 16 | 0;
        this.nextY = this.path[this.curTile].y * tileSquare + 16 | 0;
        return;
    }
    //We ran off the edge
    if (typeof(this.path[this.curTile]) === "undefined") {
        if (incTower.wave() % 5 === 0) {
            //Boss ran off the edge
            console.log("Boss ran off the edge");
            if (!incTower.dialogEdgeBoss) {
                incTower.dialogEdgeBoss = true;
                okDialog({
                    title: "Boss Waves",
                    message: "Every five waves there is a boss wave. When a boss survives your defenses you will be set back to the previous wave. You will not be able to pass the boss wave until you can defeat it."
                });
            }
            if (incTower.currentlySelected() !== null && incTower.currentlySelected().enemy) {
                incTower.currentlySelected(null);
            }
            enemys.forEach(function(theEnemy) {
                theEnemy.kill();
            });
            incrementObservable(incTower.wave, -1); //Go back a wave.
            incTower.farmMode(true); //Turn farm mode on
            return;
        } else if (!incTower.dialogEdgeRegular) {
            incTower.dialogEdgeRegular = true;
            okDialog({
                title: "Regular Enemies",
                message:"When non-boss enemies run off the edge they cycle back through your defenses. Each time this is allowed to happen the monster loses 10% of its gold value."
            });
        }
        if (incTower.wave() > 1) { this.goldValue(this.goldValue().times(0.9)); } //Lose 10% of our gold value each time we p
        this.curTile = 0;
        this.x = (this.path[0].x - 1) * tileSquare;
        this.y = this.path[0].y * tileSquare;
    }
    this.nextX = this.path[this.curTile].x * tileSquare + 16 | 0;
    this.nextY = this.path[this.curTile].y * tileSquare + 16 | 0;
    // on check le sens gauche/droite
    if (this.nextX > this.x) {
        this.speedX = 1;
        this.angle = 0;
        this.scale.x = 1;
    } else if (this.nextX < this.x) {
        this.speedX = -1;
        this.scale.x = -1;
        this.angle = 0;
    } else {
        this.speedX = 0;
        this.scale.x = 1;
    }
    // on check le sens haut/bas
    if (this.nextY > this.y) {
        this.speedY = 1;
        this.angle = 90;
    } else if (this.nextY < this.y) {
        this.speedY = -1;
        this.angle = -90;
    } else {
        this.speedY = 0;
    }
};
Enemy.prototype.update = function () {
    this.moveElmt();
    if (this.shielding > 0) {
        if (this.lastShieldTime === undefined || this.lastShieldTime + (4000 / this.shielding) < game.time.now) {
            this.shielded = true;
            this.lastShieldTime = game.time.now;
            this.shieldSprite.visible = true;
        }
    }
}
Enemy.prototype.addElementalRune = function(runeType) {
    var iconName = runeType + '-element.png';
    var runeIcon = game.add.sprite(0, 0, 'incTower', iconName);
    this.elementalRunes.push(runeIcon);
    runeIcon.scale.x = 0.8;
    runeIcon.scale.y = 0.8;
    runeIcon.anchor.setTo(0,1);
    var magic = this.elementalRunes.length * 8;
    runeIcon.x = 16 + Math.floor(magic / 32) * 8;
    runeIcon.y = -16 + magic % 32;
    runeIcon.runeType = runeType;
    this.addChild(runeIcon);
    if (!(runeType in this.elementalRuneCounts)) { this.elementalRuneCounts[runeType] = 0; }
    this.elementalRuneCounts[runeType]++;
};

Enemy.prototype.repositionRunes = function () {
    this.elementalRuneCounts = {};
    //This is called after we have deleted some runes so we'll recount as well.
    for (var i = 0;i < this.elementalRunes.length;i++) {
        var magic = i * 8;
        this.elementalRunes[i].x = 16 + Math.floor(magic / 32) * 8;
        this.elementalRunes[i].y = -16 + magic % 32;
        var runeType = this.elementalRunes[i].runeType;
        if (!(runeType in this.elementalRuneCounts)) { this.elementalRuneCounts[runeType] = 0; }
        this.elementalRuneCounts[runeType]++;

    }

};
Enemy.prototype.performReaction = function (reaction, reactionCounts, opts) {
    if (opts === undefined) { opts = {}; }
    for (var key in reactionCounts) {
        this.elementalRuneDiminishing[key] = (this.elementalRuneDiminishing[key] || 0) + reactionCounts[key];
    }
    if (reaction === 'water') {
        var iceStormChance = reactionCounts.water - 4;
        if (iceStormChance > 0 && !opts.noStorm && game.rnd.integerInRange(1,100) >= iceStormChance) {
            var newOpts = opts;
            newOpts.noStorm = true;
            enemys.forEachAlive(function (enemy) {
                enemy.performReaction(reaction, reactionCounts, newOpts);
                incTower.createFloatingText({'color':'#0000CC', 'duration':3000, 'around':this,'text':'Ice Storm!', 'type':'iceStorm'});
            });
        }
        incrementObservable(this.statusEffects.chilled,50 * reactionCounts.water);
        if (this.statusEffects.chilled().gte(100)) {
            incTower.createFloatingText({'color':'#0000CC', 'duration':2000, 'around':this,'text':'Frozen!', 'type':'frozen'});
        }
        this.assignDamage(this.elementalInstability().times(Math.pow(1.2,Math.max(0,reactionCounts.water - 1))), 'water');

    } else if (reaction === 'fire') {
        var fireStormChance = reactionCounts.fire - 4;
        if (fireStormChance > 0 && !opts.noStorm && game.rnd.integerInRange(1,100) >= fireStormChance) {
            var newOpts = opts;
            newOpts.noStorm = true;
            enemys.forEachAlive(function (enemy) {
                enemy.performReaction(reaction, reactionCounts, newOpts);
                incTower.createFloatingText({'color':'#CC0000', 'duration':3000, 'around':this,'text':'Fire Storm!', 'type':'fireStorm'});
            });
        }
        incrementObservable(this.statusEffects.sensitivity, 20 * reactionCounts.fire);
        incrementObservable(this.statusEffects.burning, this.elementalInstability().times(Math.pow(1.2,Math.max(0,reactionCounts.fire - 1))));
        if (this.burningSprite === undefined) {
            this.burningSprite = game.add.sprite(0, -4, 'incTower', "smokefire-0001.png");
            this.burningSprite.anchor.setTo(0.5, 0.5);
            this.burningSprite.scale.x = 0.5;
            this.burningSprite.scale.y = 0.5;
            this.burningSprite.angle = 270;
            this.addChild(this.burningSprite);
            this.burningSprite.animations.add('burn', [
                "smokefire-0001.png",
                "smokefire-0002.png",
                "smokefire-0003.png",
                "smokefire-0004.png",
                "smokefire-0005.png",
                "smokefire-0006.png",
                "smokefire-0007.png",
                "smokefire-0008.png",
                "smokefire-0009.png",
                "smokefire-0010.png",
                "smokefire-0011.png",
                "smokefire-0012.png",
                "smokefire-0013.png",
                "smokefire-0014.png",
                "smokefire-0015.png",
                "smokefire-0016.png",
                "smokefire-0017.png",
                "smokefire-0018.png",
                "smokefire-0019.png",
                "smokefire-0020.png"
            ], 10, true, false);
            this.burningSprite.animations.play('burn');
        } else {
            this.burningSprite.visible = true;
        }
    } else if (reaction === 'earth') {
        var boulderStormChance = reactionCounts.earth - 4;
        if (boulderStormChance > 0 && !opts.noStorm && game.rnd.integerInRange(0,100) >= boulderStormChance) {
            var newOpts = opts;
            newOpts.noStorm = true;
            enemys.forEachAlive(function (enemy) {
                enemy.performReaction(reaction, reactionCounts, newOpts);
                //incTower.createFloatingText({'color':'#CC0000', 'duration':3000, 'around':this,'text':'Fire Storm!', 'type':'fireStorm'});
            });
        }
        var boulder = game.add.sprite(this.x, this.y, 'incTower', 'rock' + game.rnd.integerInRange(1,3) + '.png');
        boulder.anchor.setTo(0.5, 0.5);
        game.physics.enable(boulder, Phaser.Physics.ARCADE);
        var bigDim = boulder.width;
        if (boulder.height > bigDim) { bigDim = boulder.height; }
        var endWidth = Math.max(tileSquare * reactionCounts.earth * 0.5,tileSquare);
        var startWidth = endWidth * 4;
        boulder.damageOnImpact = this.elementalInstability().times(Math.pow(1.2,Math.max(0,reactionCounts.earth - 1)));
        boulder.scale.x = startWidth / bigDim;
        boulder.scale.y = startWidth / bigDim;

        var boulderTween = game.add.tween(boulder.scale).to({x:endWidth / bigDim, y: endWidth / bigDim},500, Phaser.Easing.Quadratic.In, true);
        boulderTween.onComplete.add(function () {
            game.physics.arcade.overlap(this, enemys, function (boulder, enemy) {
                enemy.assignDamage(boulder.damageOnImpact,'earth');
                incrementObservable(enemy.statusEffects.bleeding, boulder.damageOnImpact);
            }, null, this);
            this.destroy();
        },boulder);
    } else if (reaction === 'air') {
        var originX = this.x;
        var originY = this.y;
        var minX = Math.max(0,originX - 32 * reactionCounts.air);
        var maxX = Math.min(800,originX + 32 * reactionCounts.air);
        var minY = Math.max(0,originY - 32 * reactionCounts.air);
        var maxY = Math.min(608,originY + 32 * reactionCounts.air);
        var tweenLength = Math.max(500,Math.min(1500, 250 * reactionCounts.air - 1));
        var windStormChance = reactionCounts.air - 4;
        var windStorm = false;
        if (windStormChance > 0 && !opts.noStorm && game.rnd.integerInRange(1,100) >= windStormChance) {
            //When we get a windstorm we impact all enemies on the map
            //minX = 0;
            //maxX = 800;
            //minY = 0;
            //maxY = 608;
            windStorm = true;

        }

        //var destTileNum = Math.floor(Math.max(0,this.curTile - Math.max(1,diminishingReturns(reactionCounts.air, 2))));
        var destTileNum = Math.floor(Math.max(0,this.curTile - Math.max(1,reactionCounts.air)));
        var kbX = this.path[destTileNum].x * 32 + 16; //Knock back X and Y
        var kbY = this.path[destTileNum].y * 32 + 16;
        var impactedEnemies = [];
        for (var i = 0;i < enemys.children.length;i++) {
            if (!enemys.children[i].alive) {
                continue;
            }
            if (windStorm) {
                impactedEnemies.push(enemys.children[i]);
            } else if (enemys.children[i].x >= minX && enemys.children[i].x <= maxX && enemys.children[i].y >= minY && enemys.children[i].y <= maxY) {
                impactedEnemies.push(enemys.children[i]);
            }
        }
        var airDamage = this.elementalInstability().times(Math.pow(1.2,Math.max(0,reactionCounts.air - 1)));

        for (var i = 0; i < impactedEnemies.length; i++) {
            impactedEnemies[i].knockback = true;
            impactedEnemies[i].animations.paused = true;
            impactedEnemies[i].curTile = destTileNum;
            impactedEnemies[i].assignDamage(airDamage, 'air');
            if (impactedEnemies[i].elementalRuneDiminishing.air === undefined) {
                impactedEnemies[i].elementalRuneDiminishing.air = 0;
            }
            impactedEnemies[i].elementalRuneDiminishing.air += reactionCounts.air * 0.5;

            var knockbackTween = game.add.tween(impactedEnemies[i]).to({
                angle: ['+90', '+180', '+270', '+360', '+450'],
                x: [maxX, maxX, minX, minX, kbX + game.rnd.integerInRange(-16, 16)],
                y: [minY, maxY, maxY, minY, kbY + game.rnd.integerInRange(-16, 16)]
            }, tweenLength, "Sine.easeInOut", false);
            knockbackTween.onComplete.add(function () {
                this.knockback = false;
                this.speedX = 0;
                this.speedY = 0;
                this.animations.paused = false;
            }, impactedEnemies[i]);
            knockbackTween.interpolation(Phaser.Math.bezierInterpolation);
            knockbackTween.start();
        }

    }
//    console.log(reactionCounts);

};