
let appState = {
    instrument: 'soprano', // 'soprano' | 'alto' | 'bass'
    selectedNote: null,
    currentScale: null,
    isPlayingScale: false,
    scaleTimeout: null,
    bpm: 60,
    oneOctave: false
};



// DOM Elements
const staffContainer = document.getElementById('staff-container');
const recorderWrapper = document.querySelector('.recorder-wrapper');
const noteBank = document.getElementById('note-bank');
const btnSoprano = document.getElementById('btn-soprano');
const btnAlto = document.getElementById('btn-alto');
const btnTenor = document.getElementById('btn-tenor');
const btnBass = document.getElementById('btn-bass');

// Initialization
function init() {
    setupListeners();
    renderScaleBank();
    renderStaff();
    selectNote(Object.keys(NOTE_DATA[appState.instrument])[0]);
}

function setupListeners() {
    if (btnSoprano) btnSoprano.onclick = () => setInstrument('soprano');
    if (btnAlto) btnAlto.onclick = () => setInstrument('alto');
    if (btnTenor) btnTenor.onclick = () => setInstrument('tenor');
    if (btnBass) btnBass.onclick = () => setInstrument('bass');

    const slider = document.getElementById('speed-slider');
    const valSpan = document.getElementById('bpm-value');
    if (slider) {
        slider.oninput = (e) => {
            appState.bpm = parseInt(e.target.value);
            if (valSpan) valSpan.innerText = appState.bpm;
        };
    }

    const checkOctave = document.getElementById('check-one-octave');
    if (checkOctave) {
        checkOctave.onchange = (e) => {
            appState.oneOctave = e.target.checked;
        };
    }
}



function setInstrument(inst) {
    if (appState.instrument === inst) return;
    appState.instrument = inst;
    if (btnSoprano) btnSoprano.classList.toggle('active', inst === 'soprano');
    if (btnAlto) btnAlto.classList.toggle('active', inst === 'alto');
    if (btnTenor) btnTenor.classList.toggle('active', inst === 'tenor');
    if (btnBass) btnBass.classList.toggle('active', inst === 'bass');
    renderScaleBank();
    renderStaff(); // Update clef
    const firstNote = Object.keys(NOTE_DATA[inst])[0];
    selectNote(firstNote);
}



const SCALES = ["C", "G", "D", "A", "E", "B", "F#", "F", "Bb", "Eb", "Ab", "Db"];
const KEY_SIGNATURES = {
    "C": { sharps: [] },
    "G": { sharps: [4] }, // F
    "D": { sharps: [4, 1] }, // F, C
    "A": { sharps: [4, 1, 5] }, // F, C, G
    "E": { sharps: [4, 1, 5, 2] }, // F, C, G, D
    "B": { sharps: [4, 1, 5, 2, -1] }, // F, C, G, D, A
    "F#": { sharps: [4, 1, 5, 2, -1, 3] }, // F, C, G, D, A, E
    "F": { flats: [0] }, // B
    "Bb": { flats: [0, 3] }, // B, E
    "Eb": { flats: [0, 3, -1] }, // B, E, A
    "Ab": { flats: [0, 3, -1, 2] }, // B, E, A, D
    "Db": { flats: [0, 3, -1, 2, -2] } // B, E, A, D, G
};

const BASS_KEY_OFFSETS = {
    sharps: [2, -1, 3, 0, -3, 1, -2],
    flats: [-2, 1, -3, 0, 3, -1, 2]
};

function renderScaleBank() {
    noteBank.innerHTML = '';
    const row1Div = document.createElement('div');
    row1Div.className = 'note-row';
    const row2Div = document.createElement('div');
    row2Div.className = 'note-row';

    SCALES.forEach((scale, index) => {
        const btn = document.createElement('button');
        btn.className = 'note-btn';
        btn.innerHTML = scale.replace('#', '♯').replace('b', '♭');
        btn.onclick = () => {
            appState.currentScale = scale;
            renderStaff(); 
            playScale(scale);
        };
        btn.dataset.scale = scale;

        // Equal distribution: 6 per row. F# starts the second row.
        if (index < 6) {
            row1Div.appendChild(btn);
        } else {
            row2Div.appendChild(btn);
        }
    });

    noteBank.appendChild(row1Div);
    noteBank.appendChild(row2Div);
}

function getMajorScaleNotes(root) {
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const flats = { "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#" };
    
    let rootName = root;
    if (flats[root]) rootName = flats[root];
    
    let rootIndex = noteNames.indexOf(rootName);
    const intervals = appState.oneOctave 
        ? [0, 2, 4, 5, 7, 9, 11, 12] 
        : [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
    
    // Starting octave
    let startOctave = 4;
    if (appState.instrument === 'bass') startOctave = 2;
    
    // Find the lowest tonic for the instrument
    const instrumentNotes = Object.keys(NOTE_DATA[appState.instrument]);
    const firstNote = instrumentNotes[0]; // Assuming sorted by pitch
    // Wait, let's find the absolute lowest tonic available
    let bestStartOctave = startOctave;
    
    // Find the lowest note in instrumentNotes that is the tonic
    // Or just start at the instrument's bottom and find the next tonic
    const noteToMidi = (n) => {
        const octave = parseInt(n.slice(-1));
        const name = n.slice(0, -1).replace("Db", "C#").replace("Eb", "D#").replace("Gb", "F#").replace("Ab", "G#").replace("Bb", "A#");
        return (octave + 1) * 12 + noteNames.indexOf(name);
    };

    const instrumentMidis = instrumentNotes.map(noteToMidi);
    const minMidi = Math.min(...instrumentMidis);
    
    // Find the first tonic >= minMidi
    let currentMidi = (startOctave + 1) * 12 + rootIndex;
    while (currentMidi < minMidi) {
        currentMidi += 12;
    }
    // Also check if we can go lower
    while (currentMidi - 12 >= minMidi) {
        currentMidi -= 12;
    }

    const midiToNote = (midi) => {
        const oct = Math.floor(midi / 12) - 1;
        const name = noteNames[midi % 12];
        // For scales like F, we prefer F. For scales like Gb, we prefer Gb.
        // But the internal data uses # mostly.
        return name + oct;
    };

    const scaleNotes = intervals.map(i => midiToNote(currentMidi + i));
    
    // Map internal # names back to user-friendly names if needed?
    // Actually, selectNote uses the keys from NOTE_DATA.
    // So we must match the keys in NOTE_DATA.
    // NOTE_DATA usually has # (C#4, D#4, F#4, G#4, A#4).
    
    return scaleNotes.filter(n => NOTE_DATA[appState.instrument][n]);
}

async function playScale(scaleName) {
    if (appState.isPlayingScale) {
        clearTimeout(appState.scaleTimeout);
    }
    
    appState.isPlayingScale = true;
    appState.currentScale = scaleName;
    
    document.querySelectorAll('.note-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.note-btn[data-scale="${scaleName}"]`);
    if (btn) btn.classList.add('active');

    const notes = getMajorScaleNotes(scaleName);
    
    // Triad logic: 1, 3, 5, 8 (tonic, third, fifth, octave)
    // getMajorScaleNotes returns the full scale.
    if (notes.length >= 8) {
        const triad = [notes[0], notes[2], notes[4], notes[7]];
        notes.push(...triad);
    }

    const titleEl = document.getElementById('staff-title');
    if (titleEl) titleEl.innerText = "Scale";

    let index = 0;

    const playNext = () => {
        if (index < notes.length) {
            const note = notes[index];
            
            // Check if we are in triad phase
            const scaleLength = appState.oneOctave ? 8 : 15;
            if (index >= scaleLength) {
                if (titleEl) titleEl.innerText = "Triad";
            } else {
                if (titleEl) titleEl.innerText = "Scale";
            }

            selectNote(note);
            if (typeof playNote === 'function') {
                playNote(note);
            }
            index++;
            
            // If we just finished the scale and are starting the triad, add a longer pause
            const isTransitionToTriad = index === scaleLength;
            const interval = 60000 / appState.bpm;
            const nextDelay = isTransitionToTriad ? interval * 2 : interval;

            appState.scaleTimeout = setTimeout(playNext, nextDelay);
        } else {
            appState.isPlayingScale = false;
        }
    };

    playNext();
}

function selectNote(noteKey) {
    appState.selectedNote = noteKey;
    // Don't clear note-btn active classes if we are playing a scale, 
    // unless we want to highlight the note buttons? But they are scales now.
    // So we don't need to find note buttons.
    updateStaff(noteKey);
    updateRecorder(noteKey);
}

// ----------------------
// Recorder Rendering
// ----------------------
function createRecorderElement(index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'recorder-visual';
    wrapper.id = `recorder-visual-${index}`;

    // Generated Cream Recorder Structure
    let html = `
        <div class="recorder-body">
            <div class="mouthpiece-area"></div>
            <div class="mouthpiece-window"></div>
            <div class="joint top"></div>
            <div class="joint middle"></div>
            <div class="joint foot"></div>
            
            <!-- Holes -->
            <!-- Thumb (0) -->
            <div class="hole" id="rec-${index}-hole-0"><div class="finger-dot"></div> <span class="thumb-label">Thumb</span></div>
            
            <!-- Standard Holes 1-5 -->
            <div class="hole" id="rec-${index}-hole-1"><div class="finger-dot"></div></div>
            <div class="hole" id="rec-${index}-hole-2"><div class="finger-dot"></div></div>
            <div class="hole" id="rec-${index}-hole-3"><div class="finger-dot"></div></div>
            <div class="hole" id="rec-${index}-hole-4"><div class="finger-dot"></div></div>
            <div class="hole" id="rec-${index}-hole-5"><div class="finger-dot"></div></div>
            
            <!-- Double Holes 6 & 7 -->
            <div class="hole-pair" id="rec-${index}-hole-6">
                <div class="hole-sub left"><div class="finger-dot"></div></div>
                <div class="hole-sub right"><div class="finger-dot"></div></div>
            </div>
            <div class="hole-pair" id="rec-${index}-hole-7">
                <div class="hole-sub left"><div class="finger-dot"></div></div>
                <div class="hole-sub right"><div class="finger-dot"></div></div>
            </div>
            
            <div class="bell">
                <div class="bell-cover" id="rec-${index}-bell-cover"></div>
            </div>
        </div>
    `;
    wrapper.innerHTML = html;
    return wrapper;
}

function updateRecorder(noteKey) {
    const container = document.querySelector('.recorder-wrapper');
    if (!container) return;
    container.innerHTML = '';

    if (!noteKey) return;
    const data = NOTE_DATA[appState.instrument][noteKey];
    if (!data) return;

    data.forEach((fingering, idx) => {
        const el = createRecorderElement(idx);
        container.appendChild(el);

        if (data.length > 1) {
            const label = document.createElement('div');
            label.className = 'alt-label';
            label.innerText = idx === 0 ? "Standard" : "Alternate";
            el.appendChild(label);
        }

        fingering.forEach((state, holeIdx) => {
            // Index 8: Bell Cover
            if (holeIdx === 8) {
                const cover = el.querySelector(`#rec-${idx}-bell-cover`);
                if (cover && state === 1) {
                    cover.classList.add('visible');
                    // Add label "Knee" or "Bell"?
                    // Could add tool tip if needed, but visual enough.
                }
            }
            // Handle Thumb & 1-5 (Single Holes)
            else if (holeIdx <= 5) {
                const hole = el.querySelector(`#rec-${idx}-hole-${holeIdx}`);
                if (!hole) return;
                hole.className = 'hole'; // reset
                if (state === 1) {
                    hole.classList.add('covered');
                } else if (state === 0.5) {
                    hole.className = 'hole half'; // Pinched thumb
                }
            }
            // Handle 6 & 7 (Double Holes)
            else {
                const pair = el.querySelector(`#rec-${idx}-hole-${holeIdx}`);
                if (!pair) return;
                const subs = pair.querySelectorAll('.hole-sub');

                // State 1: Both Covered
                if (state === 1) {
                    subs.forEach(s => s.classList.add('covered'));
                }
                // State 0.5: One Covered
                // User requirement: "when it's only one hole, it's the smaller one to the left..."
                // So cover the Left one (index 0).
                else if (state === 0.5) {
                    subs[0].classList.add('covered'); // Left Covered
                }
                // State 0: Open
            }
        });
    });
}

// ----------------------
// Staff Rendering
// ----------------------
function renderStaff() {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 -15 200 165");
    svg.classList.add("staff-svg");
    svg.style.cursor = "pointer";

    const bgRect = document.createElementNS(ns, "rect");
    bgRect.setAttribute("x", "-20");
    bgRect.setAttribute("y", "-15");
    bgRect.setAttribute("width", "240");
    bgRect.setAttribute("height", "165");
    bgRect.setAttribute("fill", "transparent");
    svg.appendChild(bgRect);

    const offMap = appState.instrument === 'bass' ? BASS_OFFSETS : NOTE_OFFSETS;
    const instrumentNotes = Object.keys(NOTE_DATA[appState.instrument]);
    const values = instrumentNotes.map(n => offMap[n]);
    const minOff = Math.min(...values);
    const maxOff = Math.max(...values);
    
    // If the top note contains a Sharp, its enharmonic Flat calculates 1 offset higher.
    const hasHighestSharp = instrumentNotes.some(n => offMap[n] === maxOff && n.includes('#'));
    const maxLineCalc = hasHighestSharp ? maxOff + 1 : maxOff;
    
    const minOffRaw = Math.ceil(minOff / 2) * 2;
    const maxOffRaw = Math.floor(maxLineCalc / 2) * 2;
    
    // Guarantee that at least the 5 main staff lines (-4 to 4) are always drawn
    const minLine = Math.min(-4, minOffRaw);
    const maxLine = Math.max(4, maxOffRaw);
    
    for (let offset = minLine; offset <= maxLine; offset += 2) {
        const cy = 70 - (offset * 5);
        if (offset >= -4 && offset <= 4) {
            const line = document.createElementNS(ns, "line");
            line.setAttribute("x1", "10");
            line.setAttribute("y1", cy);
            line.setAttribute("x2", "190");
            line.setAttribute("y2", cy);
            line.setAttribute("stroke", "#aaa");
            line.setAttribute("stroke-width", "2");
            svg.appendChild(line);
        } else {
            const line = document.createElementNS(ns, "line");
            line.setAttribute("x1", "10");
            line.setAttribute("x2", "190");
            line.setAttribute("y1", cy);
            line.setAttribute("y2", cy);
            line.setAttribute("stroke", "#555");
            line.setAttribute("stroke-width", "1");
            line.setAttribute("stroke-dasharray", "4 4");
            svg.appendChild(line);
        }
    }

    const clefTxt = document.createElementNS(ns, "text");
    clefTxt.setAttribute("x", "15");
    clefTxt.setAttribute("fill", "#ddd");
    
    clefTxt.setAttribute("dominant-baseline", "middle");
    if (appState.instrument === 'bass') {
        clefTxt.setAttribute("y", "65"); // Moved down from 60 to align eye/dots with F line
        clefTxt.setAttribute("font-size", "30");
        clefTxt.textContent = "𝄢";
    } else {
        clefTxt.setAttribute("y", "80"); // G line
        clefTxt.setAttribute("font-size", "35");
        clefTxt.textContent = "𝄞";
    }
    
    svg.appendChild(clefTxt);

    // Key Signature Rendering
    if (appState.currentScale && KEY_SIGNATURES[appState.currentScale]) {
        const ks = KEY_SIGNATURES[appState.currentScale];
        let xPos = 38;
        if (ks.sharps) {
            ks.sharps.forEach((off, i) => {
                let finalOff = off;
                if (appState.instrument === 'bass') {
                    finalOff = BASS_KEY_OFFSETS.sharps[i];
                }
                const acc = document.createElementNS(ns, "text");
                acc.setAttribute("x", xPos);
                acc.setAttribute("y", 70 - (finalOff * 5) + 5);
                acc.setAttribute("fill", "var(--primary)");
                acc.setAttribute("font-size", "20");
                acc.textContent = "♯";
                svg.appendChild(acc);
                xPos += 8;
            });
        }
        if (ks.flats) {
            ks.flats.forEach((off, i) => {
                let finalOff = off;
                if (appState.instrument === 'bass') {
                    finalOff = BASS_KEY_OFFSETS.flats[i];
                }
                const acc = document.createElementNS(ns, "text");
                acc.setAttribute("x", xPos);
                acc.setAttribute("y", 70 - (finalOff * 5) + 5);
                acc.setAttribute("fill", "var(--primary)");
                acc.setAttribute("font-size", "20");
                acc.textContent = "♭";
                svg.appendChild(acc);
                xPos += 8;
            });
        }
    }

    const noteGroup = document.createElementNS(ns, "g");
    noteGroup.id = "staff-note-group";
    svg.appendChild(noteGroup);

    staffContainer.innerHTML = '';
    staffContainer.appendChild(svg);
    
    svg.addEventListener('click', (e) => {
        if (appState.mode === 'quiz') return;
        
        let pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
        const svgY = svgP.y;
        
        const offset = Math.round((70 - svgY) / 5);
        
        let targetNote = null;
        let matchingNotes = instrumentNotes.filter(n => offMap[n] === offset);
        
        if (matchingNotes.length > 0) {
            // Only select the natural note
            targetNote = matchingNotes.find(n => !n.includes('#')) || matchingNotes[0];
        }

        if (targetNote) {
            selectNote(targetNote);
            if (typeof playNote === 'function') {
                playNote(targetNote);
            }
        }
    });

}

function updateStaff(noteKey) {
    const group = document.getElementById("staff-note-group");
    if (!group) return;
    group.innerHTML = '';

    const offMap = appState.instrument === 'bass' ? BASS_OFFSETS : NOTE_OFFSETS;
    const offset = offMap[noteKey];
    if (offset === undefined) return;

    const ns = "http://www.w3.org/2000/svg";
    const centerY = 70;
    const stepSize = 5;

    // Helper to draw a single note
    function drawNote(cx, noteOffset, accidental, displayName) {
        const cy = centerY - (noteOffset * stepSize);

        // Ledgers
        // Lines are at 50, 60, 70, 80, 90.
        // Ledgers needed if cy <= 40 (High) or cy >= 100 (Low C4 is 100)

        // High Ledgers
        if (cy <= 40) {
            let curr = 40;
            while (curr >= cy) {
                const line = document.createElementNS(ns, "line");
                line.setAttribute("x1", cx - 20); line.setAttribute("x2", cx + 20);
                line.setAttribute("y1", curr); line.setAttribute("y2", curr);
                line.setAttribute("stroke", "#aaa"); line.setAttribute("stroke-width", "2");
                group.appendChild(line);
                curr -= 10;
            }
        }
        // Low Ledgers
        if (cy >= 100) {
            let curr = 100;
            while (curr <= cy) {
                const line = document.createElementNS(ns, "line");
                line.setAttribute("x1", cx - 20); line.setAttribute("x2", cx + 20);
                line.setAttribute("y1", curr); line.setAttribute("y2", curr);
                line.setAttribute("stroke", "#aaa"); line.setAttribute("stroke-width", "2");
                group.appendChild(line);
                curr += 10;
            }
        }

        // Note Head
        const noteHead = document.createElementNS(ns, "ellipse");
        noteHead.setAttribute("cx", cx);
        noteHead.setAttribute("cy", cy);
        noteHead.setAttribute("rx", "8");
        noteHead.setAttribute("ry", "6");
        noteHead.setAttribute("fill", "#fff");
        group.appendChild(noteHead);

        // Accidental
        if (accidental) {
            const acc = document.createElementNS(ns, "text");
            // Adjust position: Sharp allows a bit more left, Flat matches
            acc.setAttribute("x", cx - 25);
            acc.setAttribute("y", cy + 5);
            acc.setAttribute("fill", "#fff");
            acc.setAttribute("font-size", "22"); // Slightly larger for clarity
            acc.textContent = accidental;
            group.appendChild(acc);
        }

        // Note Name below
        if (displayName) {
            const nameTxt = document.createElementNS(ns, "text");
            nameTxt.setAttribute("x", cx);
            nameTxt.setAttribute("y", 145);
            nameTxt.setAttribute("text-anchor", "middle");
            nameTxt.setAttribute("fill", "var(--primary)");
            nameTxt.setAttribute("font-size", "22");
            nameTxt.setAttribute("font-weight", "bold");
            nameTxt.textContent = displayName;
            group.appendChild(nameTxt);
        }
    }

    const ks = KEY_SIGNATURES[appState.currentScale] || { sharps: [] };
    const prefersFlats = ks.flats && ks.flats.length > 0;

    if (noteKey.includes("#")) {
        const baseNote = noteKey.replace(/[0-9]/g, '');
        if (prefersFlats) {
            // Show only Flat
            const flatMap = { "C#": "D♭", "D#": "E♭", "F#": "G♭", "G#": "A♭", "A#": "B♭" };
            const flatDisplay = flatMap[baseNote] || baseNote;
            drawNote(110, offset + 1, "♭", flatDisplay);
        } else {
            // Show only Sharp
            const sharpDisplay = baseNote.replace('#', '♯');
            drawNote(110, offset, "♯", sharpDisplay);
        }
    } else {
        // Natural
        const naturalDisplay = noteKey.replace(/[0-9]/g, '');
        drawNote(110, offset, null, naturalDisplay);
    }
}



function clearVisuals() {
    const group = document.getElementById("staff-note-group");
    if (group) group.innerHTML = '';
    const container = document.querySelector('.recorder-wrapper');
    if (container) container.innerHTML = '';
}

init();
