define(['incTower/core', 'lib/bignumber', 'incTower/path'], function (incTower, BigNumber, pathModule) {
    'use strict';
    incTower.everySecond = function() {
        //Check paused
        incTower.checkMusic();

        if (incTower.paused()) { return; }
        //Mutate Map
        if (Date.now() - pathModule.lastMutate > 10000) {
            pathModule.mutateNextTile();
        }
        //Training skills
        var incrementObservable = incTower.incrementObservable;
        incTower.mana(BigNumber.min(incTower.maxMana(), incTower.mana().plus(incTower.manaRegeneration())));
        incTower.checkQueue();
        incrementObservable(incTower.skillPoints, incTower.skillRate());
        incrementObservable(incTower.gold, incTower.getEffectiveSkillLevel('investment'));

        var skillUp = false;

        while (incTower.activeSkill() && incTower.skillPoints().gt(0)) {
            var skillName = incTower.activeSkill();
            var skill = incTower.skills.get(skillName)();
            if (!skill) { break; }
            var transferAmount = BigNumber.min(skill.get('skillPointsCap')(), incTower.skillPoints());
            incrementObservable(incTower.skillPoints, transferAmount.neg());
            skill.get('skillPoints')(skill.get('skillPoints')().add(transferAmount));

            //incrementObservable(skill.get('skillPoints'), incTower.skillRate());
            if (skill.get('skillPoints')().gte(skill.get('skillPointsCap')())) {
                skill.get('skillPoints')(skill.get('skillPoints')().sub(skill.get('skillPointsCap')()));
                incrementObservable(skill.get('skillLevel'));
                skillUp = true;

                //console.log(incTower.activeSkill());
                skill.get('skillPointsCap')(incTower.costCalc(incTower.skillAttributes[incTower.activeSkill()].baseCost, skill.get('skillLevel')(), incTower.skillAttributes[incTower.activeSkill()].growth));
                incTower.checkHelp('skills');
                incTower.skillQueue.shift();
                incTower.checkSkill(skillName);
                incTower.checkQueue();
            }
        }
        if (skillUp) {
            incTower.playSoundEffect('positive');
        }
        incTower.enemys.forEachAlive(function(enemy) {
            if (enemy.recentlyCast()) {
                enemy.recentlyCast(false);
            }
            if (enemy.healer > 0 && incTower.game.time.now - (enemy.lastHeal || 0) > 10000) {
                var candidate = false;
                var maxRemainingHealth = new BigNumber(0);
                var maxPercentage = 0;
                var healAmount = enemy.maxHealth.times(enemy.healer * 0.05);
                incTower.enemys.forEachAlive(function(otherEnemy) {
                    var remainingHealth = otherEnemy.maxHealth.minus(otherEnemy.health());
                    if (enemy === otherEnemy) { remainingHealth = remainingHealth.div(2); } //Heal half as much if we are healing ourselves
                    if (remainingHealth.gt(maxRemainingHealth)) {
                        maxRemainingHealth = remainingHealth;
                        maxPercentage = remainingHealth.div(otherEnemy.maxHealth).toNumber();
                        candidate = otherEnemy;
                    }
                });
                if (candidate && (maxRemainingHealth.gt(healAmount) || maxPercentage > 0.25)) {
                    healAmount = BigNumber.min(healAmount, maxRemainingHealth);
                    incTower.createFloatingText({'color':'green', 'around':candidate,'amount':healAmount, 'type':'heal'});
                    incrementObservable(candidate.health,healAmount);
                    enemy.castSpell("Heal");
                    enemy.lastHeal = incTower.game.time.now;
                }
            }
            if (enemy.regenerating > 0 && enemy.statusEffects.chilled().lt(100)) {
                var curHealth = enemy.health();
                var healAmount = enemy.maxHealth.times(enemy.regenerating * 0.01);
                if (healAmount.add(curHealth).gt(enemy.maxHealth)) { healAmount = enemy.maxHealth.minus(curHealth); }
                if (enemy.statusEffects.burning() > 0) {
                    enemy.statusEffects.burning(enemy.statusEffects.burning().times(0.8)); //Reduces the burning instead of allowing a full regen tick
                } else if (healAmount > 0) {
                    incTower.createFloatingText({'color':'green', 'around':enemy,'amount':healAmount, 'type':'regenerating'});
                    incrementObservable(enemy.health,healAmount);
                }
            }
            if (enemy.teleport > 0 && enemy.statusEffects.chilled().lt(100) && !enemy.knockback) {
                if (incTower.game.rnd.integerInRange(0,100) <= 10) {
                    var origScale = enemy.scale.x;
                    var curTileEntry = enemy.path[enemy.curTile];
                    var possibleTiles = [];
                    var maxTile = 0;
                    incTower.enemys.forEachAlive(function (otherEnemy) {
                        maxTile = Math.max(maxTile, otherEnemy.curTile);
                    });
                    //We are allowed to teleport up to 1 space after the furthest any enemy has gone
                    maxTile = Math.min(maxTile + 1, enemy.path.length);
                    for (var i = enemy.curTile;i < maxTile;++i) {
                        var destTile = enemy.path[i];
                        var dist = Math.abs(destTile.x - curTileEntry.x) + Math.abs(destTile.y - curTileEntry.y);
                        if (dist <= enemy.teleport && dist >= 1) {
                            possibleTiles.push(i);
                        }
                    }
                    if (possibleTiles.length > 0) {
                        enemy.teleporting = true;
                        var blinkTween = incTower.game.add.tween(enemy.scale).to({x:0},250, Phaser.Easing.Quadratic.In);
                        enemy.curTile = incTower.game.rnd.pick(possibleTiles);
                        var bestTile = enemy.path[enemy.curTile];
                        var moveTween = incTower.game.add.tween(enemy).to({x:bestTile.x * 32 + 16, y:bestTile.y * 32 + 16},50,"Linear");
                        var blinkInTween = incTower.game.add.tween(enemy.scale).to({x:origScale},250, Phaser.Easing.Quadratic.In);
                        blinkInTween.onComplete.add(function () {
                            enemy.teleporting = false;
                            enemy.nextTile();
                        });
                        blinkTween.chain(moveTween,blinkInTween);
                        blinkTween.start();
                    }
                }
            }
            _.mapValues(enemy.statusEffects, function (effect, effectName) {
                if (effect().gt(0)) {
                    var reduction = 0.8;
                    if ((enemy.steelSkin || 0) > 0 && (effectName === 'bleeding' || effectName === 'burning')) {
                        effect(effect().times(1 - (0.5 * enemy.steelSkin)));
                    }
                    if (effectName === 'bleeding') {
                        reduction = 0.5 + (0.0125 * incTower.getEffectiveSkillLevel('anticoagulants'));
                    }
                    effect(effect().times(reduction));
                    if (effectName === 'burning') {
                        enemy.assignDamage(effect(),'fire');
                    }
                    if (effectName === 'bleeding') {
                        enemy.assignDamage(effect(),'bleed');
                    }
                    if (effect().lt(3)) {
                        effect(new BigNumber(0));
                        if (effectName === 'burning') {
                            enemy.burningSprite.visible = false;
                        }
                    }
                }
            });
            enemy.elementalRuneDiminishing = _.mapValues(enemy.elementalRuneDiminishing, function (dim) {
                if (dim < 0.5) { return 0; }
                return dim * 0.95;
            });
        });
        incrementObservable(incTower.avgDPS, incTower.avgDPS().div(300).neg());
        incrementObservable(incTower.avgDPS, incTower.damageLastSecond.div(300));
        incrementObservable(incTower.avgGPS, incTower.avgGPS().div(300).neg());
        incrementObservable(incTower.avgGPS, incTower.goldLastSecond.div(300));
        if (incTower.damageLastSecond.gt(incTower.highestDPS())) {
            incTower.highestDPS(incTower.damageLastSecond);
        }
        incTower.damageLastSecond = new BigNumber(0);
        incTower.goldLastSecond = new BigNumber(0);

    };
});
