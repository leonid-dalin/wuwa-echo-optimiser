// js/micro-engine.js
export const STAT_POOLS = {
    'CR': [6.3, 6.9, 7.5, 8.1, 8.7, 9.3, 9.9, 10.5],
    'CD': [12.6, 13.8, 15, 16.2, 17.4, 18.6, 19.8, 21],
    'ER': [6.8, 7.6, 8.4, 9.2, 10, 10.8, 11.6, 12.4],
    'BA DMG': [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    'HA DMG': [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    'RES SKILL': [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    'RES LIB': [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    'HP': [320, 360, 390, 430, 470, 510, 540, 580],
    'HP%': [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    'ATK': [30, 40, 50, 60],
    'ATK%': [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    'DEF': [40, 50, 60, 70],
    'DEF%': [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6]
};

// Default Gear Score Weights (User can tweak in UI later)
const WEIGHTS = { 'CR': 2.0, 'CD': 1.0, 'ATK%': 1.0, 'ER': 0.5, 'default': 0.1 };

export function simulateComparator(equipped, challenger, remainingUpgrades, iterations = 5000) {
    const equippedScore = calculateScore(equipped);
    let wins = 0;
    let totalImprovement = 0;

    for (let i = 0; i < iterations; i++) {
        let simStats = JSON.parse(JSON.stringify(challenger));
        
        for (let u = 0; u < remainingUpgrades; u++) {
            // Game randomly picks one of the unlocked substats to upgrade
            const targetIndex = Math.floor(Math.random() * simStats.length);
            const stat = simStats[targetIndex];
            
            // Find valid next rolls (values strictly greater than current)
            const pool = STAT_POOLS[stat.type];
            const validRolls = pool.filter(v => v > stat.value + 0.01);
            
            if (validRolls.length > 0) {
                // Pick a random valid tier and calculate the increment
                const nextTier = validRolls[Math.floor(Math.random() * validRolls.length)];
                stat.value = nextTier; // Update to the new cumulative tier
            }
        }
        
        const finalScore = calculateScore(simStats);
        if (finalScore > equippedScore) {
            wins++;
            totalImprovement += (finalScore - equippedScore);
        }
    }

    return {
        winRate: (wins / iterations) * 100,
        expectedImprovement: totalImprovement / iterations,
        equippedScore: equippedScore
    };
}

function calculateScore(stats) {
    return stats.reduce((score, stat) => {
        const weight = WEIGHTS[stat.type] || WEIGHTS.default;
        return score + (stat.value * weight);
    }, 0);
}