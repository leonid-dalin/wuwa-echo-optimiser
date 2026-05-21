// js/macro-engine.js
const COSTS = {
    0: { exp: 4400, tuner: 10, shell: 2440 },
    5: { exp: 12100, tuner: 10, shell: 3210 },
    10: { exp: 23100, tuner: 10, shell: 4310 },
    15: { exp: 39500, tuner: 10, shell: 5950 },
    20: { exp: 63500, tuner: 10, shell: 8350 }
};

const REFUNDS = {
    5: { exp: 3300, tuner: 3 },
    10: { exp: 12375, tuner: 6 },
    15: { exp: 29700, tuner: 9 },
    20: { exp: 59325, tuner: 12 }
};

export function calculateMacroStrategy(weights) {
    const states = generateStates();
    const V = {}; // Value function
    const strategy = {};
    
    // Initialize V
    states.forEach(s => V[s.str] = 0);

    // Value Iteration (Solve Bellman Equation)
    let delta = Infinity;
    while (delta > 0.001) {
        delta = 0;
        for (const s of states) {
            const level = s.total * 5;
            if (level === 25) continue; // Target reached or max level

            const isTarget = s.a >= 2 && s.b >= 1;
            if (isTarget) {
                V[s.str] = 0; // Cost to finish is sunk/ignored for decision boundary
                strategy[s.str] = 'KEEP';
                continue;
            }

            // 1. Calculate Cost to KEEP
            const upgradeCost = COSTS[level].exp * weights.exp + COSTS[level].tuner * weights.tuner + COSTS[level].shell * weights.shell;
            let expectedFutureCost = 0;
            
            const remA = 2 - s.a, remB = 3 - s.b, remF = 8 - s.f;
            const totalRem = 13 - s.total;
            
            if (remA > 0) expectedFutureCost += (remA / totalRem) * V[getStateStr(s.a+1, s.b, s.f)];
            if (remB > 0) expectedFutureCost += (remB / totalRem) * V[getStateStr(s.a, s.b+1, s.f)];
            if (remF > 0) expectedFutureCost += (remF / totalRem) * V[getStateStr(s.a, s.b, s.f+1)];
            
            const costKeep = upgradeCost + expectedFutureCost;

            // 2. Calculate Cost to RESTART
            const refund = REFUNDS[level] ? (REFUNDS[level].exp * weights.exp + REFUNDS[level].tuner * weights.tuner) : 0;
            const costRestart = V[''] - refund; // V[''] is V0

            // 3. Update Value
            const minCost = Math.min(costKeep, costRestart);
            delta = Math.max(delta, Math.abs(V[s.str] - minCost));
            V[s.str] = minCost;
            strategy[s.str] = costKeep <= costRestart ? 'KEEP' : 'RESTART';
        }
    }
    return strategy;
}

function generateStates() {
    const states = [];
    for (let a = 0; a <= 2; a++) {
        for (let b = 0; b <= 3; b++) {
            for (let f = 0; f <= 8; f++) {
                let total = a + b + f;
                if (total >= 0 && total <= 4) { // Max 4 substats before level 25 finish
                    states.push({ a, b, f, total, str: getStateStr(a, b, f) });
                }
            }
        }
    }
    return states;
}

function getStateStr(a, b, f) {
    return 'A'.repeat(a) + 'B'.repeat(b) + 'F'.repeat(f);
}