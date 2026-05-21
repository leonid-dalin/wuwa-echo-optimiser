// js/app.js
import { calculateMacroStrategy } from './macro-engine.js';
import { STAT_POOLS, DEFAULT_WEIGHTS, calculateExactProbabilities, analyzeOutcomes, calculateScore, getEchoTier, getTheoreticalMax } from './micro-engine.js';

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupMacroEngine();
    setupMicroUI();
    loadState();
});

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
        });
    });
}

function setupMacroEngine() {
    document.getElementById('btn-calc-macro').addEventListener('click', () => {
        const weights = {
            exp: parseFloat(document.getElementById('weight-exp').value),
            tuner: parseFloat(document.getElementById('weight-tuner').value),
            shell: parseFloat(document.getElementById('weight-shell').value),
            echo: parseFloat(document.getElementById('weight-echo').value)
        };
        const strategy = calculateMacroStrategy(weights);
        renderMacroResults(strategy);
    });
}

function setupMicroUI() {
    const chSlider = document.getElementById('challenger-level');
    const chDisplay = document.getElementById('ch-level-display');
    const eqSlider = document.getElementById('equipped-level');
    const eqDisplay = document.getElementById('eq-level-display');

    buildStatSlots('equipped-stats', 'eq');
    buildStatSlots('challenger-stats', 'ch');

    chSlider.addEventListener('input', (e) => {
        const level = parseInt(e.target.value, 10);
        chDisplay.textContent = String(level);
        updateSlotVisibility('ch', level / 5);
        saveState();
    });

    eqSlider.addEventListener('input', (e) => {
        const level = parseInt(e.target.value, 10);
        eqDisplay.textContent = String(level);
        updateSlotVisibility('eq', level / 5);
        saveState();
    });

    document.querySelectorAll('input[name="baseline-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const isEquipped = e.target.value === 'equipped';
            document.getElementById('equipped-panel').style.display = isEquipped ? 'block' : 'none';
            document.getElementById('target-panel').style.display = isEquipped ? 'none' : 'block';
            saveState();
        });
    });

    document.getElementById('btn-calc-micro').addEventListener('click', handleMicroCalculation);
}

function buildStatSlots(containerId, prefix) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    for (let i = 0; i < 5; i++) {
        const row = document.createElement('div');
        row.className = 'stat-row';
        row.id = `${prefix}-row-${i}`;

        const typeSelect = document.createElement('select');
        typeSelect.id = `${prefix}-type-${i}`;
        typeSelect.innerHTML = `<option value="">-- Select Stat --</option>` +
            Object.keys(STAT_POOLS).map(s => `<option value="${s}">${s}</option>`).join('');

        const valSelect = document.createElement('select');
        valSelect.id = `${prefix}-val-${i}`;
        valSelect.innerHTML = `<option value="-1">--</option>`;
        valSelect.disabled = true;

        typeSelect.addEventListener('change', (e) => {
            const stat = e.target.value;
            valSelect.disabled = !stat;
            valSelect.innerHTML = `<option value="-1">--</option>` +
                (STAT_POOLS[stat] || []).map((v, idx) => `<option value="${String(idx)}">${String(v)}</option>`).join('');

            enforceUniqueStats(prefix);
            saveState();
        });

        valSelect.addEventListener('change', saveState);

        row.appendChild(typeSelect);
        row.appendChild(valSelect);
        container.appendChild(row);
    }
}

function updateSlotVisibility(prefix, unlockedCount) {
    for (let i = 0; i < 5; i++) {
        const row = document.getElementById(`${prefix}-row-${i}`);
        if (i < unlockedCount) {
            row.classList.remove('locked-slot');
            document.getElementById(`${prefix}-type-${i}`).disabled = false;
        } else {
            row.classList.add('locked-slot');
            document.getElementById(`${prefix}-type-${i}`).value = '';
            document.getElementById(`${prefix}-type-${i}`).disabled = true;
            document.getElementById(`${prefix}-val-${i}`).innerHTML = `<option value="-1">--</option>`;
            document.getElementById(`${prefix}-val-${i}`).disabled = true;
        }
    }
    enforceUniqueStats(prefix);
}

function enforceUniqueStats(prefix) {
    const selects = Array.from({length: 5}, (_, i) => document.getElementById(`${prefix}-type-${i}`));
    const selectedValues = selects.map(s => s.value).filter(v => v !== "");

    selects.forEach(select => {
        const currentVal = select.value;
        Array.from(select.options).forEach(opt => {
            if (opt.value === "") return;
            opt.disabled = selectedValues.includes(opt.value) && opt.value !== currentVal;
        });
    });
}

function gatherStatsFromUI(prefix, count) {
    const stats = [];
    for (let i = 0; i < count; i++) {
        const type = document.getElementById(`${prefix}-type-${i}`).value;
        const tierIndex = parseInt(document.getElementById(`${prefix}-val-${i}`).value, 10);
        if (type && !isNaN(tierIndex) && tierIndex >= 0) {
            stats.push({ type, tierIndex });
        }
    }
    return stats;
}

function handleMicroCalculation() {
    const chLevel = parseInt(document.getElementById('challenger-level').value, 10);
    const unlockedCount = chLevel / 5;
    const remainingUpgrades = 5 - unlockedCount;

    const challengerStats = gatherStatsFromUI('ch', unlockedCount);
    const baselineType = document.querySelector('input[name="baseline-type"]:checked').value;

    let baselineScore = 0;
    const maxScore = getTheoreticalMax(DEFAULT_WEIGHTS);

    if (baselineType === 'equipped') {
        const eqLevel = parseInt(document.getElementById('equipped-level').value, 10);
        const equippedStatsRaw = gatherStatsFromUI('eq', eqLevel / 5);

        const equippedStats = equippedStatsRaw.map(s => ({
            type: s.type,
            value: STAT_POOLS[s.type][s.tierIndex]
        }));
        baselineScore = calculateScore(equippedStats, DEFAULT_WEIGHTS);
    } else {
        const targetPercent = parseFloat(document.getElementById('target-percent').value) || 50;
        // Translate the user's flat percentage into the raw mathematical score
        baselineScore = (targetPercent / 100) * maxScore;
    }

    const outcomes = calculateExactProbabilities(challengerStats, remainingUpgrades, DEFAULT_WEIGHTS);
    const analysis = analyzeOutcomes(outcomes, baselineScore);

    renderMicroResults(analysis);
}

function renderMacroResults(strategy) {
    const container = document.getElementById('macro-results');
    container.innerHTML = '';
    for (const [state, action] of Object.entries(strategy)) {
        const chip = document.createElement('div');
        chip.className = `state-chip ${action.toLowerCase()}`;
        chip.innerHTML = `<strong>${state || 'Lv 0'}</strong><br>${action}`;
        container.appendChild(chip);
    }
}

function renderMicroResults(analysis) {
    const container = document.getElementById('micro-results');
    container.style.display = 'block';

    const isWinner = analysis.winProbability > 50;
    const verdict = isWinner ? "Upgrade" : "Trash";
    const verdictColor = isWinner ? 'var(--md-success)' : 'var(--md-error)';

    // Pass DEFAULT_WEIGHTS so the max ceiling is dynamically calculated
    const expectedTier = getEchoTier(analysis.expectedScore, DEFAULT_WEIGHTS);
    const baselineTier = getEchoTier(analysis.baselineScore, DEFAULT_WEIGHTS);

    container.innerHTML = `
        <h2 style="margin-top:0;">Analysis</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0;">
            
            <div style="background: #fdfbfd; padding: 16px; border-radius: 8px; border: 1px solid var(--md-outline-variant);">
                <p style="margin: 0 0 8px; color: var(--md-outline); font-size: 14px;">Target</p>
                <strong style="color: ${baselineTier.color}; font-size: 18px;">${baselineTier.tier} (${baselineTier.percentage.toFixed(0)}%)</strong>
                <p style="margin: 4px 0 0; font-size: 12px; color: var(--md-outline);">Raw Score: ${analysis.baselineScore.toFixed(1)}</p>
            </div>

            <div style="background: #fdfbfd; padding: 16px; border-radius: 8px; border: 1px solid var(--md-outline-variant); border-bottom: 4px solid ${expectedTier.color};">
                <p style="margin: 0 0 8px; color: var(--md-outline); font-size: 14px;">Expected Outcome</p>
                <strong style="color: ${expectedTier.color}; font-size: 18px;">${expectedTier.tier} (${expectedTier.percentage.toFixed(0)}%)</strong>
                <p style="margin: 4px 0 0; font-size: 12px; color: var(--md-outline);">Raw Score: ${analysis.expectedScore.toFixed(1)}</p>
            </div>
        </div>

        <div style="text-align: center; margin: 24px 0 16px;">
            <p style="font-size: 16px; margin-bottom: 8px;">Chance to beat target</p>
            <h1 style="color: ${verdictColor}; font-size: 48px; margin: 0;">${analysis.winProbability.toFixed(1)}%</h1>
        </div>
        <h3 style="text-align: center; padding: 16px; background: ${isWinner ? '#E8F5E9' : '#FFEBEE'}; color: ${verdictColor}; border-radius: 8px; margin-bottom: 0;">
            ${verdict}
        </h3>
    `;
}

function saveState() {
    const state = {
        version: "0.1b",
        chLevel: String(document.getElementById('challenger-level').value),
        eqLevel: String(document.getElementById('equipped-level').value),
        eqStats: gatherStatsFromUI('eq', 5),
        chStats: gatherStatsFromUI('ch', 5),
        baselineType: document.querySelector('input[name="baseline-type"]:checked').value,
        targetScore: String(document.getElementById('target-score').value)
    };
    localStorage.setItem('wuwa-optimiser-state', JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem('wuwa-optimiser-state');
    if (!saved) if (!saved) return flushAndInit();

    const state = JSON.parse(saved);
    document.getElementById('target-percent').value = state.targetPercent || "60";

    document.getElementById('challenger-level').value = state.chLevel || "0";
    document.getElementById('ch-level-display').textContent = state.chLevel || "0";
    updateSlotVisibility('ch', parseInt(state.chLevel || "0", 10) / 5);

    document.getElementById('equipped-level').value = state.eqLevel || "25";
    document.getElementById('eq-level-display').textContent = state.eqLevel || "25";
    updateSlotVisibility('eq', parseInt(state.eqLevel || "25", 10) / 5);

    document.querySelector(`input[name="baseline-type"][value="${state.baselineType}"]`).checked = true;
    document.querySelector('input[name="baseline-type"]:checked').dispatchEvent(new Event('change'));

    const restoreStats = (prefix, savedStats) => {
        savedStats.forEach((stat, i) => {
            const typeSelect = document.getElementById(`${prefix}-type-${i}`);
            typeSelect.value = stat.type;
            typeSelect.dispatchEvent(new Event('change'));
            document.getElementById(`${prefix}-val-${i}`).value = String(stat.tierIndex);
        });
    };

    restoreStats('eq', state.eqStats || []);
    restoreStats('ch', state.chStats || []);
}

function flushAndInit() {
    document.getElementById('challenger-level').dispatchEvent(new Event('input'));
    document.getElementById('equipped-level').dispatchEvent(new Event('input'));
    document.getElementById('target-percent').value = "60";
}