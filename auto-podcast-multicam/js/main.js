(function () {
  'use strict';

  var cs = new CSInterface();
  var logEl = document.getElementById('log');
  var folderInput = document.getElementById('folderPath');
  var useGemini = document.getElementById('useGemini');
  var geminiKey = document.getElementById('geminiKey');
  var fs = window.cep && window.cep.fs ? window.cep.fs : null;
  var nodeRequire = typeof require === 'function' ? require : null;

  function log(message) {
    var stamp = new Date().toLocaleTimeString();
    logEl.textContent += '\n[' + stamp + '] ' + message;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function escapeForExtendScript(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r?\n/g, '\\n');
  }

  function evalJson(functionName, payload, callback) {
    var script = functionName + "('" + escapeForExtendScript(JSON.stringify(payload)) + "')";
    cs.evalScript(script, function (result) {
      try {
        callback(JSON.parse(result));
      } catch (error) {
        callback({ ok: false, error: result || error.message });
      }
    });
  }

  function chooseFolder() {
    if (fs && typeof fs.showOpenDialogEx === 'function') {
      var result = fs.showOpenDialogEx(false, true, 'Seleziona cartella sorgente', '', []);
      if (result && result.data && result.data.length) {
        folderInput.value = result.data[0];
      }
      return;
    }
    log('Selettore CEP non disponibile: incolla manualmente il percorso della cartella.');
  }

  function readTextFiles(folderPath) {
    if (!nodeRequire) return [];
    var path = nodeRequire('path');
    var nativeFs = nodeRequire('fs');
    var transcriptExtensions = ['.txt', '.srt', '.vtt'];
    try {
      return nativeFs.readdirSync(folderPath)
        .filter(function (name) { return transcriptExtensions.indexOf(path.extname(name).toLowerCase()) !== -1; })
        .slice(0, 8)
        .map(function (name) {
          var fullPath = path.join(folderPath, name);
          return { name: name, text: nativeFs.readFileSync(fullPath, 'utf8').slice(0, 18000) };
        });
    } catch (error) {
      log('Impossibile leggere transcript locali: ' + error.message);
      return [];
    }
  }

  function buildFallbackPlan(settings, imported) {
    var clipCount = imported && imported.clipCount ? imported.clipCount : 0;
    var cutSeconds = settings.cutStyle === 'dynamic' ? 8 : settings.cutStyle === 'calm' ? 22 : 14;
    var highlightWindows = settings.highlightLength === 'short' ? 8 : settings.highlightLength === 'long' ? 24 : 14;
    return {
      summary: 'Piano automatico deterministico: alternanza camere ogni ' + cutSeconds + ' secondi e highlights distribuiti sulla durata.',
      cutSeconds: cutSeconds,
      highlights: Array.apply(null, { length: Math.max(4, Math.min(highlightWindows, clipCount * 3 || 8)) }).map(function (_, index) {
        return { label: 'Highlight ' + (index + 1), weight: 1 };
      })
    };
  }

  function requestGeminiPlan(settings, imported, transcripts, done) {
    var key = geminiKey.value.trim();
    if (!useGemini.checked || !key) {
      done(buildFallbackPlan(settings, imported));
      return;
    }
    if (!nodeRequire) {
      log('Node.js CEP non disponibile: uso piano automatico senza Gemini.');
      done(buildFallbackPlan(settings, imported));
      return;
    }

    var https = nodeRequire('https');
    var prompt = [
      'Sei un assistente di montaggio per podcast/eventi multicamera in Adobe Premiere Pro.',
      'Restituisci solo JSON valido con campi: summary, cutSeconds, highlights[].',
      'Scegli ritmo tagli e finestre highlight usando metadata e transcript disponibili.',
      'Impostazioni: ' + JSON.stringify(settings),
      'Import risultato: ' + JSON.stringify(imported),
      'Transcript: ' + JSON.stringify(transcripts)
    ].join('\n');

    var body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
    var options = {
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(key),
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };

    log('Richiedo piano di montaggio a Gemini...');
    var req = https.request(options, function (res) {
      var raw = '';
      res.on('data', function (chunk) { raw += chunk; });
      res.on('end', function () {
        try {
          var data = JSON.parse(raw);
          var text = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
          done(JSON.parse(text));
        } catch (error) {
          log('Risposta Gemini non utilizzabile, uso fallback: ' + error.message);
          done(buildFallbackPlan(settings, imported));
        }
      });
    });
    req.on('error', function (error) {
      log('Errore Gemini, uso fallback: ' + error.message);
      done(buildFallbackPlan(settings, imported));
    });
    req.write(body);
    req.end();
  }

  function run() {
    var folderPath = folderInput.value.trim();
    if (!folderPath) {
      log('Scegli prima una cartella sorgente.');
      return;
    }

    var settings = {
      folderPath: folderPath,
      syncMode: document.getElementById('syncMode').value,
      cutStyle: document.getElementById('cutStyle').value,
      highlightLength: document.getElementById('highlightLength').value,
      useGemini: useGemini.checked
    };

    logEl.textContent = 'Avvio import...';
    evalJson('AutoPodcastMulticam_importAndPrepare', settings, function (importResult) {
      if (!importResult.ok) {
        log('Errore import: ' + importResult.error);
        return;
      }
      log('Import completato: ' + importResult.clipCount + ' clip multimediali.');
      requestGeminiPlan(settings, importResult, readTextFiles(folderPath), function (plan) {
        log('Piano pronto: ' + (plan.summary || 'senza descrizione'));
        evalJson('AutoPodcastMulticam_buildSequences', { settings: settings, importResult: importResult, plan: plan }, function (buildResult) {
          if (buildResult.ok) {
            log('Fatto: create sequenze "' + buildResult.fullSequence + '" e "' + buildResult.highlightSequence + '".');
          } else {
            log('Errore montaggio: ' + buildResult.error);
          }
        });
      });
    });
  }

  useGemini.addEventListener('change', function () {
    geminiKey.disabled = !useGemini.checked;
  });
  document.getElementById('chooseFolder').addEventListener('click', chooseFolder);
  document.getElementById('run').addEventListener('click', run);
})();
