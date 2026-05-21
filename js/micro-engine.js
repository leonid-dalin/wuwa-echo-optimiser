// js/micro-engine.js

export const STAT_POOLS = {
    'CR': [6.3, 6.9, 7.5, 8.1, 8.7, 9.3, 9.9, 10.5],
    'CD': [12.6, 13.8, 15.0, 16.2, 17.4, 18.6, 19.8, 21.0],
    'ER': [6.8, 7.6, 8.4, 9.2, 10.0, 10.8, 11.6, 12.4],
    'BA DMG': [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    'HA DMG': [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    'RES SKILL DMG': [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    'RES LIB DMG': [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    'HP': [320, 360, 390, 430, 470, 510, 540, 580],
    'HP%': [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    'ATK': [30, 40, 50, 60],
    'ATK%': [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    'DEF': [40, 50, 60, 70],
    'DEF%': [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6]
};

export const DEFAULT_WEIGHTS = {
    'CR': 2.0, 'CD': 1.0, 'ATK%': 1.0, 'ER': 0.5,
    'BA DMG': 0.8, 'HA DMG': 0.8, 'RES SKILL DMG': 0.8, 'RES LIB DMG': 0.8,
    'HP%': 0.2, 'DEF%': 0.0, 'HP': 0.0, 'ATK': 0.1, 'DEF': 0.0,
    'default': 0.1
};

// Helper: Generates k-combinations from an array
function getCombinations(arr, k) {
    if (k === 0) return [[]];
    if (arr.length === 0) return [];
    const [first, ...rest] = arr;
    const withFirst = getCombinations(rest, k - 1).map(c => [first, ...c]);
    const withoutFirst = getCombinations(rest, k);
    return [...withFirst, ...withoutFirst];
}

// Helper: Generates all possible score sums for a specific combination of stat types
function getScoreCombinations(combo, weights) {
    let scores = [0];
    for (const statType of combo) {
        const pool = STAT_POOLS[statType];
        const weight = weights[statType] !== undefined ? weights[statType] : (weights.default || 0);
        const newScores = [];
        for (const score of scores) {
            for (const val of pool) {
                newScores.push(score + (val * weight));
            }
        }
        scores = newScores;
    }
    return scores;
}

export function calculateScore(stats, weights) {
    return stats.reduce((sum, stat) => {
        const w = weights[stat.type] !== undefined ? weights[stat.type] : (weights.default || 0);
        return sum + (stat.value * w);
    }, 0);
}

/**
 * Calculates the exact probability mass function (PMF) of all possible final scores.
 * Accurately mimics WuWa tuning by picking distinct unrolled stats.
 */
export function calculateExactProbabilities(challengerStats, remainingUpgrades, weights) {
    const unlockedTypes = challengerStats.map(s => s.type);

    // Calculate the locked-in score of already revealed stats
    const currentBaseStats = challengerStats.map(s => ({
        type: s.type,
        value: STAT_POOLS[s.type][s.tierIndex]
    }));
    const currentScore = calculateScore(currentBaseStats, weights);

    if (remainingUpgrades === 0) {
        return [{ score: currentScore, probability: 1.0 }];
    }

    // Determine what stats are left to be rolled
    const allStatTypes = Object.keys(STAT_POOLS);
    const availableTypes = allStatTypes.filter(t => !unlockedTypes.includes(t));

    // Get all possible combinations of drawing 'remainingUpgrades' distinct stats
    const combinations = getCombinations(availableTypes, remainingUpgrades);
    const probPerCombo = 1.0 / combinations.length;

    let pmf = new Map();

    for (const combo of combinations) {
        let numTierCombos = 1;
        for (const statType of combo) {
            numTierCombos *= STAT_POOLS[statType].length;
        }
        const probPerTierCombo = probPerCombo / numTierCombos;

        // Generate all score permutations for this combo
        const possibleAddedScores = getScoreCombinations(combo, weights);
        for (const addedScore of possibleAddedScores) {
            const finalScore = currentScore + addedScore;
            const key = finalScore.toFixed(4); // String keys prevent float drift
            pmf.set(key, (pmf.get(key) || 0) + probPerTierCombo);
        }
    }

    const outcomes = [];
    for (const [scoreStr, prob] of pmf.entries()) {
        outcomes.push({ score: parseFloat(scoreStr), probability: prob });
    }
    return outcomes;
}

export function analyzeOutcomes(outcomes, baselineScore) {
    let expectedScore = 0;
    let winProbability = 0;
    let expectedImprovement = 0;

    let minScore = Infinity;
    let maxScore = -Infinity;

    for (const outcome of outcomes) {
        expectedScore += outcome.score * outcome.probability;

        if (outcome.score < minScore) minScore = outcome.score;
        if (outcome.score > maxScore) maxScore = outcome.score;

        if (outcome.score > baselineScore) {
            winProbability += outcome.probability;
            expectedImprovement += (outcome.score - baselineScore) * outcome.probability;
        }
    }

    return {
        expectedScore,
        minScore,
        maxScore,
        winProbability: winProbability * 100,
        expectedImprovement: winProbability > 0 ? (expectedImprovement / (winProbability / 100)) : 0,
        baselineScore
    };
}

export function getTheoreticalMax(weights) {
    const maxScores = Object.keys(STAT_POOLS).map(type => {
        const pool = STAT_POOLS[type];
        const maxVal = pool[pool.length - 1];
        const weight = weights[type] !== undefined ? weights[type] : (weights.default || 0);
        return maxVal * weight;
    });

    maxScores.sort((a, b) => b - a);
    return maxScores.slice(0, 5).reduce((sum, val) => sum + val, 0);
}

// Calculate Echo Tier using a dynamic maximum
export function getEchoTier(score, weights) {
    const maxScore = getTheoreticalMax(weights);
    const percentage = Math.min((score / maxScore) * 100, 100);

    let tier = '[F] - Dissonance';
    let color = 'var(--md-error)';

    if (percentage >= 99) {
        tier = '[WTF] - Matrix Glitch';
        color = '#FFD700';
    } else if (percentage >= 88) {
        tier = '[S+] - Overclocked';
        color = '#FF8C00';
    } else if (percentage >= 77) {
        tier = '[S] - Resonance';
        color = '#E040FB';
    } else if (percentage >= 66) {
        tier = '[A] - Harmonic';
        color = 'var(--md-primary)';
    } else if (percentage >= 55) {
        tier = '[B] - Tuned';
        color = '#0288D1';
    } else if (percentage >= 44) {
        tier = '[C] - Baseline';
        color = 'var(--md-success)';
    }

    return { percentage, tier, color, maxScore };
}