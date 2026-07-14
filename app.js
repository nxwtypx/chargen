new Vue({
  el: '#app',
  data: {
    rules: {
      classes: {},
      races: {},
      feats: {},
      spells: {},
      weapons: [],
      armor: [],
      wbl: {},
      skills: {},
      domains: {}
    },
    character: {
      name: '',
      race: 'Human',
      type: 'PC',
      alignment: 'LG',
      baseAbilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      levels: [
        { trackA: '', trackB: '', feat: '', featParam: '', bonusFeats: {}, bonusFeatsParams: {} }
      ],
      equipped: {
        weapons: [ { primary: -1, offhand: -1, wieldTwoHanded: false } ],
        chakras: {
          Face: '', Head: '', Throat: '', Shoulders: '',
          Body: -1, Torso: '', Hands: '', Arms: '', Waist: '',
          Ring1: '', Ring2: '', Feet: ''
        },
        other: ''
      },
      weapons: [],
      armor: [],
      preparedSpells: {},
      preparedDomainSpells: {},
      knownSpells: {},
      skillAllocations: [],
      domains: ['', ''],
      turnUndeadChoice: '',
      rangerCombatStyle: '',
      rangerFavoredEnemies: [],
      wizardSpecialization: '',
      wizardProhibitedSchools: [],
      wizardSpellbookSelections: [],
      wizardPurchasedSpells: [],
      wizardSpellMastery: [],
      rogueSpecialAbilities: [],
      rogueSkillMastery: []
    },
    ui: {
      showSpells: false,
      showFeatures: true,
      showRangerChoices: false,
      showWizardChoices: false,
      showRogueChoices: false,
      shopTab: 'Weapons',
      shopSearch: '',
      shopCategory: ''
    }
  },
  async created() {
    await this.loadData();
    this.handleRaceChange(); // Initialize race
  },
  computed: {
    sortedClassesList() {
      if (!this.rules.classes) return [];
      let classNames = Object.keys(this.rules.classes);
      return classNames.sort((a, b) => {
        let clsA = this.rules.classes[a];
        let clsB = this.rules.classes[b];
        let sourceA = clsA.source || '';
        let sourceB = clsB.source || '';
        
        let rankA = sourceA === 'SRD' ? 0 : 1;
        let rankB = sourceB === 'SRD' ? 0 : 1;
        
        if (rankA !== rankB) return rankA - rankB;
        if (sourceA !== sourceB) return sourceA.localeCompare(sourceB);
        return a.localeCompare(b);
      });
    },
    creatureType() {
      let monkLevels = (this.calculatedStats && this.calculatedStats.classLevels && this.calculatedStats.classLevels['Monk']) || 0;
      if (monkLevels >= 20) return 'Outsider';
      
      let raceData = this.rules.races[this.character.race];
      if (raceData && raceData.type) return raceData.type;
      
      return 'Humanoid';
    },
    pointBuyTotal() {
      const costs = {
        3: -5, 4: -4, 5: -3, 6: -2, 7: -1, 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 6, 15: 8, 16: 10, 17: 13, 18: 16
      };
      let total = 0;
      for (let stat in this.character.baseAbilities) {
        let val = this.character.baseAbilities[stat];
        if (costs[val] !== undefined) {
          total += costs[val];
        } else if (val > 18) {
           total += 16 + (val - 18) * 4;
        } else if (val < 3) {
           total += -5;
        }
      }
      return total;
    },
    characterSize() {
      let rData = this.rules.races[this.character.race];
      return rData ? rData.size : 'Medium';
    },
    weaponList() {
      let list = ['Unarmed strike', 'Grapple', 'Ray'];
      if (this.rules.weapons) {
        this.rules.weapons.forEach(w => {
          if (!list.includes(w.name)) list.push(w.name);
        });
      }
      return list.sort();
    },
    skillList() {
      return this.rules.skills ? Object.keys(this.rules.skills).sort() : [];
    },
    schoolList() {
      return ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];
    },
    sortedFeatNames() {
      return Object.keys(this.rules.feats).sort();
    },
    filteredWeapons() {
      if (!this.rules.weapons || !Array.isArray(this.rules.weapons)) return [];
      let search = this.ui.shopSearch ? String(this.ui.shopSearch).toLowerCase().trim() : '';
      let category = this.ui.shopCategory ? String(this.ui.shopCategory) : '';

      return this.rules.weapons.filter(w => {
        if (!w || !w.name) return false;
        if (category && w.category !== category) return false;
        if (search && !String(w.name).toLowerCase().includes(search)) return false;
        return true;
      });
    },
    filteredArmor() {
      if (!this.rules.armor || !Array.isArray(this.rules.armor)) return [];
      let search = this.ui.shopSearch ? String(this.ui.shopSearch).toLowerCase().trim() : '';
      let category = this.ui.shopCategory ? String(this.ui.shopCategory) : '';

      return this.rules.armor.filter(a => {
        if (!a || !a.name) return false;
        if (category && a.category !== category) return false;
        if (search && !String(a.name).toLowerCase().includes(search)) return false;
        return true;
      });
    },
    spentGold() {
      let total = 0;
      this.character.weapons.forEach(weapon => {
        total += this.getWeaponCostValue(weapon);
      });
      this.character.armor.forEach(a => {
        total += this.parseCost(a.cost);
      });
      total += this.wizardSpellbookCost || 0;
      return total;
    },
    remainingBudget() {
      return this.calculatedStats.budget - this.spentGold;
    },
    calculatedStats() {
      if (Object.keys(this.rules.classes).length === 0) return { hp: 0, bab: 0, saves: { fort: 0, ref: 0, will: 0 }, features: [], allFeatures: [], classLevels: {}, budget: 0 };

      let hp = 0;
      let babA = 0;
      let babB = 0;
      let skillPoints = 0;
      let classLevels = {};
      let featuresMap = new Map();

      let baseSaves = { fort: 0, ref: 0, will: 0 };

      let raceData = this.rules.races[this.character.race];
      let humanSkillBonus = 0;
      if (raceData && raceData.features) {
        let hasExtraSkillPoints = raceData.features.some(f => {
          let name = typeof f === 'string' ? f : f.name;
          return name === "Extra Skill Points";
        });
        if (hasExtraSkillPoints) humanSkillBonus = 1;
      }
      let intMod = this.getAbilityMod('int');
      let chaMod = this.getAbilityMod('cha');
      let divineGrace = 0;

      this.character.levels.forEach((lvl, index) => {
        let clsA = this.rules.classes[lvl.trackA];
        let clsB = this.rules.classes[lvl.trackB];

        const addFeatures = (clsData, currentLevel) => {
          if (clsData && clsData.features && clsData.features[currentLevel]) {
            clsData.features[currentLevel].forEach(f => {
              let name = typeof f === 'string' ? f : f.name;
              let replaces = typeof f === 'string' ? null : f.replaces;
              let featureKey = this.featureMapKey(name);

              if (replaces) {
                if (Array.isArray(replaces)) {
                  replaces.forEach(r => featuresMap.delete(this.featureMapKey(r)));
                } else {
                  featuresMap.delete(this.featureMapKey(replaces));
                }
              }
              let fObj = typeof f === 'string' ? {
                name: f,
                description: '',
                abilityType: '',
                showOnSheet: true,
                showOnBlock: true,
                isSpecialAttack: false,
                isSpecialQuality: true
              } : f;
              featuresMap.set(featureKey, fObj);
            });
          }
        };

        if (lvl.trackA) {
          classLevels[lvl.trackA] = (classLevels[lvl.trackA] || 0) + 1;
          addFeatures(clsA, classLevels[lvl.trackA]);
        }
        if (lvl.trackB) {
          classLevels[lvl.trackB] = (classLevels[lvl.trackB] || 0) + 1;
          addFeatures(clsB, classLevels[lvl.trackB]);
        }
        // Track global features
        
        // Calculate divine grace dynamically if Paladin levels hit 2+
        let currentPaladin = classLevels['Paladin'] || 0;
        if (currentPaladin >= 2 && chaMod > 0) {
          divineGrace = chaMod;
        }
        
        let hdA = clsA ? clsA.hitDie : 0;
        let hdB = clsB ? clsB.hitDie : 0;

        // HP calculation (max at first level if taking a real class, then average/rolled, here we just do max for simplicity in demo)
        let bestHD = Math.max(hdA, hdB);
        if (bestHD > 0) {
          hp += bestHD + this.getAbilityMod('con');
        }

        // Gestalt BAB is tricky per level, but simplified here as best progression
        // In actual 3.5, you take the fractional or best BAB per level.
        // For simplicity, we calculate total BAB for Track A and B, then take max.
        // Or better yet, we take the best BAB increment per level.
        let incA = this.getBabIncrement(clsA, index + 1);
        let incB = this.getBabIncrement(clsB, index + 1);
        babA += incA;
        babB += incB;

        // Skill Points
        let spA = clsA ? clsA.skillPoints : 0;
        let spB = clsB ? clsB.skillPoints : 0;
        let bestSp = Math.max(spA, spB);
        if (bestSp > 0) {
          let levelPoints = Math.max(1, bestSp + intMod) + humanSkillBonus;
          if (index === 0) {
            skillPoints += levelPoints * 4;
          } else {
            skillPoints += levelPoints;
          }
        }

        // Saves
        let saveIncA = this.getSaveIncrements(clsA, index + 1);
        let saveIncB = this.getSaveIncrements(clsB, index + 1);

        baseSaves.fort += Math.max(saveIncA.fort, saveIncB.fort);
        baseSaves.ref += Math.max(saveIncA.ref, saveIncB.ref);
        baseSaves.will += Math.max(saveIncA.will, saveIncB.will);
      });

      // Add Domain Features
      if (this.character.domains && this.rules.domains) {
        this.character.domains.forEach(d => {
          let domainData = this.rules.domains[d];
          if (domainData) {
            if (domainData.description) {
              featuresMap.set('Domain: ' + domainData.name, {
                name: 'Domain: ' + domainData.name,
                description: domainData.description,
                abilityType: 'Domain',
                showOnSheet: true,
                showOnBlock: true,
                isSpecialAttack: false,
                isSpecialQuality: true
              });
            }
            if (domainData.bonusFeats) {
              domainData.bonusFeats.forEach(f => {
                featuresMap.set('Bonus Feat: ' + f + ' (' + domainData.name + ')', {
                   name: f,
                   description: 'Granted by ' + domainData.name + ' Domain',
                   abilityType: 'Feat',
                   showOnSheet: true,
                   showOnBlock: true,
                   isSpecialAttack: false,
                   isSpecialQuality: false
                });
              });
            }
          }
        });
      }

      // Add Cleric/Paladin Turn/Rebuke Undead
      let clericLevels = classLevels['Cleric'] || 0;
      let paladinLevels = classLevels['Paladin'] || 0;
      let effectiveTurnLevel = clericLevels + (paladinLevels >= 4 ? paladinLevels - 3 : 0);
      
      if (effectiveTurnLevel > 0) {
        let align = this.character.alignment || 'LG';
        let isGood = align.includes('G');
        let isEvil = align.includes('E');
        
        let turnStr = '';
        if (isGood) turnStr = 'Turn Undead';
        else if (isEvil) turnStr = 'Rebuke Undead';
        else {
           if (this.character.turnUndeadChoice === 'Turn') turnStr = 'Turn Undead';
           else if (this.character.turnUndeadChoice === 'Rebuke') turnStr = 'Rebuke Undead';
           else turnStr = 'Turn/Rebuke Undead (Choice Pending)';
        }
        
        featuresMap.set(turnStr, {
          name: turnStr,
          description: 'A cleric can attempt to affect undead creatures a number of times per day equal to 3 + Charisma modifier.',
          abilityType: 'Su',
          showOnSheet: true,
          showOnBlock: true,
          isSpecialAttack: true,
          isSpecialQuality: false
        });
      }

      // Add Ranger choices
      let rangerLevels = classLevels['Ranger'] || 0;
      if (rangerLevels > 0) {
        let favoredEnemies = this.rangerFavoredEnemyBonuses;
        let favoredText = favoredEnemies.length > 0
          ? favoredEnemies.map(fe => `${fe.enemy} +${fe.bonus}`).join(', ')
          : 'choice pending';
        featuresMap.set('Favored enemy', {
          name: 'Favored enemy',
          description: `Bonuses apply on Bluff, Listen, Sense Motive, Spot, Survival, and weapon damage rolls against selected enemies: ${favoredText}.`,
          abilityType: 'Ex',
          showOnSheet: true,
          showOnBlock: true,
          isSpecialAttack: true,
          isSpecialQuality: false
        });

        if (rangerLevels >= 2) {
          let style = this.character.rangerCombatStyle || '';
          let styleFeat = this.getRangerCombatStyleFeat(rangerLevels);
          let styleText = style
            ? `${this.formatRangerCombatStyle(style)} (${styleFeat})`
            : 'choice pending';
          featuresMap.set('Combat style', {
            name: 'Combat style',
            description: `${styleText}. These benefits apply only in light or no armor.`,
            abilityType: 'Ex',
            showOnSheet: true,
            showOnBlock: true,
            isSpecialAttack: false,
            isSpecialQuality: true
          });
        }
      }

      let sneakAttackDice = this.getStackedProgressionTotal(classLevels, 'sneakAttackProgression');
      if (sneakAttackDice > 0) {
        featuresMap.set('Sneak attack', {
          name: `Sneak attack +${sneakAttackDice}d6`,
          description: 'Deal extra precision damage when the target is denied Dexterity bonus to AC or flanked. Ranged sneak attacks apply within 30 feet.',
          abilityType: 'Ex',
          showOnSheet: true,
          showOnBlock: true,
          isSpecialAttack: true,
          isSpecialQuality: false
        });
      }

      let trapSenseBonus = this.getStackedProgressionTotal(classLevels, 'trapSenseProgression');
      if (trapSenseBonus > 0) {
        featuresMap.set('Trap sense', {
          name: `Trap sense +${trapSenseBonus}`,
          description: `+${trapSenseBonus} bonus on Reflex saves and AC against traps. Trap sense bonuses from multiple classes stack.`,
          abilityType: 'Ex',
          showOnSheet: true,
          showOnBlock: true,
          isSpecialAttack: false,
          isSpecialQuality: true
        });
      }

      let uncanny = this.getUncannyDodgeState(classLevels);
      if (uncanny.hasImproved) {
        featuresMap.set('Uncanny dodge', {
          name: 'Improved uncanny dodge',
          description: `Cannot be flanked except by a rogue at least four levels higher than the character's ${uncanny.effectiveLevel} effective uncanny dodge level.`,
          abilityType: 'Ex',
          showOnSheet: true,
          showOnBlock: true,
          isSpecialAttack: false,
          isSpecialQuality: true
        });
      } else if (uncanny.hasUncanny) {
        featuresMap.set('Uncanny dodge', {
          name: 'Uncanny dodge',
          description: 'Retain Dexterity bonus to AC even if caught flat-footed or struck by an invisible attacker.',
          abilityType: 'Ex',
          showOnSheet: true,
          showOnBlock: true,
          isSpecialAttack: false,
          isSpecialQuality: true
        });
      }

      let rogueLevels = classLevels['Rogue'] || 0;
      if (rogueLevels >= 10) {
        let selectedSpecials = (this.character.rogueSpecialAbilities || []).filter(Boolean);
        selectedSpecials.forEach((ability, idx) => {
          let desc = this.getRogueSpecialAbilityDescription(ability);
          let featureKey = ability === 'Improved Evasion' ? 'Evasion' : `Rogue special ability ${idx + 1}`;
          featuresMap.set(featureKey, {
            name: ability,
            description: desc,
            abilityType: ability === 'Skill Mastery' ? '' : 'Ex',
            showOnSheet: true,
            showOnBlock: true,
            isSpecialAttack: ability === 'Crippling Strike' || ability === 'Opportunist',
            isSpecialQuality: ability !== 'Crippling Strike' && ability !== 'Opportunist'
          });
        });

        let masterySkills = (this.character.rogueSkillMastery || []).filter(Boolean);
        if (masterySkills.length > 0) {
          featuresMap.set('Rogue skill mastery skills', {
            name: 'Skill Mastery Skills',
            description: `May take 10 under stress with: ${masterySkills.join(', ')}.`,
            abilityType: '',
            showOnSheet: true,
            showOnBlock: false,
            isSpecialAttack: false,
            isSpecialQuality: true
          });
        }
      }

      let wizardLevels = classLevels['Wizard'] || 0;
      if (wizardLevels > 0 && this.character.wizardSpecialization) {
        let prohibited = (this.character.wizardProhibitedSchools || []).filter(s => s);
        featuresMap.set('School specialization', {
          name: `${this.wizardSpecialistName} specialization`,
          description: `Specialized in ${this.character.wizardSpecialization}; prohibited schools: ${prohibited.length ? prohibited.join(', ') : 'choice pending'}. Gains one additional specialty-school spell slot per spell level.`,
          abilityType: '',
          showOnSheet: true,
          showOnBlock: true,
          isSpecialAttack: false,
          isSpecialQuality: true
        });
      }

      let allFeatures = Array.from(featuresMap.values());
      
      let totalLevel = this.character.levels.length;
      let charType = this.character.type || 'PC';
      let budget = 0;

      if (charType === 'PC' && totalLevel === 1) {
        let lvl1 = this.character.levels[0];
        let clsA = lvl1 ? this.rules.classes[lvl1.trackA] : null;
        let clsB = lvl1 ? this.rules.classes[lvl1.trackB] : null;
        let goldA = clsA ? (clsA.startingGold || 0) : 0;
        let goldB = clsB ? (clsB.startingGold || 0) : 0;
        budget = Math.max(goldA, goldB);
      } else {
        if (this.rules.wbl && this.rules.wbl[charType]) {
          budget = this.rules.wbl[charType][totalLevel] || 0;
        }
      }

      let baseAc = 10;
      let armorBonus = 0;
      let shieldBonus = 0;
      let maxDex = 99;
      
      let bodyArmorIndex = this.character.equipped.chakras.Body;
      if (bodyArmorIndex !== -1 && bodyArmorIndex !== '') {
         let armor = this.character.armor[bodyArmorIndex];
         if (armor) {
           armorBonus = armor.acBonus || 0;
           if (armor.maxDex !== 99 && armor.maxDex !== undefined && armor.maxDex !== null) {
             maxDex = armor.maxDex;
           }
         }
      }
      
      let firstWeaponSet = this.character.equipped.weapons[0];
      if (firstWeaponSet && firstWeaponSet.offhand !== -1 && firstWeaponSet.offhand !== '') {
         // Offhand dropdown can select a shield from armor inventory or a weapon from weapons inventory.
         // We prefix armor index with 'a_' and weapon with 'w_' in the UI.
         let offVal = firstWeaponSet.offhand;
         if (typeof offVal === 'string' && offVal.startsWith('a_')) {
           let idx = parseInt(offVal.substring(2));
           let offItem = this.character.armor[idx];
           if (offItem && offItem.category === 'Shield') {
             shieldBonus = offItem.acBonus || 0;
           }
         }
      }

      let dexMod = this.getAbilityMod('dex');
      let initiativeBonus = this.getFeatCount('Improved Initiative') > 0 ? 4 : 0;
      let cappedDex = Math.min(dexMod, maxDex);
      
      const sizeMods = { "Fine": 8, "Diminutive": 4, "Tiny": 2, "Small": 1, "Medium": 0, "Large": -1, "Huge": -2, "Gargantuan": -4, "Colossal": -8 };
      let sizeMod = sizeMods[this.characterSize] || 0;

      let totalAc = baseAc + armorBonus + shieldBonus + cappedDex + sizeMod;
      let touchAc = baseAc + cappedDex + sizeMod;
      let flatAc = baseAc + armorBonus + shieldBonus + sizeMod;

      return {
        hp: Math.max(1, hp),
        bab: Math.floor(Math.max(babA, babB)),
        skillPoints: skillPoints,
        budget: budget,
        classLevels: classLevels,
        features: allFeatures.filter(f => f.showOnSheet),
        allFeatures: allFeatures,
        saves: {
          fort: Math.floor(baseSaves.fort) + this.getAbilityMod('con') + divineGrace,
          ref: Math.floor(baseSaves.ref) + this.getAbilityMod('dex') + divineGrace,
          will: Math.floor(baseSaves.will) + this.getAbilityMod('wis') + divineGrace
        },
        initiative: dexMod + initiativeBonus,
        ac: {
          total: totalAc,
          touch: touchAc,
          flat: flatAc,
          armorBonus: armorBonus,
          shieldBonus: shieldBonus,
          dexBonus: cappedDex,
          sizeMod: sizeMod
        }
      };
    },
    preparedCasters() {
      if (!this.rules.classes || Object.keys(this.rules.classes).length === 0) return [];
      let activeClasses = new Set();
      this.character.levels.forEach(lvl => {
         if (lvl.trackA) activeClasses.add(lvl.trackA);
         if (lvl.trackB) activeClasses.add(lvl.trackB);
      });
      let casters = [];
      activeClasses.forEach(c => {
         let clsData = this.rules.classes[c];
         if (clsData && clsData.spellSlots && clsData.castingType !== 'spontaneous' && this.classSlots(c).length > 0) casters.push(c);
      });
      return casters;
    },
    spontaneousCasters() {
      if (!this.rules.classes || Object.keys(this.rules.classes).length === 0) return [];
      let activeClasses = new Set();
      this.character.levels.forEach(lvl => {
         if (lvl.trackA) activeClasses.add(lvl.trackA);
         if (lvl.trackB) activeClasses.add(lvl.trackB);
      });
      let casters = [];
      activeClasses.forEach(c => {
         let clsData = this.rules.classes[c];
         if (clsData && clsData.castingType === 'spontaneous' && clsData.spellsKnown && this.classKnownSlots(c).length > 0) casters.push(c);
      });
      return casters;
    },
    spellcastingClasses() {
      return [...new Set([...this.preparedCasters, ...this.spontaneousCasters])];
    },
    hasRangerLevel() {
      return this.classLevel('Ranger') > 0;
    },
    hasWizardLevel() {
      return this.classLevel('Wizard') > 0;
    },
    hasRogueLevel() {
      return this.classLevel('Rogue') > 0;
    },
    rogueSpecialSlots() {
      let rogueLevel = this.classLevel('Rogue');
      return [10, 13, 16, 19].filter(level => rogueLevel >= level);
    },
    rogueSpecialAbilityOptions() {
      return [
        'Crippling Strike',
        'Defensive Roll',
        'Improved Evasion',
        'Opportunist',
        'Skill Mastery',
        'Slippery Mind',
        'Feat'
      ];
    },
    rogueSkillMasterySlots() {
      let count = (this.character.rogueSpecialAbilities || []).filter(ability => ability === 'Skill Mastery').length;
      return count * Math.max(0, 3 + this.getAbilityMod('int'));
    },
    wizardSpecialistName() {
      let names = {
        Abjuration: 'Abjurer',
        Conjuration: 'Conjurer',
        Divination: 'Diviner',
        Enchantment: 'Enchanter',
        Evocation: 'Evoker',
        Illusion: 'Illusionist',
        Necromancy: 'Necromancer',
        Transmutation: 'Transmuter'
      };
      return names[this.character.wizardSpecialization] || 'Wizard';
    },
    wizardRequiredProhibitedSchoolCount() {
      if (!this.character.wizardSpecialization) return 0;
      return this.character.wizardSpecialization === 'Divination' ? 1 : 2;
    },
    wizardProhibitedSchoolOptions() {
      return this.schoolList.filter(s => s !== 'Divination' && s !== this.character.wizardSpecialization);
    },
    wizardSpellbookSlots() {
      let wizardLevel = this.classLevel('Wizard');
      if (wizardLevel <= 0) return [];

      let slots = [];
      let intBonus = Math.max(0, this.getAbilityMod('int'));
      slots.push({ source: 'Level 1 spellbook', level: 1, maxSpellLevel: 1, total: 3 + intBonus });

      for (let lvl = 2; lvl <= wizardLevel; lvl++) {
        slots.push({
          source: `Wizard level ${lvl}`,
          level: lvl,
          maxSpellLevel: this.getWizardMaxSpellLevelForClassLevel(lvl),
          total: 2
        });
      }

      return slots;
    },
    wizardMaxSpellLevel() {
      return this.getWizardMaxSpellLevelForClassLevel(this.classLevel('Wizard'));
    },
    wizardSpellMasterySlots() {
      return Math.max(0, this.getAbilityMod('int')) * this.getFeatCount('Spell Mastery');
    },
    wizardSpellbookCost() {
      return (this.character.wizardPurchasedSpells || []).reduce((total, entry) => {
        if (!entry || !entry.spell) return total;
        return total + this.getWizardPurchasedSpellCost(entry.spell);
      }, 0);
    },
    rangerFavoredEnemySlots() {
      let rangerLevel = this.classLevel('Ranger');
      return [1, 5, 10, 15, 20].filter(level => rangerLevel >= level);
    },
    rangerFavoredEnemyOptions() {
      let clsData = this.rules.classes ? this.rules.classes['Ranger'] : null;
      return clsData && clsData.favoredEnemyOptions ? clsData.favoredEnemyOptions : [];
    },
    rangerFavoredEnemyBonuses() {
      let bonuses = {};
      this.rangerFavoredEnemySlots.forEach((slotLevel, idx) => {
        let choice = this.character.rangerFavoredEnemies[idx] || {};
        if (choice.enemy) {
          bonuses[choice.enemy] = (bonuses[choice.enemy] || 0) + 2;
        }
        if (idx > 0 && choice.increase) {
          bonuses[choice.increase] = (bonuses[choice.increase] || 0) + 2;
        }
      });
      return Object.keys(bonuses).sort().map(enemy => ({ enemy, bonus: bonuses[enemy] }));
    },
    skillPools() {
      if (!this.rules.classes || Object.keys(this.rules.classes).length === 0) return [];
      
      let poolsMap = new Map();
      let humanSkillBonus = 0;
      let raceData = this.rules.races[this.character.race];
      if (raceData && raceData.features) {
        let hasExtraSkillPoints = raceData.features.some(f => {
          let name = typeof f === 'string' ? f : f.name;
          return name === "Extra Skill Points";
        });
        if (hasExtraSkillPoints) humanSkillBonus = 1;
      }
      let intMod = this.getAbilityMod('int');

      this.character.levels.forEach((lvl, index) => {
        let clsA = this.rules.classes[lvl.trackA];
        let clsB = this.rules.classes[lvl.trackB];
        let names = [];
        if (clsA) names.push(lvl.trackA);
        if (clsB && lvl.trackA !== lvl.trackB) names.push(lvl.trackB);
        names.sort();
        if (names.length === 0) return;
        let poolName = names.join(' / ');

        let spA = clsA ? clsA.skillPoints : 0;
        let spB = clsB ? clsB.skillPoints : 0;
        let bestSp = Math.max(spA, spB);
        let pts = 0;
        if (bestSp > 0) {
          let levelPoints = Math.max(1, bestSp + intMod) + humanSkillBonus;
          pts = (index === 0) ? levelPoints * 4 : levelPoints;
        }

        if (!poolsMap.has(poolName)) {
          let classSkills = new Set();
          if (clsA && clsA.classSkills) clsA.classSkills.forEach(s => classSkills.add(s));
          if (clsB && clsB.classSkills) clsB.classSkills.forEach(s => classSkills.add(s));
          poolsMap.set(poolName, { name: poolName, total: 0, classSkills: Array.from(classSkills) });
        }
        poolsMap.get(poolName).total += pts;
      });

      let pools = Array.from(poolsMap.values());
      pools.forEach(p => p.spent = 0);
      
      this.character.skillAllocations.forEach(alloc => {
        let p = pools.find(pool => pool.name === alloc.pool);
        if (p) {
          p.spent += (Number(alloc.points) || 0);
        }
      });
      
      pools.forEach(p => p.remaining = p.total - p.spent);

      return pools;
    },
    calculatedSkills() {
      let ranksMap = new Map();
      
      this.character.skillAllocations.forEach(alloc => {
        if (!alloc.skill) return;
        let pool = this.skillPools.find(p => p.name === alloc.pool);
        if (!pool) return;
        let isClassSkillObj = this.isClassSkill(alloc.skill, pool.name);
        let pts = Number(alloc.points) || 0;
        let ranksGained = isClassSkillObj ? pts : pts / 2;
        
        let key = alloc.skill;
        if (this.rules.skills && this.rules.skills[alloc.skill] && this.rules.skills[alloc.skill].hasSpecialization) {
          key += ':' + (alloc.spec || '');
        }

        if (!ranksMap.has(key)) {
          ranksMap.set(key, 0);
        }
        ranksMap.set(key, ranksMap.get(key) + ranksGained);
      });
      
      return ranksMap;
    }
  },
  watch: {
    'character.levels': {
      handler() {
        this.syncPreparedSpellClasses();
        this.syncPreparedSpellArrays();
        this.syncKnownSpellClasses();
        this.syncKnownSpellArrays();
        this.syncRangerChoices();
        this.syncWizardChoices();
        this.syncRogueChoices();
      },
      deep: true,
      immediate: true
    },
    'character.baseAbilities': {
      handler() {
        this.syncPreparedSpellArrays();
        this.syncKnownSpellArrays();
        this.syncWizardChoices();
        this.syncRogueChoices();
      },
      deep: true
    },
    'character.wizardSpecialization': {
      handler() {
        this.syncPreparedSpellArrays();
        this.syncWizardChoices();
      }
    },
    'character.wizardProhibitedSchools': {
      handler() {
        this.syncPreparedSpellArrays();
      },
      deep: true
    },
    'character.equipped.weapons': {
      handler(newWeapons) {
        newWeapons.forEach(ws => {
          if (this.isTwoHandedWield(ws)) {
            if (ws.offhand !== -1) {
              ws.offhand = -1;
            }
          }
        });
      },
      deep: true
    }
  },
  methods: {
    getClassDisplayName(className) {
      if (className === 'Wizard' && this.character.wizardSpecialization) {
        return this.wizardSpecialistName;
      }
      return className;
    },
    isFeatAllowedForBonusTag(featName, tag) {
      if (tag === 'humanBonusFeat') return true;
      let feat = this.rules.feats[featName];
      if (!feat) return false;
      if (tag === 'wizardBonusFeat') {
        return feat.type === 'Metamagic' || feat.type === 'Item Creation' || featName === 'Spell Mastery';
      }
      return !!feat[tag];
    },
    syncRangerChoices() {
      if (!this.character.rangerFavoredEnemies) {
        this.$set(this.character, 'rangerFavoredEnemies', []);
      }

      let slots = this.rangerFavoredEnemySlots;
      while (this.character.rangerFavoredEnemies.length < slots.length) {
        this.character.rangerFavoredEnemies.push({ enemy: '', increase: '' });
      }
      while (this.character.rangerFavoredEnemies.length > slots.length) {
        this.character.rangerFavoredEnemies.pop();
      }

      this.character.rangerFavoredEnemies.forEach((choice, idx) => {
        if (!choice) {
          this.$set(this.character.rangerFavoredEnemies, idx, { enemy: '', increase: '' });
          return;
        }
        if (typeof choice.enemy === 'undefined') this.$set(choice, 'enemy', '');
        if (typeof choice.increase === 'undefined') this.$set(choice, 'increase', '');
        if (idx === 0 && choice.increase) choice.increase = '';
        if (choice.enemy && !this.rangerFavoredEnemyOptions.includes(choice.enemy)) choice.enemy = '';
        if (choice.increase && !this.getRangerFavoredEnemyIncreaseOptions(idx).includes(choice.increase)) {
          choice.increase = '';
        }
      });

      if (this.classLevel('Ranger') < 2 && this.character.rangerCombatStyle) {
        this.character.rangerCombatStyle = '';
      }
    },
    getRangerFavoredEnemyIncreaseOptions(slotIndex) {
      let options = [];
      for (let i = 0; i <= slotIndex; i++) {
        let choice = this.character.rangerFavoredEnemies[i];
        if (choice && choice.enemy && !options.includes(choice.enemy)) {
          options.push(choice.enemy);
        }
      }
      return options.sort();
    },
    formatRangerCombatStyle(style) {
      if (style === 'archery') return 'Archery';
      if (style === 'twoWeapon') return 'Two-Weapon Combat';
      return '';
    },
    getRangerCombatStyleFeat(rangerLevel) {
      let style = this.character.rangerCombatStyle;
      if (!style) return 'choice pending';
      if (style === 'archery') {
        if (rangerLevel >= 11) return 'Improved Precise Shot';
        if (rangerLevel >= 6) return 'Manyshot';
        return 'Rapid Shot';
      }
      if (style === 'twoWeapon') {
        if (rangerLevel >= 11) return 'Greater Two-Weapon Fighting';
        if (rangerLevel >= 6) return 'Improved Two-Weapon Fighting';
        return 'Two-Weapon Fighting';
      }
      return 'choice pending';
    },
    syncRogueChoices() {
      if (!this.character.rogueSpecialAbilities) this.$set(this.character, 'rogueSpecialAbilities', []);
      if (!this.character.rogueSkillMastery) this.$set(this.character, 'rogueSkillMastery', []);

      if (!this.hasRogueLevel) {
        this.character.rogueSpecialAbilities.splice(0);
        this.character.rogueSkillMastery.splice(0);
        return;
      }

      let slots = this.rogueSpecialSlots;
      while (this.character.rogueSpecialAbilities.length < slots.length) this.character.rogueSpecialAbilities.push('');
      while (this.character.rogueSpecialAbilities.length > slots.length) this.character.rogueSpecialAbilities.pop();
      this.character.rogueSpecialAbilities.forEach((ability, idx) => {
        if (ability && !this.rogueSpecialAbilityOptions.includes(ability)) {
          this.$set(this.character.rogueSpecialAbilities, idx, '');
        }
      });

      while (this.character.rogueSkillMastery.length < this.rogueSkillMasterySlots) this.character.rogueSkillMastery.push('');
      while (this.character.rogueSkillMastery.length > this.rogueSkillMasterySlots) this.character.rogueSkillMastery.pop();
      this.character.rogueSkillMastery.forEach((skill, idx) => {
        if (skill && !this.getRogueSkillMasteryOptions(idx).includes(skill)) {
          this.$set(this.character.rogueSkillMastery, idx, '');
        }
      });
    },
    getRogueSkillMasteryOptions(currentIndex) {
      let selected = new Set((this.character.rogueSkillMastery || []).filter((skill, idx) => skill && idx !== currentIndex));
      return this.skillList.filter(skill => !selected.has(skill));
    },
    getRogueSpecialAbilityDescription(ability) {
      const descriptions = {
        'Crippling Strike': 'A successful sneak attack also deals 2 points of Strength damage.',
        'Defensive Roll': 'Once per day, attempt a Reflex save to take half damage from a blow that would reduce the rogue to 0 or fewer hit points.',
        'Improved Evasion': 'Take no damage on a successful Reflex save, and half damage on a failed Reflex save, against effects that allow Reflex half.',
        'Opportunist': 'Once per round, make an attack of opportunity against an opponent just damaged in melee by another character.',
        'Skill Mastery': 'May take 10 with selected skills even when stress and distractions would normally prevent it.',
        'Slippery Mind': 'After failing a save against an enchantment effect, attempt the saving throw again 1 round later at the same DC.',
        'Feat': 'Gain a bonus feat in place of a rogue special ability.'
      };
      return descriptions[ability] || '';
    },
    getStackedProgressionTotal(classLevels, progressionKey) {
      let total = 0;
      Object.entries(classLevels || {}).forEach(([className, level]) => {
        let clsData = this.rules.classes[className];
        let progression = clsData ? clsData[progressionKey] : null;
        if (!progression) return;
        let value = 0;
        Object.entries(progression).forEach(([threshold, amount]) => {
          if (level >= Number(threshold)) value = Math.max(value, Number(amount) || 0);
        });
        total += value;
      });
      return total;
    },
    getUncannyDodgeState(classLevels) {
      let uncannySources = 0;
      let improvedSources = 0;
      let effectiveLevel = 0;
      Object.entries(classLevels || {}).forEach(([className, level]) => {
        let clsData = this.rules.classes[className];
        let progression = clsData ? clsData.uncannyDodgeProgression : null;
        if (!progression) return;
        if (level >= (progression.uncanny || 999)) {
          uncannySources++;
          effectiveLevel += level;
        }
        if (level >= (progression.improved || 999)) {
          improvedSources++;
        }
      });
      return {
        hasUncanny: uncannySources > 0,
        hasImproved: improvedSources > 0 || uncannySources >= 2,
        effectiveLevel: effectiveLevel
      };
    },
    syncWizardChoices() {
      if (!this.character.wizardProhibitedSchools) this.$set(this.character, 'wizardProhibitedSchools', []);
      if (!this.character.wizardSpellbookSelections) this.$set(this.character, 'wizardSpellbookSelections', []);
      if (!this.character.wizardPurchasedSpells) this.$set(this.character, 'wizardPurchasedSpells', []);
      if (!this.character.wizardSpellMastery) this.$set(this.character, 'wizardSpellMastery', []);

      if (!this.hasWizardLevel) {
        if (this.character.wizardSpecialization) this.character.wizardSpecialization = '';
        this.character.wizardProhibitedSchools.splice(0);
        this.character.wizardSpellbookSelections.splice(0);
        this.character.wizardPurchasedSpells.splice(0);
        this.character.wizardSpellMastery.splice(0);
        return;
      }

      if (this.character.wizardSpecialization && !this.schoolList.includes(this.character.wizardSpecialization)) {
        this.character.wizardSpecialization = '';
      }

      let required = this.wizardRequiredProhibitedSchoolCount;
      while (this.character.wizardProhibitedSchools.length < required) this.character.wizardProhibitedSchools.push('');
      while (this.character.wizardProhibitedSchools.length > required) this.character.wizardProhibitedSchools.pop();
      this.character.wizardProhibitedSchools.forEach((school, idx) => {
        if (school && !this.wizardProhibitedSchoolOptions.includes(school)) {
          this.$set(this.character.wizardProhibitedSchools, idx, '');
        }
      });

      let slots = this.wizardSpellbookSlots;
      while (this.character.wizardSpellbookSelections.length < slots.length) {
        this.character.wizardSpellbookSelections.push([]);
      }
      while (this.character.wizardSpellbookSelections.length > slots.length) {
        this.character.wizardSpellbookSelections.pop();
      }
      this.character.wizardSpellbookSelections.forEach((slotSpells, idx) => {
        if (!Array.isArray(slotSpells)) {
          this.$set(this.character.wizardSpellbookSelections, idx, []);
          slotSpells = this.character.wizardSpellbookSelections[idx];
        }
        while (slotSpells.length < slots[idx].total) slotSpells.push('');
        while (slotSpells.length > slots[idx].total) slotSpells.pop();
        slotSpells.forEach((spell, spellIdx) => {
          if (spell && !this.getWizardSpellOptionsForSpellbookSlot(slots[idx].maxSpellLevel, idx, spellIdx).includes(spell)) {
            this.$set(slotSpells, spellIdx, '');
          }
        });
      });

      this.character.wizardPurchasedSpells.forEach((entry, idx) => {
        if (entry && entry.spell && !this.getWizardSpellOptionsForPurchasedSpell(idx).includes(entry.spell)) entry.spell = '';
      });

      while (this.character.wizardSpellMastery.length < this.wizardSpellMasterySlots) this.character.wizardSpellMastery.push('');
      while (this.character.wizardSpellMastery.length > this.wizardSpellMasterySlots) this.character.wizardSpellMastery.pop();
      let masteryOptions = this.getWizardKnownSpellNames();
      this.character.wizardSpellMastery.forEach((spell, idx) => {
        if (spell && !masteryOptions.includes(spell)) this.$set(this.character.wizardSpellMastery, idx, '');
      });
    },
    getWizardMaxSpellLevelForClassLevel(wizardLevel) {
      let clsData = this.rules.classes['Wizard'];
      if (!clsData || !clsData.spellSlots) return 0;
      let slots = clsData.spellSlots[wizardLevel] || [];
      let maxLevel = 0;
      slots.forEach((count, idx) => {
        if (count > 0) maxLevel = idx;
      });
      return maxLevel;
    },
    getWizardSpellOptions(maxSpellLevel) {
      let spells = [];
      let allWizardSpells = this.classSpells('Wizard');
      for (let level = 0; level <= maxSpellLevel; level++) {
        (allWizardSpells[level] || []).forEach(spell => spells.push(spell));
      }
      return spells.sort();
    },
    getWizardSpellOptionsForSpellbookSlot(maxSpellLevel, slotIndex, spellIndex) {
      let current = this.character.wizardSpellbookSelections
        && this.character.wizardSpellbookSelections[slotIndex]
        ? this.character.wizardSpellbookSelections[slotIndex][spellIndex]
        : '';
      return this.getWizardSpellOptions(maxSpellLevel).filter(spell => {
        return spell === current || !this.isWizardSpellAlreadyKnownElsewhere(spell, { type: 'spellbook', slotIndex, spellIndex });
      });
    },
    getWizardSpellOptionsForPurchasedSpell(purchaseIndex) {
      let currentEntry = this.character.wizardPurchasedSpells ? this.character.wizardPurchasedSpells[purchaseIndex] : null;
      let current = currentEntry ? currentEntry.spell : '';
      return this.getWizardSpellOptions(this.wizardMaxSpellLevel).filter(spell => {
        return spell === current || !this.isWizardSpellAlreadyKnownElsewhere(spell, { type: 'purchase', purchaseIndex });
      });
    },
    isWizardSpellAlreadyKnownElsewhere(spellName, currentSlot) {
      if (!spellName) return false;
      if (this.getWizardAutomaticZeroSpells().includes(spellName)) return true;

      let selections = this.character.wizardSpellbookSelections || [];
      for (let slotIndex = 0; slotIndex < selections.length; slotIndex++) {
        let slotSpells = selections[slotIndex] || [];
        for (let spellIndex = 0; spellIndex < slotSpells.length; spellIndex++) {
          if (currentSlot && currentSlot.type === 'spellbook' && currentSlot.slotIndex === slotIndex && currentSlot.spellIndex === spellIndex) continue;
          if (slotSpells[spellIndex] === spellName) return true;
        }
      }

      let purchases = this.character.wizardPurchasedSpells || [];
      for (let purchaseIndex = 0; purchaseIndex < purchases.length; purchaseIndex++) {
        if (currentSlot && currentSlot.type === 'purchase' && currentSlot.purchaseIndex === purchaseIndex) continue;
        if (purchases[purchaseIndex] && purchases[purchaseIndex].spell === spellName) return true;
      }

      return false;
    },
    getWizardSpellOptionGroups(maxSpellLevel, spellOptions) {
      let options = [];
      let allWizardSpells = this.classSpells('Wizard');
      let allowed = spellOptions ? new Set(spellOptions) : null;
      for (let level = 0; level <= maxSpellLevel; level++) {
        let spells = (allWizardSpells[level] || []).filter(spell => !allowed || allowed.has(spell));
        if (spells.length === 0) continue;
        options.push({
          type: 'label',
          value: `level_${level}`,
          label: this.formatSpellLevelLabel(level)
        });
        spells.forEach(spell => {
          options.push({
            type: 'spell',
            value: spell,
            label: spell,
            cost: this.getWizardPurchasedSpellCost(spell)
          });
        });
      }
      return options;
    },
    formatSpellLevelLabel(level) {
      if (level === 0) return '0th Level';
      if (level === 1) return '1st Level';
      if (level === 2) return '2nd Level';
      if (level === 3) return '3rd Level';
      return `${level}th Level`;
    },
    getWizardKnownSpellsByLevel() {
      let known = {};
      this.getWizardAutomaticZeroSpells().forEach(spell => {
        if (!known[0]) known[0] = [];
        if (!known[0].includes(spell)) known[0].push(spell);
      });

      (this.character.wizardSpellbookSelections || []).forEach(slotSpells => {
        (slotSpells || []).forEach(spell => {
          let level = this.getSpellLevelForClass(spell, 'Wizard');
          if (level < 0) return;
          if (!known[level]) known[level] = [];
          if (!known[level].includes(spell)) known[level].push(spell);
        });
      });

      (this.character.wizardPurchasedSpells || []).forEach(entry => {
        if (!entry || !entry.spell) return;
        let level = this.getSpellLevelForClass(entry.spell, 'Wizard');
        if (level < 0) return;
        if (!known[level]) known[level] = [];
        if (!known[level].includes(entry.spell)) known[level].push(entry.spell);
      });

      Object.keys(known).forEach(level => known[level].sort());
      return known;
    },
    getWizardKnownSpellNames() {
      let byLevel = this.getWizardKnownSpellsByLevel();
      return Object.keys(byLevel).sort((a, b) => Number(a) - Number(b)).flatMap(level => byLevel[level]);
    },
    getWizardAutomaticZeroSpells() {
      return [
        'Resistance',
        'Acid Splash',
        'Detect Poison',
        'Detect Magic',
        'Read Magic',
        'Daze',
        'Dancing Lights',
        'Flare',
        'Light',
        'Ray of Frost',
        'Ghost Sound',
        'Disrupt Undead',
        'Touch of Fatigue',
        'Mage Hand',
        'Mending',
        'Message',
        'Open/Close',
        'Arcane Mark',
        'Prestidigitation'
      ].filter(spell => this.isSpellAllowedForClass(spell, 'Wizard'));
    },
    addWizardPurchasedSpell() {
      if (!this.character.wizardPurchasedSpells) this.$set(this.character, 'wizardPurchasedSpells', []);
      this.character.wizardPurchasedSpells.push({ spell: '' });
    },
    removeWizardPurchasedSpell(index) {
      this.character.wizardPurchasedSpells.splice(index, 1);
    },
    getWizardPurchasedSpellCost(spellName) {
      let spellLevel = this.getSpellLevelForClass(spellName, 'Wizard');
      if (spellLevel < 0) return 0;
      return (spellLevel === 0 ? 0.5 : spellLevel) * 150;
    },
    syncPreparedSpellClasses() {
      if (!this.rules.classes || Object.keys(this.rules.classes).length === 0) return;
      let activeClasses = new Set();
      this.character.levels.forEach(lvl => {
         if (lvl.trackA) activeClasses.add(lvl.trackA);
         if (lvl.trackB) activeClasses.add(lvl.trackB);
      });
      activeClasses.forEach(c => {
         let clsData = this.rules.classes[c];
         if (clsData && clsData.spellSlots && clsData.castingType !== 'spontaneous') {
            if (!this.character.preparedSpells[c]) {
               this.$set(this.character.preparedSpells, c, { '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], '8': [], '9': [] });
            }
         }
      });
      Object.keys(this.character.preparedSpells).forEach(c => {
         if (!activeClasses.has(c)) {
            this.$delete(this.character.preparedSpells, c);
            if (this.character.preparedDomainSpells && this.character.preparedDomainSpells[c]) {
              this.$delete(this.character.preparedDomainSpells, c);
            }
         }
      });
    },
    syncPreparedSpellArrays() {
      if (!this.character.preparedSpells) return;
      this.preparedCasters.forEach(c => {
        if (!this.character.preparedSpells[c]) return;
        let slots = this.classSlots(c);
        if (!this.character.preparedDomainSpells) {
          this.$set(this.character, 'preparedDomainSpells', {});
        }
        if (!this.character.preparedDomainSpells[c]) {
          this.$set(this.character.preparedDomainSpells, c, { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '', '9': '' });
        }
        slots.forEach(slotInfo => {
          let prep = this.character.preparedSpells[c][slotInfo.level];
          if (!prep) {
            this.$set(this.character.preparedSpells[c], slotInfo.level, []);
            prep = this.character.preparedSpells[c][slotInfo.level];
          }
          while (prep.length < slotInfo.total) {
            prep.push('');
          }
          while (prep.length > slotInfo.total) {
            prep.pop();
          }
          prep.forEach((spell, idx) => {
            if (spell && !this.getSortedPreparedSpellOptions(c, slotInfo.level, idx, slotInfo).includes(spell)) {
              this.$set(prep, idx, '');
            }
          });
          
          if (slotInfo.hasDomainSlot && typeof this.character.preparedDomainSpells[c][slotInfo.level] === 'undefined') {
            this.$set(this.character.preparedDomainSpells[c], slotInfo.level, '');
          }
        });
      });
    },
    syncKnownSpellClasses() {
      if (!this.rules.classes || Object.keys(this.rules.classes).length === 0) return;
      let activeClasses = new Set();
      this.character.levels.forEach(lvl => {
         if (lvl.trackA) activeClasses.add(lvl.trackA);
         if (lvl.trackB) activeClasses.add(lvl.trackB);
      });
      activeClasses.forEach(c => {
         let clsData = this.rules.classes[c];
         if (clsData && clsData.spellsKnown) {
            if (!this.character.knownSpells[c]) {
               this.$set(this.character.knownSpells, c, { '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], '8': [], '9': [] });
            }
         }
      });
      Object.keys(this.character.knownSpells).forEach(c => {
         if (!activeClasses.has(c)) {
            this.$delete(this.character.knownSpells, c);
         }
      });
    },
    syncKnownSpellArrays() {
      if (!this.character.knownSpells) return;
      this.spontaneousCasters.forEach(c => {
        if (!this.character.knownSpells[c]) return;
        let slots = this.classKnownSlots(c);
        slots.forEach(slotInfo => {
          let known = this.character.knownSpells[c][slotInfo.level];
          if (!known) {
            this.$set(this.character.knownSpells[c], slotInfo.level, []);
            known = this.character.knownSpells[c][slotInfo.level];
          }
          while (known.length < slotInfo.total) {
            known.push('');
          }
          while (known.length > slotInfo.total) {
            known.pop();
          }
        });
      });
    },
    classLevel(className) {
      let lvlCount = 0;
      this.character.levels.forEach(lvl => {
        if (lvl.trackA === className) lvlCount++;
        else if (lvl.trackB === className) lvlCount++;
      });
      return lvlCount;
    },
    classSpells(className) {
      let result = {};
      let clsData = this.rules.classes[className] || {};
      let spellListNames = clsData.spellListAliases || [className];
      for (const [spellName, spellData] of Object.entries(this.rules.spells)) {
        if (!spellData.level) continue;
        let match = null;
        for (let spellListName of spellListNames) {
          let escapedName = String(spellListName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          let regex = new RegExp(escapedName + '\\s+(\\d+)', 'i');
          match = spellData.level.match(regex);
          if (match) break;
        }
        if (match) {
          let lvl = parseInt(match[1]);
          if (!this.isSpellAllowedForClass(spellName, className)) continue;
          if (!result[lvl]) result[lvl] = [];
          result[lvl].push(spellName);
        }
      }
      for (let lvl in result) result[lvl].sort();
      return result;
    },
    getSpellLevelForClass(spellName, className) {
      let spellData = this.rules.spells[spellName];
      let clsData = this.rules.classes[className] || {};
      if (!spellData || !spellData.level) return -1;
      let spellListNames = clsData.spellListAliases || [className];
      for (let spellListName of spellListNames) {
        let escapedName = String(spellListName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let regex = new RegExp(escapedName + '\\s+(\\d+)', 'i');
        let match = spellData.level.match(regex);
        if (match) return parseInt(match[1]);
      }
      return -1;
    },
    isSpellAllowedForClass(spellName, className) {
      if (className !== 'Wizard') return true;
      let spellData = this.rules.spells[spellName];
      if (!spellData) return false;
      let prohibited = this.character.wizardSpecialization ? (this.character.wizardProhibitedSchools || []) : [];
      if (!prohibited.length) return true;
      return !prohibited.includes(spellData.school);
    },
    getAvailableDomainSpells(level) {
      if (!this.character.domains) return [];
      let spellsSet = new Set();
      this.character.domains.forEach(d => {
        if (!d) return;
        // Escape the domain name just in case
        let escapedDomain = d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let regex = new RegExp(escapedDomain + '\\s+' + level + '(?!\\d)', 'i');
        for (const [spellName, spellData] of Object.entries(this.rules.spells)) {
          if (!spellData.level) continue;
          if (spellData.level.match(regex)) {
            spellsSet.add(spellName);
          }
        }
      });
      return Array.from(spellsSet).sort();
    },
    classSlots(className) {
      let lvl = this.classLevel(className);
      if (lvl === 0) return [];
      let rules = this.rules.classes[className];
      if (!rules || !rules.spellSlots) return [];
      let base = rules.spellSlots[lvl] || [];
      let spellSlotStart = rules.spellSlotStart || 0;
      
      let castingStat = rules.spellSlotStat || 'wis'; // Default to wisdom if undefined
      let score = this.getTotalAbility(castingStat);
      let mod = this.getAbilityMod(castingStat);
      
      let slots = [];
      for (let l = 0; l < base.length; l++) {
        let spellLevel = l + spellSlotStart;
        let baseCount = base[l];
        let canCast = score >= (10 + spellLevel);
        let bonus = 0;
        if (canCast && spellLevel > 0 && mod >= spellLevel) {
          bonus = Math.floor((mod - spellLevel) / 4) + 1;
        }
        let specialistBonus = (className === 'Wizard' && this.character.wizardSpecialization && canCast) ? 1 : 0;
        slots.push({
          level: spellLevel,
          base: baseCount,
          bonus: bonus,
          specialistBonus: specialistBonus,
          total: canCast ? (baseCount + bonus + specialistBonus) : 0,
          canCast: canCast,
          requiredScore: 10 + spellLevel,
          statName: castingStat,
          hasDomainSlot: (rules.hasDomainSlots && spellLevel > 0 && canCast)
        });
      }
      return slots;
    },
    classKnownSlots(className) {
      let lvl = this.classLevel(className);
      if (lvl === 0) return [];
      let rules = this.rules.classes[className];
      if (!rules || !rules.spellsKnown || !rules.spellSlots) return [];
      let known = rules.spellsKnown[lvl] || [];
      
      let castingStat = rules.spellSlotStat || 'cha';
      let score = this.getTotalAbility(castingStat);
      let mod = this.getAbilityMod(castingStat);
      
      let slots = [];
      let baseSlots = rules.spellSlots[lvl] || [];
      
      for (let l = 0; l < known.length; l++) {
        let knownCount = known[l];
        let canCast = score >= (10 + l);
        let baseCount = baseSlots[l] !== undefined ? baseSlots[l] : 0;
        let bonus = 0;
        if (canCast && l > 0 && mod >= l) {
          bonus = Math.floor((mod - l) / 4) + 1;
        }
        
        let actualKnown = 0;
        if (canCast) {
          if (baseCount === 0 && bonus === 0) {
            actualKnown = 0;
          } else {
            actualKnown = knownCount;
          }
        }
        
        slots.push({
          level: l,
          total: actualKnown
        });
      }
      return slots;
    },
    getSortedSpells(className, level) {
      let spells = className === 'Wizard'
        ? (this.getWizardKnownSpellsByLevel()[level] || [])
        : (this.classSpells(className)[level] || []);
      let prepared = this.character.preparedSpells[className] ? this.character.preparedSpells[className][level] || [] : [];
      return [...spells].sort((a, b) => {
        let aSelected = prepared.includes(a);
        let bSelected = prepared.includes(b);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return a.localeCompare(b);
      });
    },
    getSortedPreparedSpellOptions(className, level, slotIndex, slotInfo) {
      let spells = this.getSortedSpells(className, level);
      if (className === 'Wizard' && this.character.wizardSpecialization && slotInfo && slotInfo.specialistBonus > 0) {
        let specialistSlotStart = slotInfo.total - slotInfo.specialistBonus;
        if (slotIndex >= specialistSlotStart) {
          spells = spells.filter(spell => {
            let spellData = this.rules.spells[spell];
            return spellData && spellData.school === this.character.wizardSpecialization;
          });
        }
      }
      return spells;
    },
    isSpecialistPreparedSlot(className, slotIndex, slotInfo) {
      return className === 'Wizard'
        && this.character.wizardSpecialization
        && slotInfo
        && slotInfo.specialistBonus > 0
        && slotIndex >= (slotInfo.total - slotInfo.specialistBonus);
    },
    getSortedKnownSpells(className, level) {
      let spells = this.classSpells(className)[level] || [];
      let known = this.character.knownSpells[className] ? this.character.knownSpells[className][level] || [] : [];
      return [...spells].sort((a, b) => {
        let aSelected = known.includes(a);
        let bSelected = known.includes(b);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return a.localeCompare(b);
      });
    },
    getFeatCount(featName) {
      let count = 0;
      this.character.levels.forEach(level => {
        if (level.feat === featName) count++;
        if (level.bonusFeats) {
          Object.values(level.bonusFeats).forEach(f => {
            if (f === featName) count++;
          });
        }
      });
      return count;
    },
    getFeatParameterOptions(featName, levelIndex, bonusTag = null) {
      let feat = this.rules.feats[featName];
      if (!feat || !feat.requiresParameter) return [];

      if (feat.requiresParameter === 'weapon') return this.weaponList;
      if (feat.requiresParameter === 'skill') return this.skillList;
      if (feat.requiresParameter === 'school') return this.schoolList;
      if (feat.requiresParameter === 'exoticWeapon') {
        let currentValue = '';
        let level = this.character.levels[levelIndex];
        if (level) {
          currentValue = bonusTag
            ? (level.bonusFeatsParams && level.bonusFeatsParams[bonusTag]) || ''
            : level.featParam || '';
        }
        return this.getAvailableExoticWeaponProficiencyOptions(levelIndex, currentValue, bonusTag);
      }

      return [];
    },
    formatFeatParameterLabel(parameterType) {
      if (parameterType === 'exoticWeapon') return 'exotic weapon';
      return parameterType || 'option';
    },
    getAvailableExoticWeaponProficiencyOptions(levelIndex, currentValue = '', bonusTag = null) {
      if (!this.rules.weapons || !Array.isArray(this.rules.weapons)) return [];

      let proficiencies = this.getWeaponProficienciesUpToLevel(levelIndex, {
        levelIndex,
        bonusTag
      });

      return this.rules.weapons
        .filter(w => {
          if (!w || !w.name || w.category !== 'Exotic') return false;
          if (currentValue && w.name === currentValue) return true;
          let name = w.name.toLowerCase();
          let category = w.category ? w.category.toLowerCase() : '';
          return !proficiencies.has(name) && !proficiencies.has(category);
        })
        .map(w => w.name)
        .sort();
    },
    getWeaponProficienciesUpToLevel(levelIndex, exclude = {}) {
      let proficiencies = new Set();
      let raceData = this.rules.races[this.character.race];

      for (let i = 0; i <= levelIndex; i++) {
        let lvl = this.character.levels[i];
        if (!lvl) continue;

        let clsA = this.rules.classes[lvl.trackA];
        let clsB = this.rules.classes[lvl.trackB];
        if (clsA && clsA.weaponProficiencies) clsA.weaponProficiencies.forEach(p => proficiencies.add(p.toLowerCase()));
        if (clsB && clsB.weaponProficiencies) clsB.weaponProficiencies.forEach(p => proficiencies.add(p.toLowerCase()));
      }

      if (raceData && raceData.weaponProficiencies) {
        raceData.weaponProficiencies.forEach(p => proficiencies.add(p.toLowerCase()));
      }
      if (this.character.race === 'Elf') {
        ['longsword', 'rapier', 'longbow', 'composite longbow', 'shortbow', 'composite shortbow'].forEach(p => proficiencies.add(p));
      }

      for (let i = 0; i <= levelIndex; i++) {
        let lvl = this.character.levels[i];
        if (!lvl) continue;

        let featStrings = [];
        if (!(exclude.levelIndex === i && !exclude.bonusTag) && lvl.feat) {
          featStrings.push(lvl.featParam ? `${lvl.feat} (${lvl.featParam})` : lvl.feat);
        }
        if (lvl.bonusFeats) {
          Object.keys(lvl.bonusFeats).forEach(tag => {
            if (exclude.levelIndex === i && exclude.bonusTag === tag) return;
            let fName = lvl.bonusFeats[tag];
            if (!fName) return;
            let param = lvl.bonusFeatsParams && lvl.bonusFeatsParams[tag];
            featStrings.push(param ? `${fName} (${param})` : fName);
          });
        }
        this.getBonusFeatTags(i).forEach(tag => {
          if (this.rules.feats[tag] && !featStrings.some(f => f.startsWith(tag))) {
            let param = this.getFixedBonusFeatParam(i, tag);
            featStrings.push(param ? `${tag} (${param})` : tag);
          }
        });

        featStrings.forEach(feat => {
          let fLower = feat.toLowerCase();
          if (fLower === 'simple weapon proficiency') proficiencies.add('simple');
          if (fLower === 'martial weapon proficiency') proficiencies.add('martial');
          let m = fLower.match(/(martial|exotic) weapon proficiency \((.*?)\)/i);
          if (m) proficiencies.add(m[2].trim());
        });
      }

      return proficiencies;
    },
    featureMapKey(name) {
      let lower = String(name || '').toLowerCase();
      if (lower === 'summon familiar' || lower === 'familiar') return 'familiar';
      if (lower.startsWith('trap sense')) return 'trap sense';
      if (lower.startsWith('sneak attack')) return 'sneak attack';
      if (lower === 'uncanny dodge' || lower === 'improved uncanny dodge') return 'uncanny dodge';
      return lower;
    },
    parseCost(costStr) {
      if (!costStr || costStr === '—') return 0;
      let parts = costStr.trim().split(' ');
      if (parts.length < 2) return 0;
      let val = parseFloat(parts[0]);
      if (isNaN(val)) return 0;
      let unit = parts[1].toLowerCase();
      if (unit.startsWith('gp')) return val;
      if (unit.startsWith('sp')) return val / 10;
      if (unit.startsWith('cp')) return val / 100;
      return val;
    },
    formatGoldCost(amount) {
      let rounded = Math.round(amount * 100) / 100;
      return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)} gp`;
    },
    getWeaponMasterworkSurcharge(weapon) {
      if (!weapon || !weapon.masterwork) return 0;
      let rulesWeapon = this.rules.weapons.find(w => w.name === weapon.name);
      return (weapon.isDouble || (rulesWeapon && rulesWeapon.isDouble)) ? 600 : 300;
    },
    getWeaponCostValue(weapon) {
      if (!weapon) return 0;
      return this.parseCost(weapon.cost) + this.getWeaponMasterworkSurcharge(weapon);
    },
    getWeaponCostLabel(weapon) {
      if (!weapon) return '';
      let surcharge = this.getWeaponMasterworkSurcharge(weapon);
      if (!surcharge) return weapon.cost || '0 gp';
      return this.formatGoldCost(this.getWeaponCostValue(weapon));
    },
    getWeaponDisplayName(weapon) {
      if (!weapon) return '';
      return `${weapon.masterwork ? 'Masterwork ' : ''}${weapon.name}`;
    },
    setWeaponMasterwork(index, checked) {
      let weapon = this.character.weapons[index];
      if (weapon) this.$set(weapon, 'masterwork', checked);
    },
    getWeaponDamage(weapon, sizeOverride) {
      if (!weapon) return '-';
      let size = sizeOverride || weapon.size || this.characterSize;
      
      if (weapon.name === 'Unarmed strike') {
        let monkLevels = (this.calculatedStats && this.calculatedStats.classLevels && this.calculatedStats.classLevels['Monk']) || 0;
        if (monkLevels > 0) {
          let dmgSmall = ['1d4', '1d6', '1d8', '1d10', '2d6', '2d8'];
          let dmgLarge = ['1d8', '2d6', '2d8', '3d6', '3d8', '4d8'];
          let dmgMedium = ['1d6', '1d8', '1d10', '2d6', '2d8', '2d10'];
          
          let tier = 0;
          if (monkLevels >= 20) tier = 5;
          else if (monkLevels >= 16) tier = 4;
          else if (monkLevels >= 12) tier = 3;
          else if (monkLevels >= 8) tier = 2;
          else if (monkLevels >= 4) tier = 1;
          
          if (size === 'Small') return dmgSmall[tier];
          if (size === 'Large') return dmgLarge[tier];
          return dmgMedium[tier];
        }
      }
      
      if (typeof weapon.damage === 'object') {
        return weapon.damage[size] || '-';
      }
      return weapon.damage || '-';
    },
    buyWeapon(weapon) {
      let costStr = weapon.cost[this.characterSize] || '—';
      let dmgStr = weapon.damage[this.characterSize] || '—';
      
      this.character.weapons.push({
        name: weapon.name,
        size: this.characterSize,
        cost: costStr,
        damage: this.getWeaponDamage(weapon, this.characterSize),
        critical: weapon.critical,
        rangeIncrement: weapon.rangeIncrement,
        damageType: weapon.damageType,
        classification: weapon.classification,
        category: weapon.category,
        isDouble: !!weapon.isDouble,
        masterwork: false
      });
    },
    sellWeapon(index) {
      this.character.weapons.splice(index, 1);
    },
    buyArmor(armorItem) {
      let costStr = armorItem.scaledCost[this.characterSize] || '—';
      let weightStr = armorItem.scaledWeight[this.characterSize] || '—';
      
      this.character.armor.push({
        name: armorItem.name,
        category: armorItem.category,
        size: this.characterSize,
        cost: costStr,
        acBonus: armorItem.acBonus,
        maxDex: armorItem.maxDex,
        checkPenalty: armorItem.checkPenalty,
        spellFailure: armorItem.spellFailure,
        weight: weightStr
      });
    },
    sellArmor(index) {
      this.character.armor.splice(index, 1);
    },
    addWeaponSet() {
      this.character.equipped.weapons.push({ primary: -1, offhand: -1, wieldTwoHanded: false });
    },
    removeWeaponSet(index) {
      this.character.equipped.weapons.splice(index, 1);
    },
    isClassSkill(skillName, poolName) {
      if (!skillName || !poolName) return false;
      let pool = this.skillPools.find(p => p.name === poolName);
      if (!pool) return false;
      if (pool.classSkills.includes(skillName)) return true;
      
      // Check domains for extra class skills
      if (this.character.domains && this.rules.domains) {
        for (let d of this.character.domains) {
          let domainData = this.rules.domains[d];
          if (domainData && domainData.classSkills && domainData.classSkills.includes(skillName)) {
             return true;
          }
        }
      }
      return false;
    },
    getMaxSkillAllocation(alloc) {
      if (!alloc.skill || !alloc.pool) return 0;
      let pool = this.skillPools.find(p => p.name === alloc.pool);
      if (!pool) return 0;

      let isClass = this.isClassSkill(alloc.skill, alloc.pool);
      let hasClassSkillAccess = this.skillPools.some(p => this.isClassSkill(alloc.skill, p.name));
      
      let key = alloc.skill;
      if (this.rules.skills && this.rules.skills[alloc.skill] && this.rules.skills[alloc.skill].hasSpecialization) {
        key += ':' + (alloc.spec || '');
      }
      
      let otherRanks = 0;
      let litSpent = 0;
      this.character.skillAllocations.forEach(a => {
        if (a === alloc) return;
        
        let aKey = a.skill;
        if (this.rules.skills && this.rules.skills[a.skill] && this.rules.skills[a.skill].hasSpecialization) {
          aKey += ':' + (a.spec || '');
        }
        if (aKey === key) {
          let aPool = this.skillPools.find(p => p.name === a.pool);
          if (aPool) {
            let aIsClass = this.isClassSkill(a.skill, a.pool);
            let aPts = Number(a.points) || 0;
            otherRanks += aIsClass ? aPts : aPts / 2;
          }
        }
        if (a.skill === 'Literacy') {
          litSpent += (Number(a.points) || 0);
        }
      });
      
      let maxRank = hasClassSkillAccess ? this.character.levels.length + 3 : (this.character.levels.length + 3) / 2;
      let ranksNeeded = Math.max(0, maxRank - otherRanks);
      let ptsNeeded = isClass ? ranksNeeded : ranksNeeded * 2;
      
      if (alloc.skill === 'Literacy') {
        ptsNeeded = Math.max(0, 2 - litSpent);
      }

      let availablePts = pool.remaining + (Number(alloc.points) || 0);
      let allocate = Math.min(ptsNeeded, availablePts);
      
      return Math.floor(Math.max(0, allocate));
    },
    maximizeSkillAllocation(alloc) {
      alloc.points = this.getMaxSkillAllocation(alloc);
    },
    clampSkillAllocation(alloc) {
      let pts = Number(alloc.points) || 0;
      if (pts < 0) pts = 0;
      
      let maxAllowed = this.getMaxSkillAllocation(alloc);
      if (pts > maxAllowed) {
        alloc.points = maxAllowed;
      } else {
        alloc.points = Math.floor(Math.max(0, pts));
      }
    },
    addSkillAllocation() {
      let defaultPool = '';
      for (let pool of this.skillPools) {
        if (pool.remaining > 0) {
          defaultPool = pool.name;
          break;
        }
      }
      this.character.skillAllocations.push({ skill: '', spec: '', pool: defaultPool, points: 0 });
    },
    setShopTab(tab) {
      if (this.ui.shopTab !== tab) {
        this.ui.shopTab = tab;
        this.ui.shopCategory = '';
        this.ui.shopSearch = '';
      }
    },
    rollStats() {
      for (let stat in this.character.baseAbilities) {
        let rolls = [];
        for (let i = 0; i < 4; i++) {
          rolls.push(Math.floor(Math.random() * 6) + 1);
        }
        rolls.sort((a, b) => a - b);
        rolls.shift(); // Drop the lowest
        let sum = rolls.reduce((a, b) => a + b, 0);
        this.character.baseAbilities[stat] = sum;
      }
    },
    canWieldTwoHanded(primaryVal) {
      if (typeof primaryVal !== 'string' || !primaryVal.startsWith('w_')) return false;
      let idx = parseInt(primaryVal.substring(2));
      let w = this.character.weapons[idx];
      if (!w || !w.classification) return false;
      let lowerClass = w.classification.toLowerCase();
      // Only one-handed weapons can be optionally wielded in two hands. Light cannot.
      // Two-handed weapons inherently use two hands and don't need the toggle.
      if (lowerClass.includes('one-handed')) return true;
      return false;
    },
    isTwoHandedWield(ws) {
      if (ws.primary === -1 || ws.primary === '') return false;
      if (typeof ws.primary !== 'string' || !ws.primary.startsWith('w_')) return false;
      let idx = parseInt(ws.primary.substring(2));
      let w = this.character.weapons[idx];
      if (!w || !w.classification) return false;
      let lowerClass = w.classification.toLowerCase();
      if (lowerClass.includes('two-handed')) return true;
      if (ws.wieldTwoHanded && lowerClass.includes('one-handed')) return true;
      return false;
    },
    async loadData() {
      const loadJson = async (url) => {
        const response = await fetch(url);
        return await response.json();
      };

      try {
        const [classes, races, feats, spells, weapons, armor, wbl, skills, domains] = await Promise.all([
          loadJson('data/classes.json'),
          loadJson('data/races.json'),
          loadJson('data/feats.json'),
          loadJson('data/spells.json'),
          loadJson('data/weapons.json'),
          loadJson('data/armor.json'),
          loadJson('data/wbl.json'),
          loadJson('data/skills.json'),
          loadJson('data/domains.json')
        ]);

        this.$set(this.rules, 'classes', classes);
        this.$set(this.rules, 'races', races);
        this.$set(this.rules, 'feats', feats);
        this.$set(this.rules, 'spells', spells);
        this.$set(this.rules, 'weapons', weapons);
        this.$set(this.rules, 'armor', armor);
        this.$set(this.rules, 'wbl', wbl);
        this.$set(this.rules, 'skills', skills);
        this.$set(this.rules, 'domains', domains);
        this.syncPreparedSpellClasses();
        this.syncPreparedSpellArrays();
        this.syncKnownSpellClasses();
        this.syncKnownSpellArrays();
        this.syncRangerChoices();
        this.syncWizardChoices();
        this.syncRogueChoices();
      } catch (e) {
        console.error("Failed to load rules data:", e);
      }
    },

    getTotalAbility(stat) {
      let base = this.character.baseAbilities[stat];
      let raceData = this.rules.races[this.character.race];
      if (raceData && raceData.abilityModifiers) {
        base += raceData.abilityModifiers[stat] || 0;
      }
      return base;
    },

    getAbilityMod(stat) {
      return Math.floor((this.getTotalAbility(stat) - 10) / 2);
    },

    getBabIncrement(clsData, level) {
      if (!clsData) return 0;
      if (clsData.babProgression === 'good') return 1;
      if (clsData.babProgression === 'average') return 0.75;
      if (clsData.babProgression === 'poor') return 0.5;
      return 0;
    },

    getSaveIncrements(clsData, level) {
      if (!clsData) return { fort: 0, ref: 0, will: 0 };

      // Good save: +2 at level 1, +0.5 per level
      // Poor save: +0 at level 1, +0.33 per level
      // To calculate increment properly at each level step:
      const getInc = (type, isFirstLevelOfClass) => {
        if (type === 'good') return isFirstLevelOfClass ? 2.5 : 0.5;
        if (type === 'poor') return 0.33;
        return 0;
      };

      // Very simplified. Real gestalt save tracking is complex.
      // We'll treat every level increment additively for this demo.
      return {
        fort: getInc(clsData.saves.fort, level === 1),
        ref: getInc(clsData.saves.ref, level === 1),
        will: getInc(clsData.saves.will, level === 1)
      };
    },

    addLevel() {
      let prevLevel = this.character.levels[this.character.levels.length - 1];
      let tA = prevLevel ? prevLevel.trackA : '';
      let tB = prevLevel ? prevLevel.trackB : '';
      
      if (tA && !this.rules.classes[tA]) tA = '';
      if (tB && !this.rules.classes[tB]) tB = '';

      this.character.levels.push({ trackA: tA, trackB: tB, feat: '', featParam: '', bonusFeats: {}, bonusFeatsParams: {} });
      this.handleRaceChange(); // Re-apply monster enforcement
    },

    removeLevel() {
      if (this.character.levels.length > 1) {
        this.character.levels.pop();
      }
    },

    handleRaceChange() {
      let raceData = this.rules.races[this.character.race];
      if (!raceData) return;

      // If monster, enforce progression on Track B
      if (raceData.isMonster && raceData.monsterProgression) {
        let prog = raceData.monsterProgression;
        this.character.levels.forEach((lvl, index) => {
          if (index < prog.length) {
            lvl.trackB = prog[index];
          }
        });
      }
    },

    isMonsterForced(levelIndex, track) {
      if (track !== 'B') return false;
      let raceData = this.rules.races[this.character.race];
      if (raceData && raceData.isMonster && raceData.monsterProgression) {
        return levelIndex < raceData.monsterProgression.length;
      }
      return false;
    },

    getBonusFeatTags(levelIndex) {
      let tags = [];
      let lvl = this.character.levels[levelIndex];
      if (!lvl) return tags;

      if (levelIndex === 0) {
        let raceData = this.rules.races[this.character.race];
        if (raceData && raceData.features) {
          let hasBonusFeat = raceData.features.some(f => {
            let name = typeof f === 'string' ? f : f.name;
            return name === "Bonus Feat";
          });
          if (hasBonusFeat) {
            tags.push('humanBonusFeat');
          }
        }
      }

      let classesAtLevel = [lvl.trackA, lvl.trackB].filter(c => c);

      classesAtLevel.forEach(clsName => {
        let clsData = this.rules.classes[clsName];
        if (!clsData || !clsData.bonusFeats) return;

        let classLevel = 0;
        for (let i = 0; i <= levelIndex; i++) {
          let l = this.character.levels[i];
          if (l.trackA === clsName || l.trackB === clsName) {
            classLevel++;
          }
        }

        for (let tag in clsData.bonusFeats) {
          if (clsData.bonusFeats[tag].includes(classLevel)) {
            tags.push(tag);
          }
        }
      });

      // Synchronize bonusFeats keys
      if (lvl.bonusFeats) {
        tags.forEach(tag => {
          if (lvl.bonusFeats[tag] === undefined) {
            this.$set(lvl.bonusFeats, tag, "");
          }
          let fixedParam = this.getFixedBonusFeatParam(levelIndex, tag);
          if (fixedParam) {
            if (!lvl.bonusFeatsParams) this.$set(lvl, 'bonusFeatsParams', {});
            if (lvl.bonusFeatsParams[tag] !== fixedParam) {
              this.$set(lvl.bonusFeatsParams, tag, fixedParam);
            }
          }
        });

        Object.keys(lvl.bonusFeats).forEach(tag => {
          if (!tags.includes(tag)) {
            this.$delete(lvl.bonusFeats, tag);
            if (lvl.bonusFeatsParams && lvl.bonusFeatsParams[tag] !== undefined) {
              this.$delete(lvl.bonusFeatsParams, tag);
            }
          }
        });
      }

      return tags;
    },

    getFixedBonusFeatParam(levelIndex, tag) {
      let lvl = this.character.levels[levelIndex];
      if (!lvl) return '';

      let classesAtLevel = [lvl.trackA, lvl.trackB].filter(c => c);
      for (let clsName of classesAtLevel) {
        let clsData = this.rules.classes[clsName];
        if (!clsData || !clsData.bonusFeats || !clsData.bonusFeatParams || !clsData.bonusFeatParams[tag]) continue;

        let classLevel = 0;
        for (let i = 0; i <= levelIndex; i++) {
          let l = this.character.levels[i];
          if (l.trackA === clsName || l.trackB === clsName) {
            classLevel++;
          }
        }

        if (clsData.bonusFeats[tag] && clsData.bonusFeats[tag].includes(classLevel)) {
          return clsData.bonusFeatParams[tag];
        }
      }

      return '';
    },

    formatBonusFeatName(tag) {
      if (!tag) return '';
      let spaced = tag.replace(/([A-Z])/g, ' $1');
      return spaced.charAt(0).toUpperCase() + spaced.slice(1);
    },

    // Prerequisite checking
    checkPrerequisites(featName, currentLevelIndex) {
      let feat = this.rules.feats[featName];
      if (!feat || !feat.prerequisites) return true;

      // Calculate state up to current level
      let state = this.getCharacterStateUpToLevel(currentLevelIndex);
      return this.evaluateLogic(feat.prerequisites, state);
    },

    getCharacterStateUpToLevel(levelIndex) {
      // Re-calculate state for prereqs
      let bab = 0;
      let feats = [];
      let classLevels = {};
      for (let i = 0; i <= levelIndex; i++) {
        let lvl = this.character.levels[i];
        let cA = this.rules.classes[lvl.trackA];
        let cB = this.rules.classes[lvl.trackB];
        if (lvl.trackA) classLevels[lvl.trackA] = (classLevels[lvl.trackA] || 0) + 1;
        if (lvl.trackB && lvl.trackB !== lvl.trackA) classLevels[lvl.trackB] = (classLevels[lvl.trackB] || 0) + 1;
        let incA = this.getBabIncrement(cA, i + 1);
        let incB = this.getBabIncrement(cB, i + 1);
        bab += Math.max(incA, incB);
        if (lvl.feat) feats.push(lvl.feat);
        if (lvl.bonusFeats) {
          Object.values(lvl.bonusFeats).forEach(f => { if (f) feats.push(f); });
        }
        this.getBonusFeatTags(i).forEach(tag => {
          if (this.rules.feats[tag] && !feats.includes(tag)) {
            let param = this.getFixedBonusFeatParam(i, tag);
            feats.push(param ? `${tag} (${param})` : tag);
          }
        });
      }
      return {
        bab: Math.floor(bab),
        feats: feats,
        abilities: {
          str: this.getTotalAbility('str'),
          dex: this.getTotalAbility('dex'),
          con: this.getTotalAbility('con'),
          int: this.getTotalAbility('int'),
          wis: this.getTotalAbility('wis'),
          cha: this.getTotalAbility('cha')
        },
        level: levelIndex + 1,
        classLevels: classLevels,
        casterLevel: Object.values(classLevels).reduce((max, level) => Math.max(max, level), 0)
      };
    },

    evaluateLogic(prereq, state) {
      if (!prereq.conditions || prereq.conditions.length === 0) return true;

      if (prereq.logic === 'AND') {
        return prereq.conditions.every(cond => this.evaluateCondition(cond, state));
      } else if (prereq.logic === 'OR') {
        return prereq.conditions.some(cond => this.evaluateCondition(cond, state));
      }
      return true;
    },

    evaluateCondition(cond, state) {
      if (cond.logic) {
        return this.evaluateLogic(cond, state);
      }

      switch (cond.type) {
        case 'ABILITY':
          return state.abilities[cond.ability] >= cond.value;
        case 'BAB':
          return state.bab >= cond.value;
        case 'FEAT':
          return state.feats.includes(cond.value);
        case 'LEVEL':
          // Must be exactly at or below the given level (used for 1st-level only feats)
          // E.g. "value": 1 means level <= 1
          return state.level <= cond.value;
        case 'SKILL':
          // Skill tracking omitted for simplicity, auto-pass or assume max rank
          return true;
        case 'CLASS_LEVEL':
          return (state.classLevels[cond.className] || 0) >= cond.value;
        case 'CASTER_LEVEL':
          return state.casterLevel >= cond.value;
        default:
          return true;
      }
    },
    
    getIterativeAttacks(totalAtkBonus, bab, penalty = 0, extraAttacksCount = 0) {
      let iteratives = [];
      let baseModified = totalAtkBonus - penalty;
      
      for (let i = 0; i < extraAttacksCount; i++) {
        iteratives.push(`${baseModified >= 0 ? '+' : ''}${baseModified}`);
      }
      
      let numStandardAttacks = Math.max(1, Math.min(4, Math.ceil(bab / 5)));
      for (let i = 0; i < numStandardAttacks; i++) {
        let atk = baseModified - (i * 5);
        iteratives.push(`${atk >= 0 ? '+' : ''}${atk}`);
      }
      
      return iteratives;
    },

    getFlurryDetails(monkLevel) {
      if (monkLevel <= 0) return null;
      let penalty = monkLevel < 5 ? 2 : monkLevel < 9 ? 1 : 0;
      let extraAttacks = monkLevel >= 11 ? 2 : 1;
      return { penalty, extraAttacks };
    },

    generateMarkdown() {
      let stats = this.calculatedStats;
      let raceData = this.rules.races[this.character.race];
      let raceName = this.character.race;
      let totalLevels = this.character.levels.length;

      // Compute ECL and CR
      let ecl = totalLevels;
      let cr = totalLevels + 1; // standard gestalt CR bump

      // Determine gestalt class levels string
      let trackAClasses = {};
      let trackBClasses = {};
      this.character.levels.forEach(lvl => {
        if (lvl.trackA) trackAClasses[lvl.trackA] = (trackAClasses[lvl.trackA] || 0) + 1;
        if (lvl.trackB) trackBClasses[lvl.trackB] = (trackBClasses[lvl.trackB] || 0) + 1;
      });

      let trackAStrings = Object.entries(trackAClasses).map(([c, n]) => `${this.getClassDisplayName(c)} ${n}`);
      let trackBStrings = Object.entries(trackBClasses).map(([c, n]) => `${this.getClassDisplayName(c)} ${n}`);

      let classString = "";
      if (trackAStrings.length > 0 && trackBStrings.length > 0) {
        classString = `${trackAStrings.join('/')}/${trackBStrings.join('/')}`;
      } else {
        classString = trackAStrings.join('/') || trackBStrings.join('/') || 'Commoner 1';
      }

      // Feats string
      let allFeatsArr = this.character.levels.flatMap((l, i) => {
        let arr = [];
        if (l.feat) {
           let fStr = l.feat;
           if (l.featParam) fStr += ` (${l.featParam})`;
           arr.push(fStr);
        }
        if (l.bonusFeats) {
           Object.keys(l.bonusFeats).forEach(tag => {
              let fName = l.bonusFeats[tag];
              if (!fName) return;
              let fStr = fName;
              if (l.bonusFeatsParams && l.bonusFeatsParams[tag]) fStr += ` (${l.bonusFeatsParams[tag]})`;
              arr.push(fStr);
           });
        }
        this.getBonusFeatTags(i).forEach(tag => {
          if (this.rules.feats[tag] && !arr.some(f => f.startsWith(tag))) {
            let param = this.getFixedBonusFeatParam(i, tag);
            arr.push(param ? `${tag} (${param})` : tag);
          }
        });
        return arr;
      }).filter(f => f);
      let allFeats = allFeatsArr.join(', ');

      // Weapon Proficiencies
      let proficiencies = new Set();
      this.character.levels.forEach(lvl => {
        let clsA = this.rules.classes[lvl.trackA];
        let clsB = this.rules.classes[lvl.trackB];
        if (clsA && clsA.weaponProficiencies) clsA.weaponProficiencies.forEach(p => proficiencies.add(p.toLowerCase()));
        if (clsB && clsB.weaponProficiencies) clsB.weaponProficiencies.forEach(p => proficiencies.add(p.toLowerCase()));
      });
      if (raceData && raceData.weaponProficiencies) {
        raceData.weaponProficiencies.forEach(p => proficiencies.add(p.toLowerCase()));
      }
      if (this.character.race === 'Elf') {
        ['longsword', 'rapier', 'longbow', 'composite longbow', 'shortbow', 'composite shortbow'].forEach(p => proficiencies.add(p));
      }
      allFeatsArr.forEach(feat => {
        let fLower = feat.toLowerCase();
        if (fLower === 'simple weapon proficiency') proficiencies.add('simple');
        if (fLower === 'martial weapon proficiency') proficiencies.add('martial');
        let m = fLower.match(/(martial|exotic) weapon proficiency \((.*?)\)/i);
        if (m) proficiencies.add(m[2].trim());
      });

      // Armor Proficiencies
      let armorProf = new Set();
      this.character.levels.forEach(lvl => {
        let clsA = this.rules.classes[lvl.trackA];
        let clsB = this.rules.classes[lvl.trackB];
        if (clsA && clsA.armorProficiencies) clsA.armorProficiencies.forEach(p => armorProf.add(p.toLowerCase()));
        if (clsB && clsB.armorProficiencies) clsB.armorProficiencies.forEach(p => armorProf.add(p.toLowerCase()));
      });
      allFeatsArr.forEach(feat => {
        let fLower = feat.toLowerCase();
        if (fLower === 'armor proficiency (light)') armorProf.add('light');
        if (fLower === 'armor proficiency (medium)') armorProf.add('medium');
        if (fLower === 'armor proficiency (heavy)') armorProf.add('heavy');
        if (fLower === 'shield proficiency') armorProf.add('shield');
        if (fLower === 'tower shield proficiency') armorProf.add('towershield');
      });

      let profAcp = 0;
      let nonProfAcp = 0;
      let bodyVal = this.character.equipped.chakras.Body;
      if (bodyVal !== -1 && bodyVal !== '') {
        let armor = this.character.armor[bodyVal];
        if (armor) {
           let type = armor.type ? armor.type.toLowerCase() : '';
           let pen = Number(armor.checkPenalty) || 0;
           if (type && !armorProf.has(type)) nonProfAcp += pen;
           else profAcp += pen;
        }
      }
      let wsZero = this.character.equipped.weapons[0];
      if (wsZero && wsZero.offhand !== -1 && wsZero.offhand !== '' && typeof wsZero.offhand === 'string' && wsZero.offhand.startsWith('a_')) {
        let idx = parseInt(wsZero.offhand.substring(2));
        let shield = this.character.armor[idx];
        if (shield) {
           let type = shield.type ? shield.type.toLowerCase() : '';
           let pen = Number(shield.checkPenalty) || 0;
           if (type && type.includes('tower') && !armorProf.has('towershield')) nonProfAcp += pen;
           else if (type && !armorProf.has('shield')) nonProfAcp += pen;
           else profAcp += pen;
        }
      }

      // Hit Dice (HD)
      let hdCounts = {};
      this.character.levels.forEach(lvl => {
        let clsA = this.rules.classes[lvl.trackA];
        let clsB = this.rules.classes[lvl.trackB];
        let hdA = clsA ? clsA.hitDie : 0;
        let hdB = clsB ? clsB.hitDie : 0;
        let bestHD = Math.max(hdA, hdB);
        if (bestHD > 0) {
          hdCounts[bestHD] = (hdCounts[bestHD] || 0) + 1;
        }
      });
      let hdStrings = Object.entries(hdCounts).map(([die, count]) => `${count}d${die}`);
      let hdString = hdStrings.join(' plus ') || '0d4';

      let size = raceData ? raceData.size : 'Medium';
      let speed = raceData ? (raceData.speed || 30) : 30;
      let initiative = stats.initiative || 0;
      let initiativeString = `${initiative >= 0 ? '+' : ''}${initiative}`;

      let output = `${this.character.name || 'Unnamed'}, ${raceName.toLowerCase()} gestalt ${classString}: CR ${cr}; ECL ${ecl}; ${size}-size ${this.creatureType}; HD ${hdString}; hp ${stats.hp}; Init ${initiativeString}; Spd ${speed} ft.; `;

      // AC computation
      let natArmor = raceData ? (raceData.naturalArmor || 0) : 0;
      
      let totalAc = stats.ac.total + natArmor;
      let touchAc = stats.ac.touch;
      let ffAc = stats.ac.flat + natArmor;

      let acParts = [];
      if (stats.ac.armorBonus > 0) acParts.push(`+${stats.ac.armorBonus} armor`);
      if (stats.ac.shieldBonus > 0) acParts.push(`+${stats.ac.shieldBonus} shield`);
      if (stats.ac.dexBonus !== 0) acParts.push(`${stats.ac.dexBonus > 0 ? '+' : ''}${stats.ac.dexBonus} dex`);
      if (natArmor > 0) acParts.push(`+${natArmor} natural`);
      if (stats.ac.sizeMod !== 0) acParts.push(`${stats.ac.sizeMod > 0 ? '+' : ''}${stats.ac.sizeMod} size`);

      let acString = `${totalAc} ` + (acParts.length > 0 ? `(${acParts.join(', ')})` : '') + `, touch ${touchAc}, flat-footed ${ffAc}`;
      output += `AC ${acString}; `;

      // Attacks (Atk)
      let strMod = this.getAbilityMod('str');
      let dexMod = this.getAbilityMod('dex');
      let sizeMod = stats.ac.sizeMod;
      let meleeAtk = stats.bab + strMod + sizeMod + nonProfAcp;
      let rangedAtk = stats.bab + dexMod + sizeMod + nonProfAcp;
      let attackStrings = [];
      let fullAttackStrings = [];

      let firstWeaponSet = this.character.equipped.weapons[0];
      if (firstWeaponSet && firstWeaponSet.primary !== -1 && firstWeaponSet.primary !== '') {
        // Find weapon
        let primVal = firstWeaponSet.primary;
        if (typeof primVal === 'string' && primVal.startsWith('w_')) {
          let idx = parseInt(primVal.substring(2));
          let weapon = this.character.weapons[idx];
          if (weapon) {
            let isRanged = weapon.rangeIncrement && weapon.rangeIncrement !== '—';
            let atkBonus = isRanged ? rangedAtk : meleeAtk;
            if (weapon.masterwork) atkBonus += 1;
            
            let wNameLower = weapon.name.toLowerCase();
            let wCatLower = weapon.category ? weapon.category.toLowerCase() : '';
            let isProficient = true;
            if (wNameLower !== 'unarmed strike' && !wNameLower.includes('gauntlet')) {
              if (!proficiencies.has(wNameLower) && !proficiencies.has(wCatLower)) {
                isProficient = false;
                atkBonus -= 4;
              }
            }

            let twoHanded = false;
            if (!isRanged && strMod > 0) {
              let lowerClass = weapon.classification ? weapon.classification.toLowerCase() : '';
              if (lowerClass.includes('two-handed')) {
                twoHanded = true;
              } else if (firstWeaponSet.wieldTwoHanded && lowerClass.includes('one-handed')) {
                twoHanded = true;
              }
            }
            let dmgBonus = isRanged ? 0 : (twoHanded ? Math.floor(strMod * 1.5) : strMod);
            // Composite bows get Str bonus
            if (weapon.name.toLowerCase().includes('composite')) dmgBonus = strMod;
            
            let dmgStr = weapon.damage;
            if (dmgBonus !== 0) dmgStr += (dmgBonus > 0 ? '+' : '') + dmgBonus;
            
            let weaponDisplayName = this.getWeaponDisplayName(weapon);
            let wepAtk = `${weaponDisplayName} ${atkBonus >= 0 ? '+' : ''}${atkBonus} ${isRanged ? 'ranged' : 'melee'} (${dmgStr}/${weapon.critical})`;
            attackStrings.push(wepAtk);
            
            // Full attack with iteratives
            let iteratives = this.getIterativeAttacks(atkBonus, stats.bab);
            let fullWepAtk = `${weaponDisplayName} ${iteratives.join('/')} ${isRanged ? 'ranged' : 'melee'} (${dmgStr}/${weapon.critical})`;
            
            let monkWeapons = ['unarmed strike', 'kama', 'nunchaku', 'quarterstaff', 'sai', 'shuriken', 'siangham'];
            let monkLevel = stats.classLevels['Monk'] || 0;
            let isUnarmored = this.character.armor.length === 0;
            if (isUnarmored && monkWeapons.includes(weapon.name.toLowerCase())) {
              let flurry = this.getFlurryDetails(monkLevel);
              if (flurry) {
                let flurryIters = this.getIterativeAttacks(atkBonus, stats.bab, flurry.penalty, flurry.extraAttacks);
                fullWepAtk += ` or flurry of blows ${flurryIters.join('/')} ${isRanged ? 'ranged' : 'melee'} (${dmgStr}/${weapon.critical})`;
              }
            }
            
            fullAttackStrings.push(fullWepAtk);
          }
        }
      }

      if (attackStrings.length === 0) {
        let unarmedDmg = this.getWeaponDamage({name: 'Unarmed strike', size: this.characterSize});
        let dmgBonus = strMod;
        let dmgStr = unarmedDmg;
        if (dmgBonus !== 0) dmgStr += (dmgBonus > 0 ? '+' : '') + dmgBonus;
        
        attackStrings.push(`Unarmed Strike ${meleeAtk >= 0 ? '+' : ''}${meleeAtk} melee (${dmgStr})`);
        
        let iteratives = this.getIterativeAttacks(meleeAtk, stats.bab);
        let fullWepAtk = `Unarmed Strike ${iteratives.join('/')} melee (${dmgStr})`;
        
        let monkLevel = stats.classLevels['Monk'] || 0;
        let isUnarmored = this.character.armor.length === 0;
        if (isUnarmored) {
          let flurry = this.getFlurryDetails(monkLevel);
          if (flurry) {
            let flurryIters = this.getIterativeAttacks(meleeAtk, stats.bab, flurry.penalty, flurry.extraAttacks);
            fullWepAtk += ` or flurry of blows ${flurryIters.join('/')} melee (${dmgStr})`;
          }
        }
        
        fullAttackStrings.push(fullWepAtk);
      }
      
      output += `Atk ${attackStrings.join('; ')}; Full Atk ${fullAttackStrings.join('; ')}; `;

      // SA and SQ fields
      let sa = [];
      let sq = [];
      if (this.hasHealerLevel) {
        sa.push("Healer Spells");
      }

      if (stats.allFeatures) {
        stats.allFeatures.forEach(f => {
          if (f.showOnBlock) {
            let typeStr = f.abilityType ? ` (${f.abilityType})` : '';
            let featStr = `${f.name}${typeStr}`;
            if (f.isSpecialAttack) sa.push(featStr);
            if (f.isSpecialQuality) sq.push(featStr);
          }
        });
      }

      if (raceData && raceData.features) {
        raceData.features.forEach(f => {
          let fObj = typeof f === 'string' ? {
            name: f,
            abilityType: '',
            showOnBlock: true,
            isSpecialAttack: false,
            isSpecialQuality: true
          } : f;
          if (fObj.showOnBlock) {
            let typeStr = fObj.abilityType ? ` (${fObj.abilityType})` : '';
            let featStr = `${fObj.name}${typeStr}`;
            if (fObj.isSpecialAttack) sa.push(featStr);
            if (fObj.isSpecialQuality) sq.push(featStr);
          }
        });
      }

      if (sa.length > 0) output += `SA ${sa.join(', ')}; `;
      if (sq.length > 0) output += `SQ ${sq.join(', ')}; `;

      output += `AL ${this.character.alignment}; SV Fort +${stats.saves.fort}, Ref +${stats.saves.ref}, Will +${stats.saves.will}; `;
      output += `Str ${this.getTotalAbility('str')}, Dex ${this.getTotalAbility('dex')}, Con ${this.getTotalAbility('con')}, Int ${this.getTotalAbility('int')}, Wis ${this.getTotalAbility('wis')}, Cha ${this.getTotalAbility('cha')}.\n`;

      // Skills
      let skillStrings = [];
      let calcSkills = this.calculatedSkills;
      
      Array.from(calcSkills.keys()).sort().forEach(key => {
        let ranks = Math.floor(calcSkills.get(key));
        if (ranks > 0) {
          let parts = key.split(':');
          let sName = parts[0];
          let spec = parts.length > 1 ? parts.slice(1).join(':') : '';
          
          let sData = this.rules.skills ? this.rules.skills[sName] : null;
          
          let total = ranks;
          if (sData) {
            if (sData.keyAbility) {
              total += this.getAbilityMod(sData.keyAbility);
            }
            if (sData.armorCheckPenalty) {
              total += (profAcp + nonProfAcp);
            } else if (sData.keyAbility === 'str' || sData.keyAbility === 'dex') {
              total += nonProfAcp;
            }
          }
          
          allFeatsArr.forEach(featName => {
            let fData = this.rules.feats[featName];
            if (fData && fData.skillBonuses && fData.skillBonuses[sName]) {
              total += fData.skillBonuses[sName];
            }
            let skillFocusMatch = String(featName).match(/^Skill Focus \((.*?)\)$/i);
            if (skillFocusMatch && skillFocusMatch[1] === sName) {
              total += 3;
            }
          });
          
          let displayName = sName;
          if (spec) displayName += ` (${spec})`;
          
          if (sName === 'Literacy') {
            skillStrings.push('Literacy');
          } else {
            skillStrings.push(`${displayName} ${total >= 0 ? '+' : ''}${total}`);
          }
        }
      });
      
      let skillsOutput = skillStrings.length > 0 ? skillStrings.join(', ') : 'None';
      output += `Skills and Feats: ${skillsOutput}; ${allFeats || 'None'}.\n`;

      // Spell list builder for Prepared Casters
      this.preparedCasters.forEach(className => {
        let classSlots = this.classSlots(className);
        let activeSlots = classSlots.filter(s => s.canCast);
        let slotsString = activeSlots.map(s => s.total).join('/');
        
        let clsData = this.rules.classes[className];
        let saveDCStat = clsData && clsData.spellSaveDCStat ? clsData.spellSaveDCStat : 'wis';
        let statMod = this.getAbilityMod(saveDCStat);
        let saveDcBase = 10 + statMod;

        let levelsText = [];
        activeSlots.forEach(slotInfo => {
          let prepSpells = this.character.preparedSpells && this.character.preparedSpells[className] ? this.character.preparedSpells[className][slotInfo.level] || [] : [];
          let domainSpell = this.character.preparedDomainSpells && this.character.preparedDomainSpells[className] ? this.character.preparedDomainSpells[className][slotInfo.level] : '';
          let counts = {};
          prepSpells.forEach(s => {
            if (s && s.trim() !== '') {
               counts[s] = (counts[s] || 0) + 1;
            }
          });
          
          let formattedSpellsList = [];
          for (let s in counts) {
             let capitalized = s.charAt(0).toUpperCase() + s.slice(1);
             if (counts[s] > 1) capitalized += ` (x${counts[s]})`;
             formattedSpellsList.push(capitalized);
          }
          
          if (domainSpell && domainSpell.trim() !== '') {
             formattedSpellsList.push(domainSpell.charAt(0).toUpperCase() + domainSpell.slice(1) + ' [D]');
          }
          
          if (formattedSpellsList.length > 0) {
            let formattedSpells = formattedSpellsList.join(', ');
            let lvlWord = slotInfo.level === 0 ? "0th" :
              slotInfo.level === 1 ? "1st" :
                slotInfo.level === 2 ? "2nd" :
                  slotInfo.level === 3 ? "3rd" : `${slotInfo.level}th`;
            levelsText.push(`${lvlWord}: ${formattedSpells}`);
          }
        });

        if (levelsText.length > 0) {
          output += `${this.getClassDisplayName(className)} Spells: ${slotsString} (Save DC ${saveDcBase} + spell level) - ${levelsText.join('; ')}.\n`;
        }
      });

      // Spell list builder for Spontaneous Casters
      this.spontaneousCasters.forEach(className => {
        let classSlots = this.classSlots(className);
        let activeSlots = classSlots.filter(s => s.canCast);
        let slotsPerDayString = activeSlots.map(s => s.total).join('/');
        
        let knownSlots = this.classKnownSlots(className);
        let activeKnownSlots = knownSlots.filter(s => s.total > 0);
        let spellsKnownString = activeKnownSlots.map(s => s.total).join('/');

        let clsData = this.rules.classes[className];
        let saveDCStat = clsData && clsData.spellSaveDCStat ? clsData.spellSaveDCStat : 'cha';
        let statMod = this.getAbilityMod(saveDCStat);
        let saveDcBase = 10 + statMod;

        let levelsText = [];
        activeKnownSlots.forEach(slotInfo => {
          let knownList = this.character.knownSpells && this.character.knownSpells[className] ? this.character.knownSpells[className][slotInfo.level] || [] : [];
          
          let validSpells = knownList.filter(s => s && s.trim() !== '').map(s => s.charAt(0).toUpperCase() + s.slice(1)).sort();
          
          if (validSpells.length > 0) {
            let formattedSpells = validSpells.join(', ');
            let lvlWord = slotInfo.level === 0 ? "0th" :
              slotInfo.level === 1 ? "1st" :
                slotInfo.level === 2 ? "2nd" :
                  slotInfo.level === 3 ? "3rd" : `${slotInfo.level}th`;
            levelsText.push(`${lvlWord}: ${formattedSpells}`);
          }
        });

        if (levelsText.length > 0) {
          output += `${this.getClassDisplayName(className)} Spells Known: ${spellsKnownString} - ${levelsText.join('; ')}. Spells per day: ${slotsPerDayString}. Save DC ${saveDcBase} + spell level.\n`;
        }
      });

      let equipmentParts = [];
      
      // Append non-empty chakras to list
      for (const [slot, value] of Object.entries(this.character.equipped.chakras)) {
        if (slot === 'Body' && value !== -1 && value !== '') {
          let armor = this.character.armor[value];
          if (armor) equipmentParts.push(armor.name);
        } else if (value && value.trim && value.trim() !== '') {
          equipmentParts.push(value);
        }
      }
      
      // Add equipped weapons and shields from weapon sets to list
      this.character.equipped.weapons.forEach(ws => {
        if (ws.primary !== -1 && ws.primary !== '' && typeof ws.primary === 'string' && ws.primary.startsWith('w_')) {
          let w = this.character.weapons[parseInt(ws.primary.substring(2))];
          let weaponName = this.getWeaponDisplayName(w);
          if (w && !equipmentParts.includes(weaponName)) equipmentParts.push(weaponName);
        }
        if (ws.offhand !== -1 && ws.offhand !== '' && typeof ws.offhand === 'string') {
          if (ws.offhand.startsWith('w_')) {
            let w = this.character.weapons[parseInt(ws.offhand.substring(2))];
            let weaponName = this.getWeaponDisplayName(w);
            if (w && !equipmentParts.includes(weaponName)) equipmentParts.push(weaponName);
          } else if (ws.offhand.startsWith('a_')) {
            let a = this.character.armor[parseInt(ws.offhand.substring(2))];
            if (a && !equipmentParts.includes(a.name)) equipmentParts.push(a.name);
          }
        }
      });
      
      if (this.character.equipped.other && this.character.equipped.other.trim() !== '') {
        equipmentParts.push(this.character.equipped.other);
      }
      
      output += `Equipment: ${equipmentParts.length > 0 ? equipmentParts.join(', ') : 'None'}.`;
      return output;
    },

    exportMarkdown() {
      let md = this.generateMarkdown();
      let blob = new Blob([md], { type: 'text/markdown' });
      let url = URL.createObjectURL(blob);
      let a = document.createElement('a');
      a.href = url;
      a.download = `${this.character.name || 'Character'}.md`;
      a.click();
      URL.revokeObjectURL(url);
    },

    exportWord() {
      let mdText = this.generateMarkdown();
      // Generate clean HTML based on the markdown text
      let innerHTML = `<p><b>${this.character.name || 'Character'}</b></p><p>${mdText.replace(/\n/g, '<br/>')}</p>`;

      // MIME multipart word document generation matching aglGen.php logic
      let boundary = '----=_NextPart_ERTUP.EFETZ.FTYIIBVZR.EYUUREZ';

      let docData = "MIME-Version: 1.0\nContent-Type: multipart/related; boundary=\"" + boundary + "\"\n\n";

      let htmlContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <title>D&D Character</title>
  <!--[if gte mso 9]>
  <xml>
  <w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page { size: 21.59cm 27.94cm; margin: 2cm; mso-page-orientation: portrait; }
    div.Section1 { font-family: 'Times New Roman', Times, serif; font-size: 11pt; }
  </style>
</head>
<body>
  <div class='Section1'>
    ${innerHTML}
  </div>
</body>
</html>`;

      // Base64 encode the HTML
      let encodedHtml = btoa(unescape(encodeURIComponent(htmlContent)));

      docData += '--' + boundary + '\n';
      docData += 'Content-Location: file:///C:/char.htm\n';
      docData += 'Content-Transfer-Encoding: base64\n';
      docData += 'Content-Type: text/html; charset="utf-8"\n\n';
      docData += encodedHtml + '\n\n';

      docData += '--' + boundary + '--';

      let blob = new Blob([docData], { type: 'application/msword' });
      let url = URL.createObjectURL(blob);
      let a = document.createElement('a');
      a.href = url;
      a.download = `${this.character.name || 'Character'}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
});
