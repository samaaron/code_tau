import { playNote } from "./tb303";

class TauSynth {
  ctx = null;
  smpl = null;
  track = null;
  buffer = null;

  constructor(ctx) {
    this.ctx = ctx;
  }

  midi_to_hz(m) {
    return Math.pow(2, (m - 69) / 12) * 440;
  }

  synth(time, freq, dur) {
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    gain.gain.value = 0.5;
    gain.gain.linearRampToValueAtTime(0, time + dur);
    oscillator.frequency.value = this.midi_to_hz(freq);
    oscillator.connect(gain);
    gain.connect(this.ctx.destination);
    oscillator.start(time);
    oscillator.stop(time + dur + 0.1);
  }

  tb303synth(time, freq, dur) {
    const t = 60 / 120 / 4;
    const params = {
      cutoff: 500, // cutoff of the filter in Hz
      resonance: 20, // resonance in range [0,30]
      distortion: 100, // distortion in range [0,400]
      decay_level: 0.05, // determines the level in the range [0.01,1] that the VCA decays to
      osc_mix: 0.5, // oscillator mix, 0 is square, 1 is saw, 0.5 is equal mix
      filter_mod: 0.5, // filter modulation in range [0,1], determines the extent to which the cutoff is modulated by an exponential decay
      slide: 0, // the pitch slide for this note, in semitones range [-24,24]
      accent: 0, // if accented, the filter opens up a bit and the volume increases [0,1]
      delay_time: t * 1, // delay time in seconds [0,2]
      delay_level: 0.5, // delay level in range [0,1]
      feedback_level: 0.8, // feedback level in range [0,0.9]
    };
    playNote(this.ctx, this.midi_to_hz(freq), time, dur, params);
  }
}

export default class TauAudio {
  audio_context = null;
  synth = null;
  initial_audio_context_time_s = 0;
  base_audio_context_time_s = 0;
  initial_wallclock_time_s = 0;
  server_wallclock_offset_s = 0;

  constructor() {}

  async userInit() {
    if (this.audio_context === null) {
      this.audio_context = new AudioContext();
      this.started = true;
      this.initial_audio_context_time_s = this.audio_context.currentTime;
      this.base_audio_context_time_s =
        this.initial_audio_context_time_s + this.audio_context.baseLatency;
      this.initial_wallclock_time_s = Date.now() / 1000;

      this.synth = new TauSynth(this.audio_context);
      console.log("-------> started");
      // console.log(`base latency: ${this.audio_context.baseLatency}`)
      // console.log(`output latency: ${this.audio_context.outputLatency}`)
      // console.log(`output now: ${Date.now()}`)
      // alert(`latency: ${this.audio_context.baseLatency},  ${this.audio_context.outputLatency}`)
    }
  }

  updateServerTimeOffset(time) {
    this.server_wallclock_offset_s = time - Date.now() / 1000;
  }

  dispatch(time, json) {
    // don't do any audio stuff if the audio hasn't started
    if (!this.started) {
      return;
    }
    // const time_now = Date.now() / 1000;
    const delta_s = time - this.initial_wallclock_time_s + 0.2;
    // console.log(`delta_s ${delta_s}`);
    // console.log(`time ${time}`);
    // console.log(`initial wallclock ${this.initial_wallclock_time_s}`);
    const audio_context_sched_s = this.base_audio_context_time_s + delta_s; //- this.audio_context.baseLatency

    switch (json.method) {
      case "play":
        this.play(audio_context_sched_s, json);
        break;
      case "sample":
        this.sample(audio_context_sched_s, json);
        break;

      default:
        console.log(`Tau Audio dispatch method unknown ${json.method}`);
    }
  }

  play(time, args) {
    this.synth.tb303synth(time, args.note, 0.2);
  }

  sample(time, args) {
    this.synth.sample(time, args.rate);
  }
}
