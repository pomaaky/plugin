/* global app, File, Folder, ProjectItemType, Time */
(function () {
  var EXT = ['.mov', '.mp4', '.m4v', '.mxf', '.avi', '.wav', '.aif', '.aiff', '.mp3', '.aac'];
  var STATE = { binName: 'Auto Podcast Multicam', importedPaths: [] };

  function parsePayload(payload) {
    return JSON.parse(String(payload || '{}'));
  }

  function respond(obj) {
    return JSON.stringify(obj);
  }

  function safeName(value) {
    return String(value || 'Evento').replace(/[\\/:*?"<>|]+/g, '-').replace(/^\s+|\s+$/g, '');
  }

  function isSupportedMedia(file) {
    var name = file.name.toLowerCase();
    for (var i = 0; i < EXT.length; i++) {
      if (name.lastIndexOf(EXT[i]) === name.length - EXT[i].length) return true;
    }
    return false;
  }

  function getOrCreateBin(name) {
    var root = app.project.rootItem;
    for (var i = 0; i < root.children.numItems; i++) {
      var child = root.children[i];
      if (child && child.name === name && child.type === ProjectItemType.BIN) return child;
    }
    return root.createBin(name);
  }

  function collectMedia(folder, files) {
    var entries = folder.getFiles();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] instanceof Folder) collectMedia(entries[i], files);
      if (entries[i] instanceof File && isSupportedMedia(entries[i])) files.push(entries[i]);
    }
  }

  function sortFiles(files, mode) {
    files.sort(function (a, b) {
      if (mode === 'filename') return a.name.localeCompare(b.name);
      var delta = a.modified.getTime() - b.modified.getTime();
      return delta === 0 ? a.name.localeCompare(b.name) : delta;
    });
  }

  function sequenceName(prefix, folderPath) {
    var folder = new Folder(folderPath);
    var stamp = new Date();
    var time = [stamp.getFullYear(), stamp.getMonth() + 1, stamp.getDate(), stamp.getHours(), stamp.getMinutes()].join('-');
    return safeName(prefix + ' - ' + folder.displayName + ' - ' + time);
  }

  function findImportedItems(paths) {
    var matches = [];
    function walk(item) {
      if (!item || !item.children) return;
      for (var i = 0; i < item.children.numItems; i++) {
        var child = item.children[i];
        if (child && child.getMediaPath) {
          var mediaPath = child.getMediaPath();
          for (var p = 0; p < paths.length; p++) {
            if (mediaPath === paths[p]) matches.push(child);
          }
        }
        if (child && child.type === ProjectItemType.BIN) walk(child);
      }
    }
    walk(app.project.rootItem);
    return matches;
  }

  function secondsToTime(seconds) {
    var time = new Time();
    time.seconds = Math.max(0, seconds);
    return time;
  }

  function insertClip(videoTrack, audioTrack, clip, seconds) {
    var when = secondsToTime(seconds);
    videoTrack.insertClip(clip, when);
    audioTrack.insertClip(clip, when);
  }

  function clipDurationSeconds(clip) {
    try {
      if (clip && clip.getOutPoint && clip.getInPoint) {
        return Math.max(1, clip.getOutPoint().seconds - clip.getInPoint().seconds);
      }
    } catch (ignore) {}
    return 60;
  }

  function buildAlternatingSequence(seq, items, plan) {
    var cutSeconds = Math.max(6, Number(plan.cutSeconds || 14));
    var timelineSeconds = 0;
    var maxWindows = Math.max(12, items.length * 6);
    for (var windowIndex = 0; windowIndex < maxWindows; windowIndex++) {
      var clip = items[windowIndex % items.length];
      insertClip(seq.videoTracks[0], seq.audioTracks[0], clip, timelineSeconds);
      timelineSeconds += Math.min(cutSeconds, clipDurationSeconds(clip));
    }
    return timelineSeconds;
  }

  function buildHighlightSequence(seq, items, plan, fullDuration) {
    var highlights = plan.highlights || [];
    var count = Math.max(4, highlights.length || 8);
    var segment = Math.max(8, Math.min(28, fullDuration / (count * 2)));
    var timelineSeconds = 0;
    for (var i = 0; i < count; i++) {
      var clip = items[i % items.length];
      insertClip(seq.videoTracks[0], seq.audioTracks[0], clip, timelineSeconds);
      timelineSeconds += segment;
    }
  }

  $.global.AutoPodcastMulticam_importAndPrepare = function (payload) {
    try {
      var settings = parsePayload(payload);
      var folder = new Folder(settings.folderPath);
      if (!folder.exists) return respond({ ok: false, error: 'La cartella non esiste: ' + settings.folderPath });

      var files = [];
      collectMedia(folder, files);
      sortFiles(files, settings.syncMode);
      if (!files.length) return respond({ ok: false, error: 'Nessun file media supportato trovato nella cartella.' });

      var paths = [];
      for (var i = 0; i < files.length; i++) paths.push(files[i].fsName);
      var bin = getOrCreateBin(STATE.binName);
      app.project.importFiles(paths, true, bin, false);
      STATE.importedPaths = paths;

      return respond({ ok: true, clipCount: paths.length, binName: STATE.binName, paths: paths });
    } catch (error) {
      return respond({ ok: false, error: error.toString() });
    }
  };

  $.global.AutoPodcastMulticam_buildSequences = function (payload) {
    try {
      var data = parsePayload(payload);
      var paths = data.importResult.paths || STATE.importedPaths;
      var items = findImportedItems(paths);
      if (!items.length) return respond({ ok: false, error: 'Clip importate non trovate nel progetto Premiere.' });

      var fullName = sequenceName('Multicam completo', data.settings.folderPath);
      app.project.createNewSequence(fullName, '');
      var fullSeq = app.project.activeSequence;
      var fullDuration = buildAlternatingSequence(fullSeq, items, data.plan || {});

      var highlightName = sequenceName('Highlights', data.settings.folderPath);
      app.project.createNewSequence(highlightName, '');
      var highlightSeq = app.project.activeSequence;
      buildHighlightSequence(highlightSeq, items, data.plan || {}, fullDuration);

      return respond({ ok: true, fullSequence: fullName, highlightSequence: highlightName });
    } catch (error) {
      return respond({ ok: false, error: error.toString() });
    }
  };
})();
