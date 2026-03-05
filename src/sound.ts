export class SoundManager {
  ctx: AudioContext | null = null;
  bgmOsc: OscillatorNode | null = null;
  bgmGain: GainNode | null = null;
  lfo: OscillatorNode | null = null;
  
  enabled = true;
  bgmEnabled = true; 
  volume = 0.3;
  
  lastTapTime = 0;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTap() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastTapTime < 0.05) return;
    this.lastTapTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
    gain.gain.setValueAtTime(0.3 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playTurnSwitch() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
    gain.gain.setValueAtTime(0.1 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playWin() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc2.type = 'square';
    
    [osc1, osc2].forEach((osc, i) => {
      const baseFreq = i === 0 ? 440 : 220;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.setValueAtTime(baseFreq * 1.2599, now + 0.2);
      osc.frequency.setValueAtTime(baseFreq * 1.4983, now + 0.4);
      osc.frequency.setValueAtTime(baseFreq * 2, now + 0.6);
    });

    gain.gain.setValueAtTime(0.2 * this.volume, now);
    gain.gain.linearRampToValueAtTime(0, now + 1.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.5);
    osc2.stop(now + 1.5);
  }

  playLose() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 1);
    gain.gain.setValueAtTime(0.3 * this.volume, now);
    gain.gain.linearRampToValueAtTime(0, now + 1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 1);
  }

  bgmInterval: number | null = null;
  nextNoteTime = 0;
  currentNote = 0;
  
  // Upbeat retro electronic bassline/arpeggio
  notes = [
    440, 440, 523.25, 440, 659.25, 440, 587.33, 440,
    349.23, 349.23, 440, 349.23, 523.25, 349.23, 493.88, 349.23,
    392.00, 392.00, 493.88, 392.00, 587.33, 392.00, 523.25, 392.00,
    329.63, 329.63, 392.00, 329.63, 493.88, 329.63, 440, 329.63
  ]; // A minor, F major, G major, E minor arpeggios (16th notes)
  tempo = 130; // BPM

  scheduleNote() {
    if (!this.ctx) return;
    const secondsPerBeat = 60.0 / this.tempo;
    const secondsPer16th = secondsPerBeat * 0.25;

    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this.playBGMNote(this.notes[this.currentNote], this.nextNoteTime, secondsPer16th);
      this.nextNoteTime += secondsPer16th;
      this.currentNote = (this.currentNote + 1) % this.notes.length;
    }
  }

  playBGMNote(freq: number, time: number, duration: number) {
    if (!this.ctx || !this.bgmEnabled) return;
    
    // Bass synth
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq / 2, time); // One octave down for bass

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, time);
    filter.frequency.exponentialRampToValueAtTime(200, time + duration * 0.8);
    filter.Q.value = 5;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.1 * this.volume, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.9);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + duration);
    
    // Kick drum on every beat (every 4th 16th note)
    if (this.currentNote % 4 === 0) {
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(150, time);
      kickOsc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);
      
      kickGain.gain.setValueAtTime(0.3 * this.volume, time);
      kickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
      
      kickOsc.connect(kickGain);
      kickGain.connect(this.ctx.destination);
      
      kickOsc.start(time);
      kickOsc.stop(time + 0.1);
    }
    
    // Hi-hat on off-beats
    if (this.currentNote % 2 !== 0) {
      const hatOsc = this.ctx.createOscillator();
      const hatGain = this.ctx.createGain();
      const hatFilter = this.ctx.createBiquadFilter();
      
      hatOsc.type = 'square';
      hatOsc.frequency.setValueAtTime(400, time);
      
      hatFilter.type = 'highpass';
      hatFilter.frequency.value = 8000;
      
      hatGain.gain.setValueAtTime(0.05 * this.volume, time);
      hatGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
      
      hatOsc.connect(hatFilter);
      hatFilter.connect(hatGain);
      hatGain.connect(this.ctx.destination);
      
      hatOsc.start(time);
      hatOsc.stop(time + 0.05);
    }
  }

  startBGM() {
    if (!this.bgmEnabled || !this.ctx) return;
    if (this.bgmInterval) return;

    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.currentNote = 0;
    
    this.bgmInterval = window.setInterval(() => this.scheduleNote(), 25);
  }

  stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  setVolume(v: number) {
    this.volume = v;
  }

  toggleBGM() {
    this.bgmEnabled = !this.bgmEnabled;
    if (this.bgmEnabled) {
      this.startBGM();
    } else {
      this.stopBGM();
    }
  }

  toggleSFX() {
    this.enabled = !this.enabled;
  }
}

export const soundManager = new SoundManager();
