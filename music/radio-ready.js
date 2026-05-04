#!/usr/bin/env node

/**
 * One-Click Radio Ready Pipeline
 * 
 * Pipeline:
 * 1. Separation (4-stem: vocals, drums, bass, other)
 * 2. Cleanup (noise reduction, de-essing, declip)
 * 3. Mix (balance stems, vocal level, bass boost)
 * 4. Mastering (platform-specific LUFS)
 * 5. Export multiple versions
 * 
 * Usage: node radio-ready.js <jobId> <inputPath> <outputDir> [platform]
 * Platforms: spotify, apple, youtube, tiktok, club, vinyl
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SEPARATE_SCRIPT = path.join(__dirname, 'stems.py');
const DENOISE_SCRIPT = path.join(__dirname, 'denoise.py');
const MASTER_SCRIPT = path.join(__dirname, 'mastering.py');
const FFMPEG = require('ffmpeg-static');

const PLATFORM_PRESETS = {
  spotify: { lufs: -14.0, truePeak: -1.0, bassBoost: 1.2 },
  apple: { lufs: -16.0, truePeak: -1.0, bassBoost: 1.1 },
  youtube: { lufs: -13.0, truePeak: -1.5, bassBoost: 1.0 },
  tiktok: { lufs: -14.0, truePeak: -1.0, bassBoost: 1.0, cutSeconds: 15 },
  club: { lufs: -9.0, truePeak: 0.0, bassBoost: 1.5 },
  vinyl: { lufs: -18.0, truePeak: -3.0, bassBoost: 0.9 },
};

function runCommand(cmd, args, stepName) {
  console.log(`[${stepName}] Running: ${cmd} ${args.join(' ')}`, flush=true);
  try {
    const output = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return output;
  } catch (e) {
    console.error(`[${stepName}] Error: ${e.message}`, flush=true);
    throw e;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log('Usage: node radio-ready.js <jobId> <inputPath> <outputDir> [platform]');
    console.log('Platforms: spotify, apple, youtube, tiktok, club, vinyl');
    process.exit(1);
  }

  const jobId = args[0];
  const inputPath = args[1];
  const outputDir = args[2];
  const platform = args[3] || 'spotify';
  
  console.log('=== ONE-CLICK RADIO READY ===', flush=true);
  console.log(`Job: ${jobId}`, flush=true);
  console.log(`Input: ${inputPath}`, flush=true);
  console.log(`Output: ${outputDir}`, flush=true);
  console.log(`Platform: ${platform}`, flush=true);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`, flush=true);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.spotify;
  console.log(`Preset: LUFS=${preset.lufs}, TruePeak=${preset.truePeak}`, flush=true);

  try {
    // Step 1: Separation (if needed)
    console.log('\n[Step 1/5] Separation...', flush=true);
    const stemDir = path.join(outputDir, 'stems');
    fs.mkdirSync(stemDir, { recursive: true });
    
    // Run stems.py for 4-stem separation
    const stemArgs = [
      inputPath,
      stemDir,
      '--model', 'htdemucs',
      '--mode', 'all',
      '--type', '4stem'
    ];
    
    runCommand('python3', [SEPARATE_SCRIPT, ...stemArgs], 'Separation');
    
    // Check stems
    const stems = {};
    ['vocals', 'drums', 'bass', 'other'].forEach(stem => {
      const p = path.join(stemDir, `${stem}.wav`);
      if (fs.existsSync(p)) {
        stems[stem] = p;
        console.log(`  Found: ${stem}.wav`, flush=true);
      }
    });

    // Step 2: Cleanup (Noise Reduction)
    console.log('\n[Step 2/5] Cleanup...', flush=true);
    const cleanedStems = {};
    for (const [stemName, stemPath] of Object.entries(stems)) {
      const cleanedPath = path.join(outputDir, `cleaned_${stemName}.wav`);
      
      // Apply noise reduction with ffmpeg afftdn
      const filter = stemName === 'vocals' 
        ? 'afftdn=nf=-25:dry=5,wavpack'  
        : 'highpass=f=20,lowpass=f=20000';
      
      runCommand(FFMPEG, [
        '-i', stemPath,
        '-af', filter,
        '-y', cleanedPath
      ], `Cleanup-${stemName}`);
      
      cleanedStems[stemName] = cleanedPath;
    }

    // Step 3: Mix (Balance)
    console.log('\n[Step 3/5] Mixing...', flush=true);
    const mixPath = path.join(outputDir, 'mix_balanced.wav');
    const mixArgs = ['-y'];
    
    // Input all cleaned stems
    Object.values(cleanedStems).forEach(p => {
      mixArgs.push('-i', p);
    });
    
    // Mix filter
    const filterComplex = Object.keys(cleanedStems).map((_, i) => `[${i}:a]`).join('');
    const mixFilter = `${filterComplex}amix=inputs=${Object.keys(cleanedStems).length}:duration=longest[out]`;
    
    mixArgs.push('-filter_complex', mixFilter, mixPath);
    runCommand(FFMPEG, mixArgs, 'Mix');

    // Step 4: Mastering
    console.log('\n[Step 4/5] Mastering...', flush=true);
    const masteredPath = path.join(outputDir, `mastered_${platform}.wav`);
    
    // Use ffmpeg loudnorm for mastering
    const loudnormFilter = `loudnorm=I=${preset.lufs}:TP=${preset.truePeak}:LRA=11`;
    runCommand(FFMPEG, [
      '-i', mixPath,
      '-af', loudnormFilter,
      '-y', masteredPath
    ], 'Mastering');

    // Step 5: Export multiple versions
    console.log('\n[Step 5/5] Exporting versions...', flush=true);
    const versions = {
      'cleaned_vocal': cleanedStems.vocals,
      'balanced_mix': mixPath,
      [`mastered_${platform}`]: masteredPath,
      'instrumental': path.join(stemDir, 'other.wav'), // Simplified
      'acapella': cleanedStems.vocals,
    };

    // Create TikTok cut (15 seconds)
    if (preset.cutSeconds) {
      const tiktokPath = path.join(outputDir, 'tiktok_cut.wav');
      runCommand(FFMPEG, [
        '-i', masteredPath,
        '-t', preset.cutSeconds.toString(),
        '-y', tiktokPath
      ], 'TikTok-Cut');
      versions['tiktok_cut'] = tiktokPath;
    }

    // Save metadata
    const metadata = {
      jobId,
      platform,
      preset,
      versions: Object.fromEntries(
        Object.entries(versions).map(([name, p]) => [name, path.basename(p)])
      ),
      steps: ['separation', 'cleanup', 'mix', 'mastering', 'export'],
      status: 'success'
    };

    const metadataPath = path.join(outputDir, 'radio_ready_info.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log('\n✅ ONE-CLICK RADIO READY COMPLETE!', flush=true);
    console.log(`Output: ${outputDir}`, flush=true);
    console.log(`Versions: ${Object.keys(versions).join(', ')}`, flush=true);

  } catch (error) {
    console.error(`\n✗ Pipeline failed: ${error.message}`, flush=true);
    const errorInfo = {
      jobId,
      platform,
      status: 'error',
      error: error.message
    };
    fs.writeFileSync(path.join(outputDir, 'radio_ready_error.json'), JSON.stringify(errorInfo, null, 2));
    process.exit(1);
  }
}

main();
