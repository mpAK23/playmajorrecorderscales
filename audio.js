// audio.js - Web Audio API Version (Guaranteed Pitch Shift)

let audioCtx = null;
let mainGain = null;
const baseUrl = "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/recorder-mp3/";

// Note Map (Alto Samples)
const sampleMap = {
    "C4": "C4.mp3",
    "E4": "E4.mp3",
    "A4": "A4.mp3",
    "C5": "C5.mp3"
};

const audioBuffers = {};
let currentSource = null;

function initAudio() {
    if (audioCtx) return;
    
    console.log("Initializing Audio...");
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    mainGain = audioCtx.createGain();
    mainGain.gain.value = 0.8;
    mainGain.connect(audioCtx.destination);

    // Preload all
    Object.keys(sampleMap).forEach(loadSample);

    // Resume context on interaction (standard browser policy)
    const resume = () => {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => {
                console.log("AudioContext resumed.");
            });
        }
        // Keep listeners if they might be needed again, but usually one successful resume is enough.
        // However, some browsers are picky.
    };
    document.addEventListener('click', resume);
    document.addEventListener('keydown', resume);
}

async function loadSample(note) {
    if (audioBuffers[note]) return audioBuffers[note];

    try {
        console.log(`Loading sample: ${note}`);
        const response = await fetch(baseUrl + sampleMap[note]);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioBuffers[note] = audioBuffer;
        console.log(`Sample loaded: ${note}`);
        return audioBuffer;
    } catch (e) {
        console.error(`Sample Load Error (${note}):`, e);
        return null;
    }
}

// Helper to get nearest sample and rate logic
function getSampleInfo(targetNote) {
    const noteToMidi = (note) => {
        const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        // Handle flats
        const n = note.replace("Db", "C#").replace("Eb", "D#").replace("Gb", "F#").replace("Ab", "G#").replace("Bb", "A#");
        const octave = parseInt(n.slice(-1));
        const name = n.slice(0, -1);
        const idx = notes.indexOf(name);
        return (octave + 1) * 12 + idx;
    };

    const targetMidi = noteToMidi(targetNote);

    // Find nearest
    const samples = Object.keys(sampleMap);
    let nearest = samples[0];
    let minDiff = Infinity;

    samples.forEach(s => {
        const sMidi = noteToMidi(s);
        const diff = Math.abs(targetMidi - sMidi);
        if (diff < minDiff) {
            minDiff = diff;
            nearest = s;
        }
    });

    const sampleMidi = noteToMidi(nearest);
    const semitoneDiff = targetMidi - sampleMidi;
    // Rate = 2 ^ (semitones / 12)
    const rate = Math.pow(2, semitoneDiff / 12);

    return { note: nearest, rate: rate };
}

async function playNote(noteKey) {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    stopAllNotes();

    console.log(`Attempting to play note: ${noteKey}`);

    // Parse logic
    let targetNote = noteKey;
    let extraRate = 1.0;

    if (typeof appState !== 'undefined') {
        if (appState.instrument === 'soprano') {
            extraRate = 2.0;
        } else if (appState.instrument === 'bass') {
            extraRate = 2.0;
        }
    }

    const info = getSampleInfo(targetNote);
    const finalRate = info.rate * extraRate;

    // Get Buffer
    let buffer = audioBuffers[info.note];
    if (!buffer) {
        buffer = await loadSample(info.note);
    }
    if (!buffer) return;

    // Play
    currentSource = audioCtx.createBufferSource();
    currentSource.buffer = buffer;
    currentSource.playbackRate.value = finalRate;
    currentSource.connect(mainGain);
    currentSource.start(0);
}

function stopAllNotes() {
    if (currentSource) {
        try {
            currentSource.stop();
        } catch (e) {}
        currentSource = null;
    }
}

// Start initialization
initAudio();

