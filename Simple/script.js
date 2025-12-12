const display = document.getElementById('display');
const historyDisplay = document.getElementById('history');
const themeSwitch = document.getElementById('theme-switch');

// State Variables
let isDegrees = false; // Default to Radians
let isInverse = false;
let lastAns = 0;
let calculated = false; // Track if we just finished a calculation

// --- Theme Logic ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeSwitch.checked = true;
    } else {
        document.documentElement.removeAttribute('data-theme');
        themeSwitch.checked = false;
    }
}

// Run immediately on load
initTheme();

themeSwitch.addEventListener('change', () => {
    if (themeSwitch.checked) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    }
});


// --- Calculator Logic ---

function append(value) {
    // Reset logic: If we just calculated a result...
    if (calculated) {
        // If typing a number/constant, start fresh. 
        // If typing an operator, continue with the current result (Ans).
        if (['+', '-', '*', '/', '%', '^', '!'].includes(value)) {
            calculated = false;
        } else {
            display.value = '0';
            calculated = false;
            historyDisplay.innerText = ''; // Clear old history
        }
    }

    // Logic to prevent multiple dots
    if (value === '.') {
        const parts = display.value.split(/[\+\-\*\/]/);
        const currentPart = parts[parts.length - 1];
        if (currentPart.trim().includes('.')) return;
    }

    if (display.value === '0' && value !== '.') {
        display.value = value;
    } else {
        // Formatting spaces around operators
        // Exclude '%' from adding spaces to ensure 10% stays together
        if (['+', '-', '*', '/', '^'].includes(value)) {
            display.value += ` ${value} `;
        } else {
            display.value += value;
        }
    }
    display.scrollLeft = display.scrollWidth;
    
    // Trigger Live Preview
    updatePreview();
}

function clearAll() {
    display.value = '0';
    historyDisplay.innerText = '';
    calculated = false;
}

function deleteLast() {
    if (calculated) {
        clearAll();
        return;
    }

    let current = display.value;
    if (current.endsWith(' ')) {
        display.value = current.slice(0, -3);
    } else {
        display.value = current.slice(0, -1);
    }
    if (display.value === '') display.value = '0';
    
    // Trigger Live Preview
    updatePreview();
}

function appendAns() {
    if (calculated) {
        display.value = '';
        calculated = false;
    }
    // If display is 0, replace it, otherwise append
    if (display.value === '0') {
         display.value = lastAns.toString();
    } else {
         display.value += lastAns.toString();
    }
    updatePreview();
}

// --- Scientific Modes ---

function setAngleMode(mode) {
    const btnRad = document.getElementById('btn-rad');
    const btnDeg = document.getElementById('btn-deg');
    
    if (mode === 'DEG') {
        isDegrees = true;
        btnDeg.classList.add('active');
        btnRad.classList.remove('active');
        btnDeg.style.fontWeight = 'bold';
        btnRad.style.fontWeight = 'normal';
    } else {
        isDegrees = false;
        btnRad.classList.add('active');
        btnDeg.classList.remove('active');
        btnRad.style.fontWeight = 'bold';
        btnDeg.style.fontWeight = 'normal';
    }
    // Recalculate preview if angle mode changes
    updatePreview();
}
// Initialize Rad mode
setAngleMode('RAD');

function toggleInverse() {
    isInverse = !isInverse;
    const btnInv = document.getElementById('btn-inv');
    const btnSin = document.getElementById('btn-sin');
    const btnCos = document.getElementById('btn-cos');
    const btnTan = document.getElementById('btn-tan');

    if (isInverse) {
        btnInv.style.background = 'var(--btn-hover)';
        btnSin.innerText = 'sin⁻¹';
        btnCos.innerText = 'cos⁻¹';
        btnTan.innerText = 'tan⁻¹';
    } else {
        btnInv.style.background = '';
        btnSin.innerText = 'sin';
        btnCos.innerText = 'cos';
        btnTan.innerText = 'tan';
    }
}

function appendTrig(func) {
    if (calculated) {
        display.value = '0';
        calculated = false;
    }
    if (isInverse) {
        append(`a${func}(`);
    } else {
        append(`${func}(`);
    }
}

// --- Calculation Engine ---

// Helper to safely evaluate expression without side effects
function evaluateExpression(expression) {
    try {
        // 1. Basic Replacements
        expression = expression
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace(/π/g, 'Math.PI')
            .replace(/e/g, 'Math.E')
            .replace(/E/g, '*10^') 
            .replace(/\^/g, '**')
            .replace(/ln\(/g, 'Math.log(')
            .replace(/log\(/g, 'Math.log10(')
            .replace(/sqrt\(/g, 'Math.sqrt(');

        // 2. Handle Percentage (%)
        // Standard Logic:
        // A + B% -> A + (A * B / 100)
        // A - B% -> A - (A * B / 100)
        // A * B% -> A * (B / 100)
        // A / B% -> A / (B / 100)

        // Match: [Number] [Space?] [+/-] [Space?] [Number] [Space?] %
        expression = expression.replace(/(\d+(\.\d+)?)\s*([\+\-])\s*(\d+(\.\d+)?)\s*%/g, (match, num1, d1, op, num2, d2) => {
            return `${num1} ${op} (${num1} * ${num2} / 100)`;
        });
        
        // Handle remaining simple percentages (for * and / cases, or just number%)
        // Match: [Number] [Space?] %
        expression = expression.replace(/(\d+(\.\d+)?)\s*%/g, (match, num) => {
            return `(${num} / 100)`;
        });

        // 3. Factorial
        expression = expression.replace(/(\d+)!/g, (match, num) => {
            let n = parseInt(num);
            let r = 1;
            for (let i = 2; i <= n; i++) r *= i;
            return r;
        });

        // 4. Trig functions
        const trigFuncs = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan'];
        trigFuncs.forEach(func => {
            const regex = new RegExp(`${func}\\(`, 'g');
            expression = expression.replace(regex, (match) => {
                if (isDegrees && !func.startsWith('a')) {
                    return `Math.${func}((Math.PI/180)*`; 
                } else if (isDegrees && func.startsWith('a')) {
                    return `(180/Math.PI)*Math.${func}(`;
                }
                return `Math.${func}(`;
            });
        });

        // Check if expression ends with an operator (incomplete)
        if (/[\+\-\*\/%^]$/.test(expression.trim())) return null;

        const result = new Function('return ' + expression)();
        
        if (!isFinite(result) || isNaN(result)) return null;
        
        return result;
    } catch (e) {
        return null;
    }
}

function updatePreview() {
    if (calculated) return; // Don't show preview if we are already showing a result

    const result = evaluateExpression(display.value);
    
    if (result !== null) {
        const formatted = Number.isInteger(result) ? result : parseFloat(result.toFixed(8));
        historyDisplay.innerText = `= ${formatted}`;
    } else {
        historyDisplay.innerText = '';
    }
}

function calculate() {
    // If already calculated or empty, do nothing
    if (calculated || display.value === '0') return;

    const originalExpr = display.value;
    const result = evaluateExpression(originalExpr);

    if (result !== null) {
        historyDisplay.innerText = originalExpr + ' =';
        lastAns = result;
        const formatted = Number.isInteger(result) ? result : parseFloat(result.toFixed(8));
        display.value = formatted;
        calculated = true;
    } else {
        display.value = 'Error';
        calculated = true;
    }
}

// --- Keyboard Support ---
document.addEventListener('keydown', (e) => {
    const key = e.key;
    if (/[0-9.]/.test(key)) append(key);
    if (['+', '-', '*', '/', '%', '(', ')', '^', '!'].includes(key)) append(key);
    if (key === 'Enter' || key === '=') calculate();
    if (key === 'Backspace') deleteLast();
    if (key === 'Escape') clearAll();
});