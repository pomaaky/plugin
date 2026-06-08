# Auto Podcast Multicam per Adobe Premiere Pro (macOS)

Plugin CEP per Premiere Pro che importa clip da una cartella, prepara un montaggio multicamera automatico e genera una seconda sequenza riassuntiva con highlights. Include una modalità opzionale con Gemini: l'utente inserisce la propria API key, utilizzabile con il piano gratuito quando disponibile sul proprio account Google AI e il pannello chiede a Gemini un piano di montaggio basato su metadati, nomi file e transcript testuali presenti nella cartella.

## Installazione su macOS

1. Chiudi Adobe Premiere Pro.
2. Da Terminale, nella root della repository, esegui:

   ```bash
   ./scripts/install-macos.sh
   ```

3. Riapri Premiere Pro.
4. Apri `Finestra > Estensioni > Auto Podcast Multicam`.

Lo script copia l'estensione in `~/Library/Application Support/Adobe/CEP/extensions/com.autopodcast.multicam` e abilita `PlayerDebugMode` per consentire il caricamento locale dell'estensione non firmata.

## Uso

1. Crea o apri un progetto Premiere Pro.
2. Nel pannello scegli la cartella che contiene clip video/audio dell'evento o podcast.
3. Scegli la modalità di sincronizzazione:
   - **Timecode / data file**: ordina le sorgenti per data di modifica, utile quando le camere sono state avviate nello stesso momento o hanno timestamp coerenti.
   - **Nome file / progressivo**: ordina alfabeticamente, utile per file rinominati con prefissi tipo `cam-a`, `cam-b`, `audio-master`.
4. Scegli ritmo tagli e durata highlights.
5. Opzionale: abilita Gemini e inserisci una API key. Se nella cartella ci sono `.txt`, `.srt` o `.vtt`, i transcript vengono usati per guidare il piano highlights.
6. Clicca **Crea montaggi**.

## Output creato

Il plugin crea due sequenze nel progetto Premiere:

- `Multicam completo - ...`: montaggio alternato tra le sorgenti importate.
- `Highlights - ...`: versione riassuntiva costruita dal piano Gemini o, senza Gemini, da una selezione automatica deterministica.

## Gemini e piano gratuito

Il pannello usa l'endpoint REST `generateContent` di Google AI con `gemini-2.5-flash`, coerente con la documentazione pubblica Google AI consultata durante la preparazione. Le quote gratuite possono variare in base al paese, account e data: se Gemini risponde con quota esaurita o modello non disponibile, il plugin passa automaticamente al piano di montaggio deterministico senza AI.

## Limiti tecnici

Le API ExtendScript/CEP pubbliche di Premiere Pro non espongono un vero motore di sincronizzazione a waveform audio né l'analisi video semantica nativa. Per questo la versione locale sincronizza e alterna le camere usando ordinamento per timestamp o nome file, mentre Gemini può migliorare le decisioni di ritmo/highlights quando sono disponibili transcript testuali. Per un prodotto commerciale con sync audio reale serve integrare un servizio esterno di analisi audio o un flusso basato su funzioni native di Premiere disponibili manualmente nell'interfaccia.

## Struttura

- `auto-podcast-multicam/CSXS/manifest.xml`: manifest CEP per Premiere Pro.
- `auto-podcast-multicam/index.html`: interfaccia del pannello.
- `auto-podcast-multicam/js/main.js`: logica UI, lettura transcript, chiamata Gemini e bridge verso ExtendScript.
- `auto-podcast-multicam/jsx/AutoPodcastMulticam.jsx`: import media e creazione sequenze in Premiere Pro.
- `scripts/install-macos.sh`: installazione locale su macOS.
