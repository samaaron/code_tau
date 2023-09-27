// Coded by Guy Brown

// ------------------------------------------------------------
// My first WebAudio synth, an emulation of the Roland TB303 Bassline
// ------------------------------------------------------------

export function playNote(audioContext, pitch, startTime, dur, params) {
  // params is a JSON object, decode parameters from it
  // sanity check since we can throw errors for inappropriate values (e.g. cannot have zero exponent)

  cutoff_freq = clamp(params.cutoff, 30, 20000);
  resonance = clamp(params.resonance, 0, 30); // filter can go unstable and continue to ring otherwise
  distortion_level = clamp(params.distortion, 0, 300);
  decay_level = clamp(params.decay_level, 0.01, 1);
  osc_mix = clamp(params.osc_mix, 0, 1);
  filter_mod = clamp(params.filter_mod, 0, 1);
  slide_semitones = clamp(params.slide, -24, 24); // assume no more than two octaves slide
  accent_level = clamp(params.accent, 0, 1);
  delay_time = clamp(params.delay_time, 0, 2); // maximum 2 second delay
  delay_level = clamp(params.delay_level, 0, 1);
  feedback_level = clamp(params.feedback_level, 0, 0.9);

  // the TB303 is switchable between saw and square, but we allow blending of the two

  // square oscillator

  var squareOsc = audioContext.createOscillator();
  squareOsc.type = "square";

  // saw oscillator

  var sawOsc = audioContext.createOscillator();
  sawOsc.type = "sawtooth";

  // apply the mixing gain to the saw oscillator

  const sawGain = audioContext.createGain();
  sawGain.gain.value = osc_mix;

  // apply the mixing gain to the square oscillator

  const squareGain = audioContext.createGain();
  squareGain.gain.value = 1 - osc_mix;

  // connect the oscillators to the gains

  squareOsc.connect(squareGain);
  sawOsc.connect(sawGain);

  // mix them together with another gain node (set to 0.5 to avoid clipping)

  const mixer = audioContext.createGain();
  mixer.gain.value = 0.5 + 0.5 * accent_level;
  sawGain.connect(mixer);
  squareGain.connect(mixer);

  // sliding pitches are characteristic of the TB303 so we'd better do that
  // since webaudio makes a new oscillator for each note we cant really slide
  // between notes
  // However, we can define a simple pitch envelope which rises or falls
  // a number of semitones over the duration of the note
  // if you dont want a slide then just set the parameter to zero
  // this is a quite crude approximation of the actual sliding behaviour since in the TB303
  // the slide starts before a note is played, not as it is played - tricky with WebAudio
  // https://www.reddit.com/r/TechnoProduction/comments/vlfphq/303_envelope_driving_me_up_the_wall/

  const targetPitch = pitch * Math.pow(2, slide_semitones / 12.0);

  sawOsc.frequency.setValueAtTime(pitch, startTime);
  sawOsc.frequency.linearRampToValueAtTime(targetPitch, startTime + dur);
  squareOsc.frequency.setValueAtTime(pitch, startTime);
  squareOsc.frequency.exponentialRampToValueAtTime(
    targetPitch,
    startTime + dur
  );

  // Create a lowpass filter node
  // the filter is actually a bit more complex with two resonant peaks but this will do for now
  // https://www.reddit.com/r/TechnoProduction/comments/vlfphq/303_envelope_driving_me_up_the_wall/

  var filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = resonance;

  // Connect the oscillator to the filter

  mixer.connect(filter);

  // filter envelope

  // Set the initial and target values for the envelope
  // we use a simple exponential decay since that is what the TB303 has
  // https://www.firstpr.com.au/rwi/dfish/303-unique.html
  // the amount that the cutoff falls depends on the filter mod control
  // assume that the lowest possible cutoff is 30Hz which is around C1
  // we could model this properly with a bit of effort (student project?)

  const LOWEST_CUTOFF = 30; // Hz
  const targetFrequency =
    cutoff_freq - params.filter_mod * (cutoff_freq - LOWEST_CUTOFF);
  filter.frequency.setValueAtTime(cutoff_freq * (1 + accent_level), startTime);
  filter.frequency.exponentialRampToValueAtTime(
    targetFrequency,
    startTime + dur
  );

  // VCA

  const vca = audioContext.createGain();
  vca.gain.setValueAtTime(1, startTime);
  vca.gain.exponentialRampToValueAtTime(decay_level, startTime + dur);

  filter.connect(vca);

  // distortion, using a waveshaper

  distortion = audioContext.createWaveShaper();
  distortion.curve = makeDistortionCurve(distortion_level);
  distortion.oversample = "4x";

  // Connect the filter to the audio context destination (speakers)

  vca.connect(distortion);

  // TB303 always sounds good through delay
  // so ... add a delay line with feedback

  var delay = audioContext.createDelay();
  delay.delayTime.value = delay_time;

  // this determines the amount of feedback back into the delay line

  var feedbackLevel = audioContext.createGain();
  feedbackLevel.gain.value = feedback_level;

  // this determines the amount of delay that goes to the audio out

  var delayLevel = audioContext.createGain();
  delayLevel.gain.value = delay_level;

  // connect everything up
  // note that the output of the delay goes back into it, via the feedback gain

  distortion.connect(delay);
  delay.connect(feedbackLevel);
  feedbackLevel.connect(delay);
  delay.connect(delayLevel);

  // finally, connect the delayed and undelayed signals to the output

  distortion.connect(audioContext.destination);
  delayLevel.connect(audioContext.destination);

  // Start the oscillators

  squareOsc.start(startTime);
  sawOsc.start(startTime);

  // Stop the oscillators

  squareOsc.stop(startTime + dur);
  sawOsc.stop(startTime + dur);
}

// ------------------------------------------------------------
// make a saturating function for distorting the signal
// slightly modified from an example in the webaudio tutorial
// see https://alexanderleon.medium.com/web-audio-series-part-2-designing-distortion-using-javascript-and-the-web-audio-api-446301565541
// ------------------------------------------------------------

function makeDistortionCurve(amount) {
  const k = typeof amount === "number" ? amount : 50;
  const numSamples = 44100;
  const curve = new Float32Array(numSamples);
  const deg = Math.PI / 180.0;

  for (let i = 0; i < numSamples; i++) {
    const x = (i * 2) / numSamples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

// ------------------------------------------------------------
// utility functions all kindly written by ChatGPT
// ------------------------------------------------------------

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
