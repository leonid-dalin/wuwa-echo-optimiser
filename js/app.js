// js/app.js
import { calculateMacroStrategy } from './macro-engine.js';
import { simulateComparator, STAT_POOLS } from './micro-engine.js';

document.addEventListener('DOMContentLoaded', () => {
    // Tab Switching
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
        });
    });

    // Macro Logic
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

    // Micro Logic (Mockup Data for Demonstration)
    document.getElementById('btn-calc-micro').addEventListener('click', () => {
        const equipped = [
            { type: 'CR', value: 6.8 }, { type: 'CD', value: 12.6 }, 
            { type: 'ATK%', value: 6.4 }, { type: 'HP', value: 320 }
        ];
        const challenger = [
            { type: 'CR', value: 10.5 }, { type: 'HP', value: 320 } // Max rolled CR, but only 2 stats unlocked
        ];
        
        const level = parseInt(document.getElementById('challenger-level').value);
        const remainingUpgrades = level === 15 ? 2 : 1;
        
        const result = simulateComparator(equipped, challenger, remainingUpgrades);
        renderMicroResults(result);
    });
});

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

function renderMicroResults(result) {
    const container = document.getElementById('micro-results');
    const verdict = result.winRate > 50 ? "KEEP (High Potential)" : "DISCARD (Dead End)";
    container.innerHTML = `
        <h2>Simulation Results</h2>
        <p><strong>Baseline Gear Score:</strong> ${result.equippedScore.toFixed(2)}</p>
        <p><strong>Chance to beat equipped:</strong> ${result.winRate.toFixed(1)}%</p>
        <p><strong>Expected Score Gain:</strong> +${result.expectedImprovement.toFixed(2)} Points</p>
        <h3 style="color: ${result.winRate > 50 ? 'var(--md-success)' : 'var(--md-error)'}">Verdict: ${verdict}</h3>
    `;
}