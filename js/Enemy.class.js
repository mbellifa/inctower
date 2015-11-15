function EnemyInputDown(sprite,pointer) {
    incTower.currentlySelected(sprite);
}
function chilledUpdate(value) {
    if (value > 100) {
        value = 100;
        this.animations.paused = true;
        console.log('FROZEN!');
    } else {
        this.animations.paused = false;
    }
    this.animations.currentAnim.speed = this.realSpeed() * 10;
    var blue = ((value * 2.55) | 0);
    var others = 255 - value;
    this.tint = rgbToHex(others,others,255);
    //this.blendMode = PIXI.blendModes.MULTIPLY;
    //this.blendMode = PIXI.blendModes.ADD;
}

var Enemy = function(x, y, opts) {
    var anim = incTower.enemyAnimations[opts.name];
    //Phaser.Sprite.call(this, game, path[0].x * tileSquare, path[0].y * tileSquare, 'incTower', anim[0]);
    Phaser.Sprite.call(this, game, x, y, 'incTower', anim[0]);
    //this = game.add.sprite(path[0].x * tileSquare, path[0].y * tileSquare, 'incTower', anim[0]);
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
        burning: ko.observable(new BigNumber(0))
    };
    this.events.onKilled.add(function () {
        var subsprites = Object.keys(this.subSprites);
        for (var i = 0; i < subsprites.length; i++) {
            this.subSprites[subsprites[i]].destroy();
        }
    },this);
    this.subSprites = { };
    this.statusEffects.chilled.subscribe(chilledUpdate,this);
    this.speedX = 0;
    this.speedY = 0;
    this.health = ko.observable(new BigNumber(opts.health));
    this.maxHealth = opts.health;
    this.healthbar = game.add.graphics(0,0);
    this.goldValue = ko.observable(opts.goldValue);
    //this.healthbar.anchor.set(0);
    //this.addChild(this.healthbar);
    this._lasthp = 0;
    this.curTile = 0;
    this.elementalInstability = ko.observable(0);
    this.instabilityCap = ko.observable(new BigNumber(5));
    this.totalInstability = ko.observable(0); //Number of times that we've hit the cap.
    //console.log(opts);
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
            }

        }
    }
    if (this.shielding > 0) {
        this.subSprites.shield = game.add.sprite(this.x, this.y, 'incTower', 'bubble.png');
    }
    enemys.add(this);
    this.inputEnabled = true;
    this.events.onInputDown.add(EnemyInputDown,this);
    this.path = path.slice(0);
    this.nextTile();
    this.moveElmt();
};

Enemy.prototype = Object.create(Phaser.Sprite.prototype);
Enemy.prototype.constructor = Enemy;

Enemy.prototype.assignDamage = function (damage, type) {
    'use strict';
    //console.trace();
    if (type === undefined) { type = "normal"; }
    //damage = damage.times(1 + (incTower.getNumberUpgrades('onePercentDamage') * 0.01));
    damage = damage.times(1 + (this.statusEffects.sensitivity() * 0.01));
    if (this.shielded) {
        damage = BigNumber(0);
        this.subSprites.shield.visible = false;
        this.shielded = false;
    }
    incrementObservable(this.health, damage.negated());
    incTower.createFloatingText({'scatter':0,'around':this,'amount':damage.negated(), 'type':'damage'});
    if (this.health() <= 0) {
        if (incTower.currentlySelected() === this) {
            incTower.currentlySelected(null);
        }
        incTower.gainGold(this.goldValue(), this);
        //incrementObservable(incTower.gold,enemy.goldValue);
        this.kill();
        this.healthbar.destroy();
    }
};
Enemy.prototype.moveElmt = function() {
    'use strict';
    if (this.knockback) { return; }
    this.x += this.speedX * this.realSpeed();
    this.y += this.speedY * this.realSpeed();
    if (this.speedX > 0 && this.x >= this.next_positX) {
        this.x = this.next_positX;
        this.nextTile();
        //Enemy.prototype.nextTile(this);
    }
    else if (this.speedX < 0 && this.x <= this.next_positX) {
        this.x = this.next_positX;
        this.nextTile();
        //Enemy.prototype.nextTile(this);
    }
    else if (this.speedY > 0 && this.y >= this.next_positY) {
        this.y = this.next_positY;
        this.nextTile();
        //Enemy.prototype.nextTile(this);
    }
    else if (this.speedY < 0 && this.y <= this.next_positY) {
        this.y = this.next_positY;
        this.nextTile();
        //Enemy.prototype.nextTile(this);
    }// else if (Math.abs(this.speedX) < 0.01 && Math.abs(this.speedY) < 0.01 && this.realSpeed() > 0) {
    //    this.nextTile();
    //}

};
Enemy.prototype.nextTile = function () {
    this.curTile++;
    //We ran off the edge
    if (typeof(this.path[this.curTile]) === "undefined") {
        if (incTower.wave() % 5 === 0) {
            //Boss ran off the edge
            console.log("Boss ran off the edge");
            if (!incTower.dialogEdgeBoss) {
                incTower.dialogEdgeBoss = true;
                okDialog(
                    "Every five waves there is a boss wave. When a boss survives your defenses you will be set back to the previous wave. You will not be able to pass the boss wave until you can defeat it.",
                    "Boss Waves"
                );
            }
            if (incTower.currentlySelected() !== null && incTower.currentlySelected().enemy) {
                incTower.currentlySelected(null);
            }
            enemys.forEach(function(theEnemy) {
                theEnemy.healthbar.destroy();
                theEnemy.kill();
            });


            incrementObservable(incTower.wave, -1); //Go back a wave.
            incTower.farmMode(true); //Turn farm mode on
            return;
        } else if (!incTower.dialogEdgeRegular) {
            incTower.dialogEdgeRegular = true;
            okDialog("When non-boss enemies run off the edge they cycle back through your defenses. Each time this is allowed to happen the monster loses 10% of its gold value.",
                "Regular Enemies"
            );

        }
        if (incTower.wave() > 1) { this.goldValue(this.goldValue().times(0.9)); } //Lose 10% of our gold value each time we p
        this.curTile = 0;
        this.x = (this.path[0].x - 1) * tileSquare;
        this.y = this.path[0].y * tileSquare;
    }
    this.next_positX = this.path[this.curTile].x * tileSquare + 16 | 0;
    this.next_positY = this.path[this.curTile].y * tileSquare + 16 | 0;
    // on check le sens gauche/droite
    if (this.next_positX > this.x) {
        this.speedX = 1;
        this.angle = 0;
        this.scale.x = 1;
    } else if (this.next_positX < this.x) {
        this.speedX = -1;
        this.scale.x = -1;
        this.angle = 0;
    } else {
        this.speedX = 0;
        this.scale.x = 1;
    }
    // on check le sens haut/bas
    if (this.next_positY > this.y) {
        this.speedY = 1;
        this.angle = 90;
    } else if (this.next_positY < this.y) {
        this.speedY = -1;
        this.angle = -90;
    } else {
        this.speedY = 0;
    }
};

Enemy.prototype.realSpeed = function () {
    var speed = this.speed;
    speed -= speed * (this.statusEffects.chilled() * 0.01);
    return Math.max(0,speed);
};